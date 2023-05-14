import path = require("path");

import {
  aws_events,
  aws_events_targets,
  Duration,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { LogLevel, NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import { Construct } from "constructs";

import { reportSavingWebMonitorLambdaSchedule } from "./config";

/*
 * ReportSavingStack periodically sends GET requests to a list of websites,
  analyzes their response contents to check if they satisfy predefined rules,
  and logs the report into DynamoDB Table.
  It consists of one AWS Lambda scheduled by Cloudwatch Event and one DynamoDB table.
 */
interface ReportSavingStackProps extends StackProps {
  readonly appConfig: {
    readonly applicationId: string;
    readonly environmentId: string;
    readonly configurationProfileId: string;
    readonly region: string;
  };
}

export class ReportSavingStack extends Stack {
  readonly webMonitorTableArn: string;
  constructor(scope: Construct, id: string, props: ReportSavingStackProps) {
    super(scope, id, props);

    const appConfigPolicy = new iam.PolicyStatement({
      actions: [
        "appconfig:StartConfigurationSession",
        "appconfig:GetLatestConfiguration",
      ],
      resources: ["*"],
    });

    const webMonitorTable = new dynamodb.Table(
      this,
      "web-monitor-dynamodb-table",
      {
        tableName: `web-monitor-table`,
        partitionKey: { name: "url", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        sortKey: { name: "time", type: dynamodb.AttributeType.STRING },
      },
    );

    const webMonitorLambda = new NodejsFunction(this, "web-monitor-lambda", {
      functionName: "web-monitor-lambda",
      description: "Lambda for monitoring",
      entry: path.join(__dirname, "../lambdas/reportSaving/index.ts"),
      handler: "handler",
      timeout: Duration.seconds(300),
      runtime: Runtime.NODEJS_18_X,
      environment: {
        WEB_MONITOR_DYNAMODB: webMonitorTable.tableName,
        WEB_MONITOR_DYNAMODB_REGION: this.region,

        APP_CONFIG_REGION: props.appConfig.region,
        APP_CONFIG_APPLICATION_ID: props.appConfig.applicationId,
        APP_CONFIG_ENVIRONMENT_ID: props.appConfig.environmentId,
        APP_CONFIG_CONFIGURATION_PROFILE_ID:
          props.appConfig.configurationProfileId,
      },
      bundling: {
        externalModules: ["aws-sdk"],
        target: "es2021",
        logLevel: LogLevel.ERROR,
        minify: true,
        keepNames: true,
        sourceMap: false,
      },
      depsLockFilePath: "yarn.lock",
    });

    webMonitorLambda.role?.attachInlinePolicy(
      new iam.Policy(this, "app-config-policy", {
        statements: [appConfigPolicy],
      }),
    );

    new aws_events.Rule(this, "web-monitor-lambda-schedule-rule", {
      description: "Web Monitor Lambda Schedule",
      targets: [new aws_events_targets.LambdaFunction(webMonitorLambda)],
      schedule: reportSavingWebMonitorLambdaSchedule,
    });

    webMonitorTable.grantWriteData(webMonitorLambda);

    this.webMonitorTableArn = webMonitorTable.tableArn;
  }
}
