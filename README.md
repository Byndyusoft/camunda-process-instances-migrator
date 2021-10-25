# camunda-process-instances-migrator

[![npm@latest](https://img.shields.io/npm/v/@byndyusoft/base-template/latest.svg)](https://www.npmjs.com/package/@byndyusoft/base-template)
[![test workflow](https://github.com/Byndyusoft/node-base-template/actions/workflows/test.yaml/badge.svg?branch=master)](https://github.com/Byndyusoft/node-base-template/actions/workflows/test.yaml)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Console application for Camunda's process instances migrations between versions of BPMN schemes.

## Requirements

- Node.js v12 LTS or later
- npm or yarn

## Running locally

### Environment

You must initialize `process.env` before start migrator:

```javascript
process.env.INTEGRATIONS_CAMUNDA_API_BASE_URI; #required
process.env.PROCESS_DEFINITION_NAME;           #required
process.env.SOURCE_PROCESS_DEFINITION_VERSION; #optional
process.env.TARGET_PROCESS_DEFINITION_VERSION; #optional
```

Service can be run locally using the following commands.

```bash
yarn install
yarn start
```

## Usage

### Мигрировать экземпляры всех процессов со всех версий на последнюю

```javascript
PROCESS_DEFINITION_NAME = ALL;
```

### Мигрировать экземпляры указанного процесса со всех версий на последнюю

```javascript
PROCESS_DEFINITION_NAME = <DEFINITION_NAME>
```

### Мигрировать экземпляры указанного процесса с 1 версии на последнюю

```javascript
PROCESS_DEFINITION_NAME = <DEFINITION_NAME>
SOURCE_PROCESS_DEFINITION_VERSION = 1
```

### Мигрировать экземпляры указанного процесса с 1 версии на 2 версию

```javascript
PROCESS_DEFINITION_NAME = <DEFINITION_NAME>
SOURCE_PROCESS_DEFINITION_VERSION = 1
TARGET_PROCESS_DEFINITION_VERSION = 2
```

## Maintainers

- [@Byndyusoft/owners](https://github.com/orgs/Byndyusoft/teams/owners) <<github.maintain@byndyusoft.com>>
- [@Byndyusoft/team](https://github.com/orgs/Byndyusoft/teams/team)

## License

This repository is released under version 2.0 of the
[Apache License](https://www.apache.org/licenses/LICENSE-2.0).
