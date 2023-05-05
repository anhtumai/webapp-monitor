#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { WebappMonitorStack } from "../lib/webapp-monitor-stack";

const app = new cdk.App();
new WebappMonitorStack(app, "WebappMonitorStack", {
  env: {
    region: "eu-central-1",
  },
});
