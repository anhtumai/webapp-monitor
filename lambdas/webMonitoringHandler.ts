import got, { Response } from "got";

import { DomUtils, parseDOM } from "htmlparser2";

import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  AWS_REGION,
  APP_CONFIG_DEPLOYMENT_URI,
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
  elapsedTime?: number;

  rulesEvaluation: RuleEvaluationOutput[];
};

const ddbClient = new DynamoDBClient({ region: WEB_MONITOR_DYNAMODB_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

function getElapsedTimeInMs(response: Response) {
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
  const dom = parseDOM(response.body);

  return rules.map((rule) => {
    if (isContainTextRule(rule)) {
      const passed = DomUtils.innerText(dom).indexOf(rule.containText) > -1;
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

  const elapsedTime = getElapsedTimeInMs(response);

  const statusCode = response.statusCode;

  const rules = webMonitorConfig.rules;

  if (!response.ok) {
    return {
      url: webMonitorConfig.url,
      statusCode,
      elapsedTime,
      rulesEvaluation: [],
    };
  }

  return {
    url: webMonitorConfig.url,
    statusCode,
    elapsedTime,
    rulesEvaluation: evaluateRules({ rules, response }),
  };
}

async function writeToDb(logOutput: LogOutput) {
  await ddbDocClient.send(
    new PutCommand({
      TableName: WEB_MONITOR_DYNAMODB,
      Item: {
        url: logOutput.url,
        time: new Date().toISOString(),
        logContent: JSON.stringify(logOutput),
      },
    }),
  );
}

export async function handler(event: any) {
  const appConfigData = await got
    .get(APP_CONFIG_DEPLOYMENT_URI)
    .json<WebMonitorConfig[]>();

  await Promise.all(
    appConfigData.map(async (webMonitorConfig) => {
      const logOutput = await monitorOneWebsite(webMonitorConfig);
      await writeToDb(logOutput);
    }),
  );
}
