import * as http from "http";

import got from "got";

export async function handler(event: any) {
  const appConfigData = await got
    .get(process.env.APP_CONFIG_DEPLOYMENT_URI || "")
    .json();

  console.log(appConfigData);
}
