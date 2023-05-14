import got, { Response } from "got";

import { DomUtils, parseDocument } from "htmlparser2";

import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  AppConfigDataClient,
  StartConfigurationSessionCommand,
  GetLatestConfigurationCommand,
} from "@aws-sdk/client-appconfigdata";

import {
  APP_CONFIG_REGION,
  APP_CONFIG_APPLICATION_ID,
  APP_CONFIG_ENVIRONMENT_ID,
  APP_CONFIG_CONFIGURATION_PROFILE_ID,
  WEB_MONITOR_DYNAMODB,
  WEB_MONITOR_DYNAMODB_REGION,
} from "./config";

type WebMonitorConfig = {
  url: string;
  rules: WebMonitorRule[];
};

type WebMonitorRule = ContainTextRule | object;

type ContainTextRule = {
  containText: string;
};

/**
 * Rule evaluation output
 * rule (WebMonitorRule): web monitor rule from configuration
 * passed (boolean): whether HTML response matches the rule or not
 * knownRule (boolean): whether the backend knows about this rule.
 *
 * If `knownRule` is `false`, `passed` is also `false`
 */
type RuleEvaluationOutput = {
  rule: WebMonitorRule;
  passed: boolean;
  knownRule: boolean;
};

type ReportContentOutput = {
  url: string;
  statusCode: number;
  startTime: string;
  elapsedDurationInMs?: number;

  rulesEvaluation: RuleEvaluationOutput[];
};

const appConfigDataClient = new AppConfigDataClient({
  region: APP_CONFIG_REGION,
});

const ddbClient = new DynamoDBClient({ region: WEB_MONITOR_DYNAMODB_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

function getElapsedDurationInMs(response: Response) {
  const { timings } = response;

  if (typeof timings.end === "number") {
    return timings.end - timings.start;
  }

  if (typeof timings.error === "number") {
    return timings.error - timings.start;
  }

  if (typeof timings.abort === "number") {
    return timings.abort - timings.start;
  }

  return undefined;
}

function isContainTextRule(rule: WebMonitorRule): rule is ContainTextRule {
  return "containText" in rule && typeof rule.containText === "string";
}

function evaluateRules({
  rules,
  response,
}: {
  rules: WebMonitorRule[];
  response: Response<string>;
}): RuleEvaluationOutput[] {
  const dom = parseDocument(response.body);

  return rules.map((rule) => {
    if (isContainTextRule(rule)) {
      const passed =
        DomUtils.innerText(dom.children).indexOf(rule.containText) > -1;
      return {
        rule,
        passed,
        knownRule: true,
      };
    }

    return {
      rule,
      passed: false,
      knownRule: false,
    };
  });
}

/*
 * Send a GET request to an url, check the response status code and measure elapsed time taken for the server to fulfil a request
 * Parse their HTML response into DOM tree and check if it matches specified rules.
 *
 * Summarise these pieces of information into an object and return it.
 */
async function monitorWebsite(
  webMonitorConfig: WebMonitorConfig,
): Promise<ReportContentOutput> {
  const response = await got.get(webMonitorConfig.url);

  const elapsedDurationInMs = getElapsedDurationInMs(response);

  const statusCode = response.statusCode;

  const startTime = new Date(response.timings.start).toISOString();

  const rules = webMonitorConfig.rules;

  if (!response.ok) {
    return {
      url: webMonitorConfig.url,
      statusCode,
      startTime,
      elapsedDurationInMs,
      rulesEvaluation: [],
    };
  }

  return {
    url: webMonitorConfig.url,
    statusCode,
    startTime,
    elapsedDurationInMs,
    rulesEvaluation: evaluateRules({ rules, response }),
  };
}

async function putReportContentInDBTable(
  reportContentOutput: ReportContentOutput,
) {
  await ddbDocClient.send(
    new PutCommand({
      TableName: WEB_MONITOR_DYNAMODB,
      Item: {
        url: reportContentOutput.url,
        time: reportContentOutput.startTime,
        reportContent: reportContentOutput,
      },
    }),
  );
}

async function getConfigurationFromAppConfig(): Promise<WebMonitorConfig[]> {
  const startConfigurationSessionResponse = await appConfigDataClient.send(
    new StartConfigurationSessionCommand({
      ApplicationIdentifier: APP_CONFIG_APPLICATION_ID,
      EnvironmentIdentifier: APP_CONFIG_ENVIRONMENT_ID,
      ConfigurationProfileIdentifier: APP_CONFIG_CONFIGURATION_PROFILE_ID,
    }),
  );

  const getLatestConfigurationResponse = await appConfigDataClient.send(
    new GetLatestConfigurationCommand({
      ConfigurationToken:
        startConfigurationSessionResponse.InitialConfigurationToken,
    }),
  );

  const plainTextConfiguration = new TextDecoder().decode(
    getLatestConfigurationResponse.Configuration,
  );

  return JSON.parse(plainTextConfiguration);
}

export async function handler(event: any) {
  const appConfigData = await getConfigurationFromAppConfig();
  await Promise.all(
    appConfigData.map(async (webMonitorConfig) => {
      try {
        const reportContentOutput = await monitorWebsite(webMonitorConfig);
        await putReportContentInDBTable(reportContentOutput);
      } catch (error) {
        console.error(
          `Fail to monitor and check response of config ${webMonitorConfig}`,
        );
        console.error(error);
      }
    }),
  );
}
