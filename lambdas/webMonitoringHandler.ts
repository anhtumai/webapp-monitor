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
  AWS_REGION,
  WEB_MONITOR_DYNAMODB,
  WEB_MONITOR_DYNAMODB_REGION,
} from "./config";

type WebMonitorConfig = {
  url: string;
  request: "GET" | "POST" | "PUT" | "DELETE";
  rules: WebMonitorRule[];
};

type WebMonitorRule = ContainTextRule | object;

type ContainTextRule = {
  containText: string;
};

type RuleEvaluationOutput = {
  rule: WebMonitorRule;
  passed: boolean;
  knownRule: boolean;
};

type LogOutput = {
  url: string;
  statusCode: number;
  startTime: string;
  elapsedDurationInMs?: number;

  rulesEvaluation: RuleEvaluationOutput[];
};

const appConfigDataClient = new AppConfigDataClient({ region: "eu-central-1" });

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

async function monitorOneWebsite(
  webMonitorConfig: WebMonitorConfig,
): Promise<LogOutput> {
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

async function writeToDb(logOutput: LogOutput) {
  await ddbDocClient.send(
    new PutCommand({
      TableName: WEB_MONITOR_DYNAMODB,
      Item: {
        url: logOutput.url,
        time: logOutput.startTime,
        logContent: JSON.stringify(logOutput),
      },
    }),
  );
}

async function getConfiguration(): Promise<WebMonitorConfig[]> {
  const startConfigurationSessionResponse = await appConfigDataClient.send(
    new StartConfigurationSessionCommand({
      ApplicationIdentifier: "1x588of",
      EnvironmentIdentifier: "lfouhv8",
      ConfigurationProfileIdentifier: "powaf3v",
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
  const appConfigData = await getConfiguration();
  await Promise.all(
    appConfigData.map(async (webMonitorConfig) => {
      const logOutput = await monitorOneWebsite(webMonitorConfig);
      await writeToDb(logOutput);
    }),
  );
}
