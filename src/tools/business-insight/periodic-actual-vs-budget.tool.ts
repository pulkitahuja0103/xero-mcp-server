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
    let periods = args.periods;
    const timeframe = args.timeframe || "MONTH";

    // If user requests a range over multiple months/quarters/years and periods is not set, calculate periods
    if (!periods && fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
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
      } else if (timeframe === "YEAR") {
        periods = end.getFullYear() - start.getFullYear() + 1;
      }
    }

    // Fetch actuals (P&L)
    const actualResp = await listXeroProfitAndLoss(
      fromDate,
      toDate,
      periods,
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

    // Transform cumulative actuals to period-specific values for Operating Expenses
    function getPeriodActuals(report: any, metricName: any) {
      // Find the section for the metric (e.g., 'Operating Expenses')
      const section = report?.rows?.find(
        (row) => row?.title?.toLowerCase() === metricName.toLowerCase(),
      );
      if (!section || !section.rows) return [];
      // Get cumulative values for each period
      const cumulative = section.rows.map((row) => {
        const cell = row.cells?.[0];
        return cell ? Number(cell.value) : null;
      });
      // Convert cumulative to period-specific
      const periodActuals = cumulative.map((val, idx) => {
        if (val === null) return null;
        if (idx === 0) return val;
        const prev = cumulative[idx - 1];
        return prev !== null ? val - prev : val;
      });
      return periodActuals;
    }

    // Fetch budget
    const budgetResp = await listXeroBudgetSummary(
      fromDate,
      periods,
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

    // Extract period labels
    const periodLabels =
      actualReport?.rows
        ?.find((row) => row?.title?.toLowerCase() === args.metric.toLowerCase())
        ?.rows?.map((row) => row?.title) || [];

    // Get actuals and budgeted values
    const actuals = getPeriodActuals(actualReport, args.metric);
    const budgeted =
      budgetReport?.rows
        ?.find((row) => row?.title?.toLowerCase() === args.metric.toLowerCase())
        ?.cells?.map((cell) => Number(cell.value)) || [];

    // Build result array
    const result = periodLabels.map((label, idx) => {
      const actual = actuals[idx] ?? null;
      const budget = budgeted[idx] ?? null;
      return {
        Month: label,
        "Actual Operating Expenses": actual,
        "Budgeted Operating Expenses": budget,
        "Variance (Actual - Budgeted)":
          actual !== null && budget !== null ? actual - budget : null,
      };
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

export default PeriodicActualVsBudgetTool;
