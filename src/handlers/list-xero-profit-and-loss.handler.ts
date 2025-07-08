import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { ReportWithRow } from "xero-node";
import { z } from "zod";
import { CreateXeroTool } from "../helpers/create-xero-tool.js";

// Define the valid timeframe options
type TimeframeType = "MONTH" | "QUARTER" | "YEAR" | undefined;

/**
 * Internal function to fetch profit and loss data from Xero
 */
async function fetchProfitAndLoss(
  fromDate?: string,
  toDate?: string,
  periods?: number,
  timeframe?: TimeframeType,
  standardLayout?: boolean,
  paymentsOnly?: boolean,
): Promise<ReportWithRow | null> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getReportProfitAndLoss(
    xeroClient.tenantId,
    fromDate,
    toDate,
    periods,
    timeframe,
    undefined, // trackingCategoryID
    undefined, // trackingOptionID
    undefined, // trackingCategoryID2
    undefined, // trackingOptionID2
    standardLayout,
    paymentsOnly,
    getClientHeaders(),
  );

  return response.body.reports?.[0] ?? null;
}

/**
 * List profit and loss report from Xero
 * @param fromDate Optional start date for the report (YYYY-MM-DD)
 * @param toDate Optional end date for the report (YYYY-MM-DD)
 * @param periods Optional number of periods for the report
 * @param timeframe Optional timeframe for the report (MONTH, QUARTER, YEAR)
 * @param trackingCategoryID Optional tracking category ID
 * @param trackingOptionID Optional tracking option ID
 * @param trackingCategoryID2 Optional second tracking category ID
 * @param trackingOptionID2 Optional second tracking option ID
 * @param standardLayout Optional boolean to use standard layout
 * @param paymentsOnly Optional boolean to include only accounts with payments
 */
export async function listXeroProfitAndLoss(
  fromDate?: string,
  toDate?: string,
  periods?: number,
  timeframe?: TimeframeType,
  standardLayout?: boolean,
  paymentsOnly?: boolean,
): Promise<XeroClientResponse<ReportWithRow>> {
  try {
    const profitAndLoss = await fetchProfitAndLoss(
      fromDate,
      toDate,
      periods,
      timeframe,
      paymentsOnly,
    );

    if (!profitAndLoss) {
      return {
        result: null,
        isError: true,
        error: "Failed to fetch profit and loss data from Xero.",
      };
    }

    return {
      result: profitAndLoss,
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

/**
 * Helper to calculate the number of months between two dates (inclusive of start month).
 */
function calculatePeriods(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return (
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1
  );
}

const ListProfitAndLossTool = CreateXeroTool(
  "list-profit-and-loss",
  "Lists profit and loss report in Xero. This provides a summary of revenue, expenses, and profit or loss over a specified period of time.",
  {
    fromDate: z.string().describe("Start date in YYYY-MM-DD format"),
    endDate: z
      .string()
      .optional()
      .describe(
        "End date in YYYY-MM-DD format (optional, if provided, periods will be calculated)",
      ),
    periods: z
      .number()
      .optional()
      .describe("Number of periods (optional, overrides endDate if provided)"),
    timeframe: z
      .enum(["MONTH", "QUARTER", "YEAR"])
      .optional()
      .describe(
        "Timeframe for the report (MONTH, QUARTER, YEAR, default MONTH)",
      ),
    standardLayout: z
      .boolean()
      .optional()
      .describe("Optional flag to use standard layout"),
    paymentsOnly: z
      .boolean()
      .optional()
      .describe("Optional flag to include only accounts with payments"),
  },
  async ({
    fromDate,
    endDate,
    periods,
    timeframe,
    standardLayout,
    paymentsOnly,
  }) => {
    let calculatedPeriods = periods;
    const tf = timeframe ?? "MONTH";
    if (!periods && endDate) {
      calculatedPeriods =
        tf === "MONTH"
          ? calculatePeriods(fromDate, endDate)
          : new Date(endDate).getFullYear() -
            new Date(fromDate).getFullYear() +
            1;
    }
    const response = await listXeroProfitAndLoss(
      fromDate,
      undefined, // toDate is not used when periods/timeframe are set
      calculatedPeriods,
      tf,
      standardLayout,
      paymentsOnly,
    );

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing profit and loss report: ${response.error}`,
          },
        ],
      };
    }

    const profitAndLossReport = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(profitAndLossReport, null, 2),
        },
      ],
    };
  },
);

export default ListProfitAndLossTool;
