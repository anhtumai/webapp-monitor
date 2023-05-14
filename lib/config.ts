/*
 * A centralized place for developers to config the application.
 */

import { aws_events, Duration } from "aws-cdk-lib";

// Checking period
export const logSavingWebMonitorLambdaSchedule: aws_events.Schedule =
  aws_events.Schedule.rate(Duration.hours(1));

// Checking regions
export const logSavingStacksConfig = [
  {
    region: "eu-central-1",
    stackName: "WebappMonitorLogSavingFromFrankfurtStack",
  },
  {
    region: "eu-west-1",
    stackName: "WebappMonitorLogSavingFromIrelandStack",
  },
];
