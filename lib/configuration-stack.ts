import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as appconfig from "aws-cdk-lib/aws-appconfig";

class AppConfigConstruct extends Construct {
  readonly applicationId: string;
  readonly environmentId: string;
  readonly configurationProfileId: string;
  constructor(scope: Construct) {
    const id = "web-monitor-app-config";
    super(scope, id);

    const webMonitorAppConfigApp = new appconfig.CfnApplication(
      this,
      "web-monitor-app-config-app",
      {
        name: "web-monitor-app-config-app",
      },
    );

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

    const webMonitorAppConfigEnv = new appconfig.CfnEnvironment(
      this,
      "web-monitor-app-config-env",
      {
        applicationId: webMonitorAppConfigApp.ref,
        name: "Production",
      },
    );

    const webMonitorAppConfigProfile = new appconfig.CfnConfigurationProfile(
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
                required: ["url", "rules"],
                additionalProperties: false,
                properties: {
                  url: { type: "string" },
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

    const webMonitorConfigVersion = new appconfig.CfnHostedConfigurationVersion(
      this,
      "web-monitor-hosted-configuration-version",
      {
        applicationId: webMonitorAppConfigApp.ref,
        configurationProfileId: webMonitorAppConfigProfile.ref,
        contentType: "application/json",
        content: JSON.stringify("[]"),
      },
    );

    //const webMonitorDeployment = new appconfig.CfnDeployment(
    //this,
    //"web-monitor-config-deployment",
    //{
    //applicationId: webMonitorAppConfigApp.ref,
    //configurationProfileId: webMonitorAppConfigProfile.ref,
    //configurationVersion: webMonitorConfigVersion.ref,
    //deploymentStrategyId: immediateDeploymentStrategy.ref,
    //environmentId: webMonitorAppConfigEnv.ref,
    //},
    //);
    //
    this.applicationId = webMonitorAppConfigApp.ref;
    this.environmentId = webMonitorAppConfigEnv.ref;
    this.configurationProfileId = webMonitorAppConfigProfile.ref;
  }
}

export class ConfigurationStack extends Stack {
  readonly appConfig: {
    readonly applicationId: string;
    readonly environmentId: string;
    readonly configurationProfileId: string;
    readonly region: string;
  };

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const webMonitorAppConfig = new AppConfigConstruct(this);

    this.appConfig = {
      applicationId: webMonitorAppConfig.applicationId,
      environmentId: webMonitorAppConfig.environmentId,
      configurationProfileId: webMonitorAppConfig.configurationProfileId,
      region: this.region,
    };
  }
}
