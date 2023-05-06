import path = require("path");

import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import {
  LogLevel,
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as appconfig from "aws-cdk-lib/aws-appconfig";

class WebMonitorAppConfig extends Construct {
  constructor(scope: Construct) {
    const id = "web-monitor-app-config";
    super(scope, id);

    const webMonitorAppConfigApp: appconfig.CfnApplication =
      new appconfig.CfnApplication(this, "web-monitor-app-config-app", {
        name: "web-monitor-app-config-app",
      });

    const immediateDeploymentStrategy = new appconfig.CfnDeploymentStrategy(
      this,
      "web-monitor-deployment-strategy",
      {
        name: "web-monitor-deployment-strategy",
        deploymentDurationInMinutes: 0,
        growthFactor: 100,
        replicateTo: "NONE",
        finalBakeTimeInMinutes: 0,
      },
    );

    const webMonitorAppConfigEnv: appconfig.CfnEnvironment =
      new appconfig.CfnEnvironment(this, "web-monitor-app-config-env", {
        applicationId: webMonitorAppConfigApp.ref,
        name: "Production",
      });

    const webMonitorAppConfigProfile: appconfig.CfnConfigurationProfile =
      new appconfig.CfnConfigurationProfile(
        this,
        "web-monitor-configuration-profile",
        {
          name: "web-monitor-configuration-profile",
          applicationId: webMonitorAppConfigApp.ref,
          locationUri: "hosted",
          type: "AWS.Freeform",
          validators: [
            {
              content: JSON.stringify({
                type: "array",
                items: {
                  type: "object",
                  required: ["url", "request", "rules"],
                  additionalProperties: false,
                  properties: {
                    url: { type: "string" },
                    request: { type: "string" },
                    rules: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          containText: { type: "string" },
                        },
                      },
                    },
                  },
                },
              }),
              type: "JSON_SCHEMA",
            },
          ],
        },
      );

    const webMonitorConfigVersion: appconfig.CfnHostedConfigurationVersion =
      new appconfig.CfnHostedConfigurationVersion(
        this,
        "web-monitor-hosted-configuration-version",
        {
          applicationId: webMonitorAppConfigApp.ref,
          configurationProfileId: webMonitorAppConfigProfile.ref,
          contentType: "application/json",
          content: JSON.stringify("[]"),
        },
      );

    new appconfig.CfnDeployment(this, "web-monitor-app-config-deployment", {
      applicationId: webMonitorAppConfigApp.ref,
      configurationProfileId: webMonitorAppConfigProfile.ref,
      configurationVersion: webMonitorConfigVersion.ref,
      deploymentStrategyId: immediateDeploymentStrategy.ref,
      environmentId: webMonitorAppConfigEnv.ref,
    });
  }
}

export class WebappMonitorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const webMonitorAppConfig = new WebMonitorAppConfig(this);

    const webMonitorLambda = new NodejsFunction(this, "web-monitor-lambda", {
      functionName: "web-monitor-lambda",

      description: "Lambda for monitoring",
      entry: path.join(__dirname, "../lambdas/webMonitoringHandler.ts"),
      handler: "handler",

      timeout: Duration.seconds(300),
      runtime: Runtime.NODEJS_18_X,
      environment: {},
      bundling: {
        externalModules: ["aws-sdk"],
        target: "es2021",
        logLevel: LogLevel.ERROR,
        minify: true,
        keepNames: true,
        sourceMap: false,
      },
    });
  }
}
