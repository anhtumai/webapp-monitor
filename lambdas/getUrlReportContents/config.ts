export const LOG_SAVING_TABLE_NAME =
  process.env.LOG_SAVING_TABLE_NAME || "web-monitor-table";

export const LOG_SAVING_REGIONS =
  process.env.LOG_SAVING_REGIONS?.split(",") || [];
