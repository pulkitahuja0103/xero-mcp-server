import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

/**
 * Fetches the Budget Summary report from Xero.
 * @param date The start date for the report (YYYY-MM-DD)
 * @param periods Number of periods to report on (e.g., 1 for a month, 12 for a year)
 * @param timeframe "MONTH" or "YEAR"
 */
export async function listXeroBudgetSummary(
  date: string,
  periods: number = 1,
  timeframe: "MONTH" | "YEAR" = "MONTH",
): Promise<XeroClientResponse<any>> {
  try {
    await xeroClient.authenticate();
    // Map timeframe string to number as required by SDK
    const timeframeNumber = timeframe === "YEAR" ? 2 : 1;
    const response = await xeroClient.accountingApi.getReportBudgetSummary(
      xeroClient.tenantId,
      date,
      periods,
      timeframeNumber,
      getClientHeaders(),
    );
    return {
      result: response.body?.reports ?? [],
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
