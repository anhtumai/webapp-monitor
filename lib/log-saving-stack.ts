import path = require("path");

import { Duration, Stack, StackProps, Fn } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { LogLevel, NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class LogSavingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
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
      entry: path.join(__dirname, "../lambdas/webMonitoringHandler.ts"),
      handler: "handler",
      timeout: Duration.seconds(300),
      runtime: Runtime.NODEJS_18_X,
      environment: {
        WEB_MONITOR_DYNAMODB: webMonitorTable.tableName,
        WEB_MONITOR_DYNAMODB_REGION: this.region,
        APP_CONFIG_REGION: "eu-central-1",
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

    webMonitorTable.grantWriteData(webMonitorLambda);
  }
}
