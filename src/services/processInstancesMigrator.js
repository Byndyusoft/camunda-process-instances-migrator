/*
 * Copyright 2021 Byndyusoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

/* eslint-disable consistent-return, no-await-in-loop */

const Manipula = require("manipula");
const logger = require("pino").pino({ prettyPrint: true });

const CamundaApiHttpClient = require("../clients/camundaApiHttpClient");
const {
  DELETE_CAMUNDA_ENTITY_TIMEOUT,
  CHECK_BATCH_COMPLETION_TIMEOUT,
} = require("../constants");

/**
 * Gets source version ids and target version id for migration
 *
 * @param {{name: string, sourceProcessDefinitionId?: string, targetProcessDefinitionId?: string}} processDefinition
 * @param {CamundaApiHttpClient} camundaApiHttpClient
 * @returns {{sourceProcessDefinitionIds: Array<string>, targetProcessDefinitionId: string}}
 */
const getProcessDefinitionIdsForMigration = async (
  processDefinition,
  camundaApiHttpClient,
) => {
  if (!processDefinition) {
    logger.warn(
      "Get process definition ids for migration: processDefinition is not defined",
    );
    return;
  }

  logger.debug(
    { processDefinition },
    "Start to get process definition ids for migration with process definition",
  );

  let sourceProcessDefinitionIds;
  let targetProcessDefinitionId;

  if (typeof processDefinition.sourceProcessDefinitionId !== "number") {
    const listProcessDefinitionsResponse =
      await camundaApiHttpClient.listProcessDefinitions({
        key: processDefinition.name,
      });

    sourceProcessDefinitionIds = Manipula.from(listProcessDefinitionsResponse)
      .select((x) => x.id)
      .toArray();

    targetProcessDefinitionId =
      await camundaApiHttpClient.getProcessDefinitionLastVersionIdByDefinitionKey(
        processDefinition.name,
      );
  }

  if (typeof processDefinition.sourceProcessDefinitionId === "number") {
    const sourceProcessDefinition = Manipula.from(
      await camundaApiHttpClient.listProcessDefinitions({
        key: processDefinition.name,
        version: processDefinition.sourceProcessDefinitionId,
      }),
    ).singleOrDefault();

    sourceProcessDefinitionIds = [(sourceProcessDefinition || {}).id];

    if (typeof processDefinition.targetProcessDefinitionId === "number") {
      const targetProcessDefinition = Manipula.from(
        await camundaApiHttpClient.listProcessDefinitions({
          key: processDefinition.name,
          version: processDefinition.targetProcessDefinitionId,
        }),
      ).singleOrDefault();

      targetProcessDefinitionId = (targetProcessDefinition || {}).id;
    } else {
      targetProcessDefinitionId =
        await camundaApiHttpClient.getProcessDefinitionLastVersionIdByDefinitionKey(
          processDefinition.name,
        );
    }
  }

  return { sourceProcessDefinitionIds, targetProcessDefinitionId };
};

/**
 * Checks that the batch has completed
 *
 * @param {string} batchId
 * @param {CamundaApiHttpClient} camundaApiHttpClient
 * @returns {boolean}
 */
const checkBatchCompletion = async (batchId, camundaApiHttpClient) => {
  if (!batchId) {
    logger.warn("Check batch completion: batchId is not defined");
    return false;
  }

  logger.debug({ batchId }, "Start to check batch completion by identifier");

  const getBatchesStatisticsResponse =
    await camundaApiHttpClient.getBatchesStatistics({ batchId });
  const batch = Manipula.from(getBatchesStatisticsResponse).singleOrDefault();

  return (
    !batch ||
    batch.totalJobs === batch.completedJobs ||
    batch.remainingJobs === batch.failedJobs
  );
};

/**
 * setTimeout in Promise for waiting its
 *
 * @param {number} duration in milliseconds
 * @returns {Promise<void>}
 */
const delay = (duration) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

/**
 * Waits when the batch will completed
 *
 * @param {string} batchId
 * @param {CamundaApiHttpClient} camundaApiHttpClient
 * @returns {void}
 */
const waitBatchExecutionCompletion = async (batchId, camundaApiHttpClient) => {
  if (!batchId) {
    logger.warn("Wait batch execution completion: batchId is not defined");
    return;
  }

  logger.debug(
    { batchId },
    "Start to wait batch execution completion by identifier",
  );

  let isCompleted = await checkBatchCompletion(batchId, camundaApiHttpClient);

  while (!isCompleted) {
    await delay(CHECK_BATCH_COMPLETION_TIMEOUT);
    isCompleted = await checkBatchCompletion(batchId, camundaApiHttpClient);
  }
};

/**
 * Checks that the batch is successed or failed
 *
 * @param {string} batchId
 * @param {CamundaApiHttpClient} camundaApiHttpClient
 * @returns {boolean}
 */
const checkBatchExecutionResult = async (batchId, camundaApiHttpClient) => {
  if (!batchId) {
    logger.warn("Check batch execution result: batchId is not defined");
    return false;
  }

  logger.debug(
    { batchId },
    "Start to check batch execution result by identifier",
  );

  const getBatchesStatisticsResponse =
    await camundaApiHttpClient.getBatchesStatistics({ batchId });
  const completedBatch = Manipula.from(
    getBatchesStatisticsResponse,
  ).singleOrDefault();

  return (
    !completedBatch ||
    (completedBatch.failedJobs === 0 && completedBatch.remainingJobs === 0)
  );
};

/**
 * Deletes deployment by relevant process definition id
 *
 * @param {string} processDefinitionId
 * @param {CamundaApiHttpClient} camundaApiHttpClient
 * @returns {void}
 */
const deleteDeployment = async (processDefinitionId, camundaApiHttpClient) => {
  if (!processDefinitionId) {
    logger.warn("Delete deployment: processDefinitionId is not defined");
    return;
  }

  logger.debug(
    { processDefinitionId },
    "Start to delete deployment by process definition identifier",
  );

  const processDefinition = await camundaApiHttpClient.getProcessDefinitionById(
    processDefinitionId,
  );

  await delay(DELETE_CAMUNDA_ENTITY_TIMEOUT);

  await camundaApiHttpClient.deleteDeployment(processDefinition.deploymentId);
};

/**
 * Deletes failed batch by its id
 *
 * If the batch has failed, first of all it is needed to suspend the batch,
 * to wait for that another transaction will complete deal with the batch and then to delete its.
 *
 * @param {string} batchId
 * @param {CamundaApiHttpClient} camundaApiHttpClient
 * @returns {void}
 */
const deleteFailedBatch = async (batchId, camundaApiHttpClient) => {
  if (!batchId) {
    logger.warn("Delete failed batch: batchId is not defined");
    return;
  }

  logger.debug({ batchId }, "Start to delete  failed batch by identifier");

  await camundaApiHttpClient.suspendBatch(batchId);

  await delay(DELETE_CAMUNDA_ENTITY_TIMEOUT);

  await camundaApiHttpClient.deleteBatch(batchId);
};

/**
 * Executes process instances migration
 *
 * @param {string} sourceProcessDefinitionId
 * @param {string} targetProcessDefinitionId
 * @param {CamundaApiHttpClient} camundaApiHttpClient
 * @returns {{migrationBatch: any, isSuccessedMigrationBatch: boolean}}
 */
const executeProcessInstancesMigration = async (
  sourceProcessDefinitionId,
  targetProcessDefinitionId,
  camundaApiHttpClient,
) => {
  if (!sourceProcessDefinitionId || !targetProcessDefinitionId) {
    logger.warn(
      "Execute process instances migration: sourceProcessDefinitionId and / or targetProcessDefinitionId is not defined",
    );
    return;
  }

  logger.debug(
    { sourceProcessDefinitionId, targetProcessDefinitionId },
    "Start to execute process instances migration from source version to target version",
  );

  const migrationBatch = await camundaApiHttpClient.migrateProcessInstances(
    sourceProcessDefinitionId,
    targetProcessDefinitionId,
  );

  await waitBatchExecutionCompletion(migrationBatch.id, camundaApiHttpClient);

  const isSuccessedMigrationBatch = await checkBatchExecutionResult(
    migrationBatch.id,
    camundaApiHttpClient,
  );

  return { migrationBatch, isSuccessedMigrationBatch };
};

/**
 * Converts the input data into the required format
 *
 * @param {any} request
 * @param {CamundaApiHttpClient} camundaApiHttpClient
 * @returns {[{name: string, sourceProcessDefinitionId?: string, targetProcessDefinitionId?: string}]}
 */
const prepareMigrateProcessInstancesRequest = async (
  request,
  camundaApiHttpClient,
) => {
  if (request[0].name === "ALL") {
    const processDefinitions =
      await camundaApiHttpClient.listProcessDefinitions({
        latestVersion: true,
      });

    return (processDefinitions || []).map((x) => {
      return {
        name: x.key,
      };
    });
  }

  return request;
};

/**
 * Migrates process instances
 *
 * @param {any} request
 * @returns {void}
 */
const migrateProcessInstances = async (request) => {
  const camundaApiHttpClient = new CamundaApiHttpClient();

  const processDefinitions = await prepareMigrateProcessInstancesRequest(
    request,
    camundaApiHttpClient,
  );

  if (processDefinitions.length === 0) {
    logger.warn("Migrate process instances: processDefinitions.length is zero");
    return;
  }

  for (let i = 0; i < processDefinitions.length; i += 1) {
    const { sourceProcessDefinitionIds, targetProcessDefinitionId } =
      await getProcessDefinitionIdsForMigration(
        processDefinitions[i],
        camundaApiHttpClient,
      );

    for (let j = 0; j < sourceProcessDefinitionIds.length; j += 1) {
      const currentSourceProcessDefinitionId = sourceProcessDefinitionIds[j];

      if (currentSourceProcessDefinitionId !== targetProcessDefinitionId) {
        const sourceProcessDefinitionInstances =
          await camundaApiHttpClient.getProcessInstancesByProcessDefinitionId(
            currentSourceProcessDefinitionId,
          );

        if (
          !sourceProcessDefinitionInstances ||
          sourceProcessDefinitionInstances.length === 0
        ) {
          logger.warn(
            { currentSourceProcessDefinitionId },
            "Process definition has no any running instances",
          );

          await deleteDeployment(
            currentSourceProcessDefinitionId,
            camundaApiHttpClient,
          );
        } else {
          const { isSuccessedMigrationBatch, migrationBatch } =
            await executeProcessInstancesMigration(
              currentSourceProcessDefinitionId,
              targetProcessDefinitionId,
              camundaApiHttpClient,
            );

          logger.info(
            { currentSourceProcessDefinitionId, targetProcessDefinitionId },
            `Migration has ${
              isSuccessedMigrationBatch ? "successed" : "failed"
            }`,
          );

          // eslint-disable-next-line no-unused-expressions
          isSuccessedMigrationBatch
            ? await deleteDeployment(
                currentSourceProcessDefinitionId,
                camundaApiHttpClient,
              )
            : await deleteFailedBatch(migrationBatch.id, camundaApiHttpClient);
        }
      }
    }
  }
};

module.exports = { migrateProcessInstances };
