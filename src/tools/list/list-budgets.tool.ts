import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroBudgetSummary } from "../../handlers/list-xero-budget-summary.handler.js";

const ListBudgetSummaryTool = CreateXeroTool(
  "list-budget-summary",
  "List the Budget Summary report from Xero for a given start date, period, and timeframe.",
  {
    date: z.string().describe("Start date in YYYY-MM-DD format"),
    periods: z.number().optional().describe("Number of periods (default 1)"),
    timeframe: z
      .enum(["MONTH", "YEAR"])
      .optional()
      .describe("Period type (MONTH or YEAR, default MONTH)"),
  },
  async ({ date, periods, timeframe }) => {
    const response = await listXeroBudgetSummary(date, periods, timeframe);
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
