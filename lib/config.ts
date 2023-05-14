/*
 * A centralized place for developers to config the application.
 */

import { aws_events, Duration } from "aws-cdk-lib";

// Checking period
export const reportSavingWebMonitorLambdaSchedule: aws_events.Schedule =
  aws_events.Schedule.rate(Duration.hours(1));

// Checking regions
export const reportSavingStacksConfig = [
  {
    region: "eu-central-1",
    stackName: "WebappMonitorReportSavingFromFrankfurtStack",
  },
  {
    region: "eu-west-1",
    stackName: "WebappMonitorReportSavingFromIrelandStack",
  },
];
