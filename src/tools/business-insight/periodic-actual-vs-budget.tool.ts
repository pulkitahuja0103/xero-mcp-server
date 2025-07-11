import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroProfitAndLoss } from "../../handlers/list-xero-profit-and-loss.handler.js";
import { listXeroBudgetSummary } from "../../handlers/list-xero-budget-summary.handler.js";
import { ReportWithRow, ReportRow, ReportCell } from "xero-node";

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

    // Extract and de-cumulate actuals for the requested metric
    function getSectionRows(
      report: ReportWithRow | null,
      metric: string,
    ): ReportRow[] {
      if (!report?.rows) return [];
      const section = report.rows.find(
        (row: ReportRow) =>
          (row.rowType as unknown as string) === "Section" &&
          row.title?.toLowerCase() === metric.toLowerCase(),
      );
      if (!section?.rows) return [];
      return section.rows.filter(
        (row: ReportRow) => (row.rowType as unknown as string) === "Row",
      );
    }

    function getPeriodValues(row: ReportRow): number[] {
      return (
        row.cells?.map((cell: ReportCell) => {
          if (typeof cell.value === "number") return cell.value;
          if (typeof cell.value === "string" && cell.value !== undefined)
            return parseFloat(cell.value);
          return 0;
        }) || []
      );
    }

    // Find the section for the requested metric (e.g., Operating Expenses)
    const actualRows = getSectionRows(actualReport, args.metric);
    const cumulative: number[] = [];
    for (const row of actualRows) {
      const vals = getPeriodValues(row);
      vals.forEach((v: number, i: number) => {
        cumulative[i] = (cumulative[i] || 0) + v;
      });
    }
    // Convert cumulative to period-by-period (monthly) values
    const actualPeriodValues: number[] = cumulative.map((v, i, arr) =>
      i === 0 ? v : v - arr[i - 1],
    );

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

    // Extract budgeted values for the metric
    function getBudgetSectionRows(
      report: ReportWithRow | null,
      metric: string,
    ): ReportRow[] {
      if (!report?.rows) return [];
      const section = report.rows.find(
        (row: ReportRow) =>
          (row.rowType as unknown as string) === "Section" &&
          row.title?.toLowerCase() === metric.toLowerCase(),
      );
      if (!section?.rows) return [];
      return section.rows.filter(
        (row: ReportRow) => (row.rowType as unknown as string) === "Row",
      );
    }
    const budgetRows = getBudgetSectionRows(budgetReport, args.metric);
    const budgetValues: number[] = [];
    for (const row of budgetRows) {
      const vals = getPeriodValues(row);
      vals.forEach((v: number, i: number) => {
        budgetValues[i] = (budgetValues[i] || 0) + v;
      });
    }

    // Get period labels from actualReport (Xero P&L report uses columns[0].cells for period titles)
    let periodsArr: string[] = [];
    if (actualReport?.rows?.length) {
      const headerRow = actualReport.rows.find(
        (row: ReportRow) => (row.rowType as unknown as string) === "Header",
      );
      if (headerRow && headerRow.cells) {
        periodsArr = headerRow.cells.map((cell: ReportCell) =>
          String(cell.value),
        );
      }
    }
    // Fallback: use index as period if no header found
    if (!periodsArr.length) {
      periodsArr = actualPeriodValues.map((_, i) => `Period ${i + 1}`);
    }

    const result = periodsArr.map((period, i) => ({
      period,
      actual: actualPeriodValues[i] ?? null,
      budgeted: budgetValues[i] ?? null,
    }));

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
