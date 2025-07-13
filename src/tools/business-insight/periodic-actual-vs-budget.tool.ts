import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroProfitAndLoss } from "../../handlers/list-xero-profit-and-loss.handler.js";
import { listXeroBudgetSummary } from "../../handlers/list-xero-budget-summary.handler.js";

/**
 * Utility: Convert cumulative array to period-wise values
 */
function toPeriodWise(cumulative: number[]): number[] {
  return cumulative.map((val, idx) =>
    idx === 0 ? val : val - cumulative[idx - 1],
  );
}

/**
 * Utility: Extract numeric values for the metric from report section
 */
function extractMetricValues(report: any, metric: string): number[] {
  const section = report?.rows?.find((r: any) => r.rows);
  const targetRow = section?.rows?.find(
    (row: any) => row.title?.toLowerCase() === metric.toLowerCase(),
  );

  if (!targetRow?.cells) return [];
  return targetRow.cells.map((c: any) => parseFloat(c.value || "0"));
}

/**
 * This tool compares actual and budgeted values for a given metric.
 */
const PeriodicActualVsBudgetTool = CreateXeroTool(
  "periodic-actual-vs-budget",
  "Compares actual and budgeted values for a given metric (e.g., 'Net Profit', 'Revenue', 'Expenses') for each period (month, quarter, or year).",
  {
    metric: z
      .string()
      .describe(
        "Metric to compare, like 'Revenue' or 'Net Profit'. Case-insensitive.",
      ),
    fromDate: z
      .string()
      .optional()
      .describe("Start date in YYYY-MM-DD format."),
    toDate: z.string().optional().describe("End date in YYYY-MM-DD format."),
    periods: z.number().optional().describe("Number of periods to compare."),
    timeframe: z
      .enum(["MONTH", "QUARTER", "YEAR"])
      .optional()
      .describe("Time unit to break into periods."),
    standardLayout: z.boolean().optional(),
    paymentsOnly: z.boolean().optional(),
  },
  async (args) => {
    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const fromDate = args.fromDate || defaultFrom;
    const timeframe = args.timeframe || "MONTH";

    // === Calculate periods ===
    let periods = args.periods;
    if (!periods && args.fromDate && args.toDate) {
      const start = new Date(args.fromDate);
      const end = new Date(args.toDate);
      if (timeframe === "MONTH") {
        periods =
          (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth()) +
          1;
      } else if (timeframe === "QUARTER") {
        periods =
          (end.getFullYear() - start.getFullYear()) * 4 +
          (Math.floor(end.getMonth() / 3) - Math.floor(start.getMonth() / 3)) +
          1;
      } else {
        periods = end.getFullYear() - start.getFullYear() + 1;
      }
    }

    // === Fetch actuals (cumulative) ===
    const actualResp = await listXeroProfitAndLoss(
      fromDate,
      undefined, // skip toDate
      periods,
      timeframe,
      args.standardLayout ?? true,
      args.paymentsOnly,
    );

    if (actualResp.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching actuals: ${actualResp.error}`,
          },
        ],
      };
    }

    const cumulativeActuals = extractMetricValues(
      actualResp.result,
      args.metric,
    );
    const periodActuals = toPeriodWise(cumulativeActuals);

    // === Fetch budget (already period-wise) ===
    const budgetResp = await listXeroBudgetSummary(
      fromDate,
      periods,
      timeframe === "YEAR" ? "YEAR" : "MONTH",
    );

    if (budgetResp.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching budget: ${budgetResp.error}`,
          },
        ],
      };
    }

    const budgetRow = budgetResp.result?.[0]?.Rows?.find(
      (r: any) =>
        r.RowType === "Row" &&
        r.Cells?.some(
          (c: any) =>
            (c.Value || "").toLowerCase() === args.metric.toLowerCase(),
        ),
    );
    const budgetValues =
      budgetRow?.Cells?.filter((c: any) => !isNaN(parseFloat(c.Value)))?.map(
        (c: any) => parseFloat(c.Value),
      ) || [];

    // === Final output ===
    const output = Array.from(
      { length: Math.max(periodActuals.length, budgetValues.length) },
      (_, i) => ({
        period: i + 1,
        actual: periodActuals[i] ?? null,
        budgeted: budgetValues[i] ?? null,
      }),
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  },
);

export default PeriodicActualVsBudgetTool;
