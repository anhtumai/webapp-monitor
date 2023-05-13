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

  const keyConditionExpressionTerms = ["#url = :url"];
  const expressionAttributeNames: Record<string, string> = { "#url": "url" };
  const expressionAttributeValues: Record<string, string> = { ":url": url };

  if (typeof start === "string") {
    keyConditionExpressionTerms.push("#time >= :start");
    expressionAttributeNames["#time"] = "time";
    expressionAttributeValues[":start"] = start;
  }

  if (typeof end === "string") {
    keyConditionExpressionTerms.push("#time <= :end");
    expressionAttributeNames["#time"] = "time";
    expressionAttributeValues[":end"] = end;
  }

  const queryCommandInput: QueryCommandInput = {
    TableName: LOG_SAVING_TABLE_NAME,
    KeyConditionExpression: keyConditionExpressionTerms.join(" and "),
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
