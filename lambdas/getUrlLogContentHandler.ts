import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import {
  DynamoDBDocumentClient,
  QueryCommandInput,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import { WEB_MONITOR_DYNAMODB, WEB_MONITOR_DYNAMODB_REGION } from "./config";

const ddbClient = new DynamoDBClient({ region: WEB_MONITOR_DYNAMODB_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const { url, latest, start, end } = event.queryStringParameters ?? {};

  if (typeof url !== "string") {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "`url` query param is missing",
      }),
    };
  }

  if (typeof latest === "string" && Number.isNaN(Number(latest))) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "`latest` query param must be a valid number",
      }),
    };
  }

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
    TableName: WEB_MONITOR_DYNAMODB,
    KeyConditionExpression: keyConditionExpressionTerms.join(" and "),
    Limit: latest ? Number(latest) : undefined,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ScanIndexForward: false,
  };

  console.log("Query Command Input", queryCommandInput);

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
