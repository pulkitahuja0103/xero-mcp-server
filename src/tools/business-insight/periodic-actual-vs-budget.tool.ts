import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroProfitAndLoss } from "../../handlers/list-xero-profit-and-loss.handler.js";
import { listXeroBudgetSummary } from "../../handlers/list-xero-budget-summary.handler.js";

const PeriodicActualVsBudgetTool = CreateXeroTool(
  "periodic-actual-vs-budget",
  "Compares actual and budgeted values for a given metric (e.g., Net Profit, Revenue, Expenses) for each period (month, quarter, or year) in the specified range. Returns an array of objects with period, actual, and budgeted values.",
  {
    metric: z.string().describe("Metric to compare (e.g., 'Net Profit')"),
    fromDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
    toDate: z.string().optional().describe("End date in YYYY-MM-DD format"),
    periods: z.number().optional(),
    timeframe: z.enum(["MONTH", "QUARTER", "YEAR"]).optional(),
    standardLayout: z.boolean().optional(),
    paymentsOnly: z.boolean().optional(),
  },
  async (args) => {
    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const defaultToStr = defaultTo.toISOString().slice(0, 10);
    const fromDate = args.fromDate || defaultFrom;
    const toDate = args.toDate || defaultToStr;
    const timeframe = args.timeframe || "MONTH";

    // Calculate periods if not provided
    let periods = args.periods;
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

    // Get actuals
    const actualResp = await listXeroProfitAndLoss(
      fromDate,
      toDate,
      periods,
      timeframe,
      true, // force standard layout for easier parsing
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

    // Get budgets
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
    const budgetReport = budgetResp.result?.[0];

    const targetMetric = args.metric.toLowerCase();

    const actualRow = actualReport?.rows?.find(
      (row) =>
        typeof row.rowType === "string" &&
        row.rowType === "Section" &&
        row.title?.toLowerCase() === targetMetric,
    );

    const actualValues = actualRow?.rows?.[0]?.cells?.map((cell) =>
      parseFloat(cell.value ?? "0"),
    );

    const actualByPeriod = actualValues?.map((val, i, arr) =>
      i === 0 ? val : val - arr[i - 1],
    );

    const budgetRow = budgetReport?.rows?.find(
      (row: any) => row.rowType === "Row" && row.cells?.length,
    );
    const budgetByPeriod = budgetRow?.cells?.map((cell: any) =>
      parseFloat(cell.value ?? "0"),
    );

    // Format period strings
    const startDate = new Date(fromDate);
    const periodsList = [...Array(periods || 0)].map((_, i) => {
      const date = new Date(startDate);
      if (timeframe === "MONTH") date.setMonth(date.getMonth() + i);
      else if (timeframe === "QUARTER") date.setMonth(date.getMonth() + i * 3);
      else if (timeframe === "YEAR") date.setFullYear(date.getFullYear() + i);
      return date.toISOString().slice(0, 7); // YYYY-MM
    });

    const finalResult = periodsList.map((period, i) => ({
      period,
      actual: actualByPeriod?.[i] ?? null,
      budget: budgetByPeriod?.[i] ?? null,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(finalResult, null, 2),
        },
      ],
    };
  },
);

export default PeriodicActualVsBudgetTool;
