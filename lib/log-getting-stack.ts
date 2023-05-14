import path = require("path");

import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { LogLevel, NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

interface LogGettingStackProps extends StackProps {
  readonly logSaving: {
    readonly regions: string[];
    readonly dynamodbARNs: string[];
  };
}

/*
 * Log Getting Stack exposes a GET Endpoint for users to query logs stored in
  DynamoDB Tables in different regions.
  It consists of one AWS Lambda and one API Gateway Rest API.
 */
export class LogGettingStack extends Stack {
  constructor(scope: Construct, id: string, props: LogGettingStackProps) {
    super(scope, id, props);

    const getUrlLogContentsHandler = new NodejsFunction(
      this,
      "web-monitor-lambda",
      {
        functionName: "get-url-log-contents-lambda",
        description: "Get Url Log Contents",
        entry: path.join(__dirname, "../lambdas/getUrlLogContents/index.ts"),
        handler: "handler",
        timeout: Duration.seconds(300),
        runtime: Runtime.NODEJS_18_X,
        environment: {
          LOG_SAVING_TABLE_NAME: "web-monitor-table",
          LOG_SAVING_REGIONS: props.logSaving.regions.join(","),
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
      },
    );

    const readLogSavingTablesIamPolicy = new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: props.logSaving.dynamodbARNs,
    });

    getUrlLogContentsHandler.role?.attachInlinePolicy(
      new iam.Policy(this, "read-log-saving-tables-policy", {
        statements: [readLogSavingTablesIamPolicy],
      }),
    );

    const getUrlLogContentsApi = new apigateway.RestApi(
      this,
      "get-url-log-contents-api",
      {
        restApiName: "Url Log Content Service",
        description: "This service serves url log contents",
      },
    );

    const getUrlLogContentsIntegration = new apigateway.LambdaIntegration(
      getUrlLogContentsHandler,
      {
        requestTemplates: {
          "application/json": '{ statusCode: "200" }',
        },
      },
    );

    getUrlLogContentsApi.root.addMethod("GET", getUrlLogContentsIntegration);
  }
}
