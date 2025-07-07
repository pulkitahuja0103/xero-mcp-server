import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroBudgetSummary } from "../../handlers/list-xero-budget-summary.handler.js";

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

const ListBudgetSummaryTool = CreateXeroTool(
  "list-budget-summary",
  "List the Budget Summary report from Xero for a given start date, end date (optional), period (optional), and timeframe (optional, default MONTH).",
  {
    date: z.string().describe("Start date in YYYY-MM-DD format"),
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
      .enum(["MONTH", "YEAR"])
      .optional()
      .describe("Period type (MONTH or YEAR, default MONTH)"),
  },
  async ({ date, endDate, periods, timeframe }) => {
    let calculatedPeriods = periods;
    const tf = timeframe ?? "MONTH";
    if (!periods && endDate) {
      // Only calculate periods if periods is not provided and endDate is provided
      calculatedPeriods =
        tf === "MONTH"
          ? calculatePeriods(date, endDate)
          : new Date(endDate).getFullYear() - new Date(date).getFullYear() + 1;
    }
    const response = await listXeroBudgetSummary(date, calculatedPeriods, tf);
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing budget summary: ${response.error}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response.result, null, 2),
        },
      ],
    };
  },
);

export default ListBudgetSummaryTool;
