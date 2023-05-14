import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import {
  DynamoDBDocumentClient,
  QueryCommandInput,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import { LOG_SAVING_REGIONS, LOG_SAVING_TABLE_NAME } from "./config";

type GetLogContentsQueryParams = {
  url: string;
  region: string;
  limit?: number;
  start?: string;
  end?: string;
};

function validateEventQueryStringParameters(
  queryStringParameters: Record<string, string | undefined> | null | undefined,
): { data: GetLogContentsQueryParams } | { error: string } {
  if (!queryStringParameters) {
    return { error: "query string params is empty" };
  }

  const { url, region, limit, start, end } = queryStringParameters;

  if (typeof url !== "string") {
    return { error: "`url` query param is missing" };
  }

  if (typeof region !== "string") {
    return { error: "`region` query param is missing" };
  }

  if (!LOG_SAVING_REGIONS.includes(region)) {
    return {
      error: `region ${region} is not supported. Supported regions: ${LOG_SAVING_REGIONS}`,
    };
  }

  if (typeof limit === "string" && Number.isNaN(Number(limit))) {
    return {
      error: "`limit` query param must be a valid number",
    };
  }

  if (typeof start === "string") {
    if (isNaN(Date.parse(start))) {
      return {
        error:
          "`start` must be in ISO 8601 datetime format (exp: 2023-01-01 or 2023-01-01T00:00:00.000Z)",
      };
    }
  }

  if (typeof end === "string") {
    if (isNaN(Date.parse(end))) {
      return {
        error:
          "`end` must be in ISO 8601 datetime format (exp: 2023-01-01 or 2023-01-01T00:00:00.000Z)",
      };
    }
  }

  if (typeof start === "string" && typeof end === "string") {
    if (end <= start) {
      return {
        error: "`start` param must be smaller than `end` param",
      };
    }
  }

  return {
    data: {
      url,
      region,
      limit: limit ? Number(limit) : undefined,
      start,
      end,
    },
  };
}

export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const validateQueryParamsResponse = validateEventQueryStringParameters(
    event.queryStringParameters,
  );

  if ("error" in validateQueryParamsResponse) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: validateQueryParamsResponse.error,
      }),
    };
  }

  const { url, region, limit, start, end } = validateQueryParamsResponse.data;

  const urlKeyConditionTerm = "#url = :url";
  const expressionAttributeNames: Record<string, string> = { "#url": "url" };
  const expressionAttributeValues: Record<string, string> = { ":url": url };

  if (typeof start === "string") {
    expressionAttributeNames["#time"] = "time";
    expressionAttributeValues[":start"] = start;
  }

  if (typeof end === "string") {
    expressionAttributeNames["#time"] = "time";
    expressionAttributeValues[":end"] = end;
  }

  const keyConditionExpression = (() => {
    if (typeof start === "string" && typeof end === "string") {
      return `${urlKeyConditionTerm} and #time BETWEEN :start AND :end`;
    }

    if (typeof start === "string") {
      return `${urlKeyConditionTerm} and #time >= :start`;
    }

    if (typeof end === "string") {
      return `${urlKeyConditionTerm} and #time <= :end`;
    }

    return urlKeyConditionTerm;
  })();

  const queryCommandInput: QueryCommandInput = {
    TableName: LOG_SAVING_TABLE_NAME,
    KeyConditionExpression: keyConditionExpression,
    Limit: limit ? Number(limit) : undefined,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ScanIndexForward: false,
  };

  console.log("Query Command Input", queryCommandInput);

  const ddbClient = new DynamoDBClient({ region });
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

  const queryCommandOutput = await ddbDocClient.send(
    new QueryCommand(queryCommandInput),
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      items: queryCommandOutput.Items ?? [],
    }),
  };
}
