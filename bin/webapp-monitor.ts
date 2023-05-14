#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ConfigurationStack } from "../lib/configuration-stack";
import { LogGettingStack } from "../lib/log-getting-stack";
import { LogSavingStack } from "../lib/log-saving-stack";

import { logSavingStacksConfig } from "../lib/config";

const app = new cdk.App();
const configurationStack = new ConfigurationStack(
  app,
  "WebappMonitorConfigurationStack",
  {
    env: {
      region: "eu-central-1",
    },
    crossRegionReferences: true,
  },
);

const logSavingStacks = logSavingStacksConfig.map(
  (stackConfig) =>
    new LogSavingStack(app, stackConfig.stackName, {
      env: {
        region: stackConfig.region,
      },
      crossRegionReferences: true,
      appConfig: configurationStack.appConfig,
    }),
);

new LogGettingStack(app, "WebappMonitorLogGettingStack", {
  env: {
    region: "eu-central-1",
  },
  crossRegionReferences: true,
  logSaving: {
    regions: logSavingStacks.map((logSavingStack) => logSavingStack.region),
    dynamodbARNs: logSavingStacks.map(
      (logSavingStack) => logSavingStack.webMonitorTableArn,
    ),
  },
});

app.synth();
