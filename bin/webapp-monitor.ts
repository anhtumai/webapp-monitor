#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ConfigurationStack } from "../lib/configuration-stack";
import { ReportGettingStack } from "../lib/report-getting-stack";
import { ReportSavingStack } from "../lib/report-saving-stack";

import { reportSavingStacksConfig } from "../lib/config";

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

const reportSavingStacks = reportSavingStacksConfig.map(
  (stackConfig) =>
    new ReportSavingStack(app, stackConfig.stackName, {
      env: {
        region: stackConfig.region,
      },
      crossRegionReferences: true,
      appConfig: configurationStack.appConfig,
    }),
);

new ReportGettingStack(app, "WebappMonitorReportGettingStack", {
  env: {
    region: "eu-central-1",
  },
  crossRegionReferences: true,
  reportSaving: {
    regions: reportSavingStacks.map(
      (reportSavingStack) => reportSavingStack.region,
    ),
    dynamodbARNs: reportSavingStacks.map(
      (reportSavingStack) => reportSavingStack.webMonitorTableArn,
    ),
  },
});

app.synth();
