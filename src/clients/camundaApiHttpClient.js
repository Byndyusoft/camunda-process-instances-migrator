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

/* eslint-disable consistent-return */

const { default: axios } = require("axios");

module.exports = class CamundaApiHttpClient {
  /**
   * Creates an instance of CamundaApiHttpClient.
   *
   * @memberof CamundaApiHttpClient
   */
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: process.env.INTEGRATIONS_CAMUNDA_API_BASE_URI,
      headers: {
        Accept: "application/json",
      },
    });

    this.axiosInstance.defaults.headers.post["Content-Type"] =
      "application/json";
    this.axiosInstance.defaults.headers.put["Content-Type"] =
      "application/json";
  }

  /**
   * Gets process instances by process definition id
   *
   * @param {string} processDefinitionId
   * @returns {Promise<Array<any>>} Array of process instances
   */
  getProcessInstancesByProcessDefinitionId(processDefinitionId) {
    if (!processDefinitionId) {
      console.warn(
        "Get process instances by process definition id: processDefinitionId is not defined",
      );
      return [];
    }

    console.debug(
      "Start to get process instances by process definition identifier",
      { processDefinitionId },
    );

    return this.axiosInstance
      .get(`/process-instance?processDefinitionId=${processDefinitionId}`)
      .then(({ status, data }) => {
        return status === 200 ? data : [];
      })
      .catch((error) => {
        console.error(
          "Getting process instances by process definition identifier has completed with error",
          { processDefinitionId, error },
        );

        return [];
      });
  }

  /**
   * Gets last version id of process definition by its key
   *
   * @param {string} definitionKey
   * @returns {Promise<void | string>} id
   */
  getProcessDefinitionLastVersionIdByDefinitionKey(definitionKey) {
    if (!definitionKey) {
      console.warn(
        "Get process definition last version id by definition key: definitionKey is not defined",
      );
      return;
    }

    console.debug(
      "Start to get process definition last version id by definition key",
      { definitionKey },
    );

    return this.axiosInstance
      .get(`/process-definition/key/${definitionKey}`)
      .then(({ status, data }) => {
        return status === 200 ? data.id : undefined;
      })
      .catch((error) => {
        console.error(
          "Getting process definition last version identifier by definition key has completed with error",
          { definitionKey, error },
        );
      });
  }

  /**
   * Gets process definition by its id
   *
   * @param {string} definitionId
   * @returns {Promise<void | any>} data
   */
  getProcessDefinitionById(definitionId) {
    if (!definitionId) {
      console.warn(
        "Get process definition by identifier: definitionId is not defined",
      );
      return;
    }

    console.debug("Start to get process definition by identifier", {
      definitionId,
    });

    return this.axiosInstance
      .get(`/process-definition/${definitionId}`)
      .then(({ status, data }) => {
        return status === 200 ? data : undefined;
      })
      .catch((error) => {
        console.error(
          "Getting process definition by identifier has completed with error",
          { definitionId, error },
        );
      });
  }

  /**
   * List process definitions
   *
   * @param {{key: string}} filters
   * @returns {Promise<Array<any>>} Array of process definitions
   */
  listProcessDefinitions(filters) {
    console.debug("Start to list process definitions by filters", { filters });

    return this.axiosInstance
      .get("/process-definition", { params: filters })
      .then(({ status, data }) => {
        return status === 200 ? data : [];
      })
      .catch((error) => {
        console.error(
          "Getting process definitions list by filters has completed with error",
          { filters, error },
        );
        return [];
      });
  }

  /**
   * Generates migration plan for source version and target version
   *
   * @param {string} sourceProcessDefinitionId
   * @param {string} targetProcessDefinitionId
   * @returns {Promise<void | any>} migration plan
   */
  generateMigrationPlan(sourceProcessDefinitionId, targetProcessDefinitionId) {
    if (!sourceProcessDefinitionId || !targetProcessDefinitionId) {
      console.warn(
        "Generate migration plan: sourceProcessDefinitionId and / or targetProcessDefinitionId is not defined",
      );
      return;
    }

    console.debug(
      "Start to generate migration plan for source version and target version",
      { sourceProcessDefinitionId, targetProcessDefinitionId },
    );

    const body = {
      sourceProcessDefinitionId,
      targetProcessDefinitionId,
      updateEventTriggers: true,
    };

    return this.axiosInstance
      .post(`/migration/generate`, body)
      .then(({ status, data }) => {
        return status === 200 ? data : undefined;
      })
      .catch((error) => {
        console.error(
          "Generating migration plan for source version and target version has completed with error",
          { sourceProcessDefinitionId, targetProcessDefinitionId, error },
        );
      });
  }

  /**
   * Migrates process instances for migration plan
   *
   * @param {any | void} migrationPlan
   * @returns {Promise<void | any>} batch
   */
  migrateProcessInstancesForMigrationPlan(migrationPlan) {
    if (!migrationPlan) {
      console.warn(
        "Migrate process instances for migration plan: migrationPlan is not defined",
      );
      return;
    }

    console.debug("Start to migrate migration plan");

    const body = {
      processInstanceQuery: {
        processDefinitionId: migrationPlan.sourceProcessDefinitionId,
      },
      migrationPlan,
      skipCustomListeners: true,
    };

    return this.axiosInstance
      .post(`/migration/executeAsync`, body)
      .then(({ status, data }) => {
        return status === 200 ? data : undefined;
      })
      .catch((error) => {
        console.error("Migration for migration plan has completed with error", {
          migrationPlan,
          error,
        });
      });
  }

  /**
   * Migrates process instances from source version to target version
   *
   * @param {string} sourceProcessDefinitionId
   * @param {string} targetProcessDefinitionId
   * @returns {Promise<any | void>} batch
   */
  async migrateProcessInstances(
    sourceProcessDefinitionId,
    targetProcessDefinitionId,
  ) {
    if (!sourceProcessDefinitionId || !targetProcessDefinitionId) {
      console.warn(
        "Migrate process instances: sourceProcessDefinitionId and / or targetProcessDefinitionId is not defined",
      );
      return;
    }

    console.debug(
      "Start to migrate process instances from source version to target version",
      { sourceProcessDefinitionId, targetProcessDefinitionId },
    );

    const migrationPlan = await this.generateMigrationPlan(
      sourceProcessDefinitionId,
      targetProcessDefinitionId,
    );
    return this.migrateProcessInstancesForMigrationPlan(migrationPlan);
  }

  /**
   * Gets batches statistics
   *
   * @param {{batchId: string}} filters
   * @returns {Promise<Array<any>>} Array of batches statictics
   */
  getBatchesStatistics(filters) {
    console.debug("Start to get batches statistics by filters");

    return this.axiosInstance
      .get("/batch/statistics", { params: filters })
      .then(({ status, data }) => {
        return status === 200 ? data : [];
      })
      .catch((error) => {
        console.error(
          "Getting batches statistics with filters has completed with error",
          { filters, error },
        );
        return [];
      });
  }

  /**
   * Deletes deployment by its id
   *
   * @param {string} deploymentId
   * @returns {Promise<void | any>} data
   */
  deleteDeployment(deploymentId) {
    if (!deploymentId) {
      console.warn(
        "Delete deployment by identifier: deploymentId is not defined",
      );
      return;
    }

    console.debug("Start to delete deployment by identifier", { deploymentId });

    return this.axiosInstance
      .delete(`/deployment/${deploymentId}`)
      .then(({ status, data }) => {
        return status === 204 ? data : undefined;
      })
      .catch((error) => {
        console.error(
          "Removing of deployment by identifier has completed with error",
          { deploymentId, error },
        );
      });
  }

  /**
   * Suspends batch by its id
   *
   * @param {string} batchId
   * @returns {Promise<void | any>} data
   */
  suspendBatch(batchId) {
    if (!batchId) {
      console.warn("Suspend batch by identifier: batchId is not defined");
      return;
    }

    console.debug("Start to suspend batch by identifier", { batchId });

    const body = {
      suspended: true,
    };

    return this.axiosInstance
      .put(`/batch/${batchId}/suspended`, body)
      .then(({ status, data }) => {
        return status === 204 ? data : undefined;
      })
      .catch((error) => {
        console.error(
          "Suspending of batch by identifier has completed with error",
          { batchId, error },
        );
      });
  }

  /**
   * Deletes batch by its id
   *
   * @param {string} batchId
   * @returns {Promise<void | any>} data
   */
  deleteBatch(batchId) {
    if (!batchId) {
      console.warn("Delete batch by identifier: batchId is not defined");
      return;
    }

    console.debug("Start to delete batch by identifier", { batchId });

    return this.axiosInstance
      .delete(`/batch/${batchId}`)
      .then(({ status, data }) => {
        return status === 204 ? data : undefined;
      })
      .catch((error) => {
        console.error(
          "Removing of batch by identifier has completed with error",
          { batchId, error },
        );
      });
  }
};
