import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroProfitAndLoss } from "../../handlers/list-xero-profit-and-loss.handler.js";
import { listXeroBudgetSummary } from "../../handlers/list-xero-budget-summary.handler.js";

/**
 * This tool compares actual and budgeted values for a given metric (e.g., Net Profit, Revenue, Expenses) period-by-period (e.g., by month).
 * It aligns periods and ensures missing actuals or budgets are shown as null.
 */
const PeriodicActualVsBudgetTool = CreateXeroTool(
  "periodic-actual-vs-budget",
  "Compares actual and budgeted values for a given metric (e.g., Net Profit, Revenue, Expenses) for each period (month, quarter, or year) in the specified range. Returns an array of objects with period, actual, and budgeted values.",
  {
    metric: z
      .string()
      .describe(
        "The metric to compare (e.g., 'Net Profit', 'Revenue', 'Expenses'). Case-insensitive, matches section title in Xero report.",
      ),
    fromDate: z
      .string()
      .optional()
      .describe(
        "Start date in YYYY-MM-DD format (default: first day of current month)",
      ),
    toDate: z
      .string()
      .optional()
      .describe(
        "End date in YYYY-MM-DD format (default: last day of current month)",
      ),
    periods: z
      .number()
      .optional()
      .describe("Number of periods to compare (optional)"),
    timeframe: z
      .enum(["MONTH", "QUARTER", "YEAR"])
      .optional()
      .describe("Period type (MONTH, QUARTER, YEAR; default MONTH)"),
    standardLayout: z
      .boolean()
      .optional()
      .describe("Use standard layout (optional)"),
    paymentsOnly: z
      .boolean()
      .optional()
      .describe("Include only accounts with payments (optional)"),
  },
  async (args) => {
    // Set defaults
    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const defaultToStr = defaultTo.toISOString().slice(0, 10);
    const fromDate = args.fromDate || defaultFrom;
    const toDate = args.toDate || defaultToStr;
    const timeframe = args.timeframe || "MONTH";

    // Fetch actuals (P&L)
    const actualResp = await listXeroProfitAndLoss(
      fromDate,
      toDate,
      args.periods,
      timeframe,
      args.standardLayout,
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
    const actualReport = actualResp.result;

    // Fetch budget
    const budgetResp = await listXeroBudgetSummary(
      fromDate,
      args.periods,
      timeframe === "YEAR" ? "YEAR" : "MONTH", // Budget summary only supports MONTH or YEAR
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
    const budgetReport = budgetResp.result?.[0];

    // Helper: extract period values for a section title
    function extractPeriodValues(
      report: any,
      sectionTitle: string,
    ): Record<string, number | null> {
      const result: Record<string, number | null> = {};
      if (!report?.rows) return result;
      const section = report.rows.find(
        (row: any) =>
          row.rowType === "Section" &&
          typeof row.title === "string" &&
          row.title.toLowerCase().includes(sectionTitle.toLowerCase()),
      );
      if (!section || !Array.isArray(section.rows)) return result;
      for (const row of section.rows) {
        if (
          row.rowType === "Row" &&
          Array.isArray(row.cells) &&
          row.cells.length > 1
        ) {
          // Assume first cell is label (period), second is value
          const period = row.cells[0]?.value;
          const value = row.cells[1]?.value
            ? parseFloat(String(row.cells[1].value).replace(/[^0-9.-]+/g, ""))
            : null;
          if (period) result[period] = value;
        }
      }
      return result;
    }

    // Extract period values for the requested metric
    const actualPeriods = extractPeriodValues(actualReport, args.metric);
    const budgetPeriods = extractPeriodValues(budgetReport, args.metric);
    // Union of all periods
    const allPeriods = Array.from(
      new Set([...Object.keys(actualPeriods), ...Object.keys(budgetPeriods)]),
    );
    // Build result array
    const comparison = allPeriods.map((period) => ({
      period,
      actual: period in actualPeriods ? actualPeriods[period] : null,
      budgeted: period in budgetPeriods ? budgetPeriods[period] : null,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(comparison, null, 2),
        },
      ],
    };
  },
);

export default PeriodicActualVsBudgetTool;
