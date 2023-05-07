import got, { Response } from "got";

import { DomUtils, parseDOM } from "htmlparser2";

type DOM = ReturnType<typeof parseDOM>;

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
  dom,
}: {
  rules: WebMonitorRule[];
  response: Response;
  dom: DOM;
}): RuleEvaluationOutput[] {
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

  const dom = parseDOM(response.body);

  return {
    url: webMonitorConfig.url,
    statusCode,
    elapsedTime,
    rulesEvaluation: evaluateRules({ rules, dom, response }),
  };
}

export async function handler(event: any) {
  const appConfigData = await got
    .get(process.env.APP_CONFIG_DEPLOYMENT_URI || "")
    .json<WebMonitorConfig[]>();

  const logs = await Promise.all(
    appConfigData.map((webMonitorConfig) =>
      monitorOneWebsite(webMonitorConfig),
    ),
  );

  console.log("Logs", JSON.stringify(logs, undefined, 4));
}
