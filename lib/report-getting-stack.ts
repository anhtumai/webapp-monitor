import path = require("path");

import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { LogLevel, NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

interface ReportGettingStackProps extends StackProps {
  readonly reportSaving: {
    readonly regions: string[];
    readonly dynamodbARNs: string[];
  };
}

/*
 * ReportGettingStack exposes a GET Endpoint for users to query reports stored in DynamoDB Tables in different regions.
  It consists of one AWS Lambda and one API Gateway Rest API.
 */
export class ReportGettingStack extends Stack {
  constructor(scope: Construct, id: string, props: ReportGettingStackProps) {
    super(scope, id, props);

    const getUrlReportContentsHandler = new NodejsFunction(
      this,
      "web-monitor-lambda",
      {
        functionName: "get-url-report-contents-lambda",
        description: "Get Url Report Contents",
        entry: path.join(__dirname, "../lambdas/getUrlReportContents/index.ts"),
        handler: "handler",
        timeout: Duration.seconds(300),
        runtime: Runtime.NODEJS_18_X,
        environment: {
          REPORT_SAVING_TABLE_NAME: "web-monitor-table",
          REPORT_SAVING_REGIONS: props.reportSaving.regions.join(","),
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

    const readReportSavingTablesIamPolicy = new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: props.reportSaving.dynamodbARNs,
    });

    getUrlReportContentsHandler.role?.attachInlinePolicy(
      new iam.Policy(this, "read-report-saving-tables-policy", {
        statements: [readReportSavingTablesIamPolicy],
      }),
    );

    const getUrlReportContentsApi = new apigateway.RestApi(
      this,
      "get-url-report-contents-api",
      {
        restApiName: "Url Report Content Service",
        description: "This service serves url report contents",
      },
    );

    const getUrlReportContentsIntegration = new apigateway.LambdaIntegration(
      getUrlReportContentsHandler,
      {
        requestTemplates: {
          "application/json": '{ statusCode: "200" }',
        },
      },
    );

    getUrlReportContentsApi.root.addMethod(
      "GET",
      getUrlReportContentsIntegration,
    );
  }
}
