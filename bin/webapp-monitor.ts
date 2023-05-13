#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ConfigurationStack } from "../lib/configuration-stack";
import { LogGettingStack } from "../lib/log-getting-stack";
import { LogSavingStack } from "../lib/log-saving-stack";

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
const frankfurtLogSavingStack = new LogSavingStack(
  app,
  "WebappMonitorLogSavingFromFrankfurtStack",
  {
    env: {
      region: "eu-central-1",
    },
    crossRegionReferences: true,
    appConfig: configurationStack.appConfig,
  },
);

const irelandLogSavingStack = new LogSavingStack(
  app,
  "WebappMonitorLogSavingFromIrelandStack",
  {
    env: {
      region: "eu-west-1",
    },
    crossRegionReferences: true,
    appConfig: configurationStack.appConfig,
  },
);

new LogGettingStack(app, "WebappMonitorLogGettingStack", {
  env: {
    region: "eu-central-1",
  },
  crossRegionReferences: true,
  logSaving: {
    regions: [frankfurtLogSavingStack.region, irelandLogSavingStack.region],
    dynamodbARNs: [
      frankfurtLogSavingStack.webMonitorTableArn,
      irelandLogSavingStack.webMonitorTableArn,
    ],
  },
});

app.synth();
