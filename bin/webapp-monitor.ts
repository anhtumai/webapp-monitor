#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ConfigurationStack } from "../lib/configuration-stack";
import { LogSavingStack } from "../lib/log-saving-stack";

const app = new cdk.App();
new ConfigurationStack(app, "WebappMonitorConfigurationStack", {
  env: {
    region: "eu-central-1",
  },
  crossRegionReferences: true,
});
new LogSavingStack(app, "WebappMonitorLogSavingFromFrankfurtStack", {
  env: {
    region: "eu-central-1",
  },
  crossRegionReferences: true,
});

new LogSavingStack(app, "WebappMonitorLogSavingFromIrelandStack", {
  env: {
    region: "eu-west-1",
  },
  crossRegionReferences: true,
});

app.synth();
