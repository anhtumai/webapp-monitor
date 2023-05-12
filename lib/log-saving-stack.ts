import path = require("path");

import { Duration, Stack, StackProps, Fn } from "aws-cdk-lib";
import { LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { LogLevel, NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib/core";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class LogSavingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const webMonitorAppConfigLayer = LayerVersion.fromLayerVersionArn(
      this,
      "web-monitor-app-config-layer",
      "arn:aws:lambda:eu-central-1:066940009817:layer:AWS-AppConfig-Extension:91",
    );

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
        tableName: `web-monitor-table-from-${this.region}`,
        partitionKey: { name: "url", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        sortKey: { name: "time", type: dynamodb.AttributeType.STRING },
      },
    );

    const appConfigDeploymentUri = Fn.importValue(
      "webMonitorAppConfigDeploymentUri",
    );

    const webMonitorLambda = new NodejsFunction(this, "web-monitor-lambda", {
      functionName: "web-monitor-lambda",
      description: "Lambda for monitoring",
      entry: path.join(__dirname, "../lambdas/webMonitoringHandler.ts"),
      handler: "handler",
      timeout: Duration.seconds(300),
      runtime: Runtime.NODEJS_18_X,
      environment: {
        APP_CONFIG_DEPLOYMENT_URI: appConfigDeploymentUri,
        WEB_MONITOR_DYNAMODB: webMonitorTable.tableName,
        WEB_MONITOR_DYNAMODB_REGION: this.region,
      },
      bundling: {
        externalModules: ["aws-sdk"],
        target: "es2021",
        logLevel: LogLevel.ERROR,
        minify: true,
        keepNames: true,
        sourceMap: false,
      },
      layers: [webMonitorAppConfigLayer],
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
