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
  "Compares actual and budgeted values for every section (e.g., Revenue, Expenses, Net Profit, etc.) for each period (month, quarter, or year) in the specified range. Returns an object where each key is a section and the value is an array of objects with period, actual, and budgeted values.",
  {
    metric: z
      .string()
      .optional()
      .describe(
        "(Optional) The metric/section to compare (e.g., 'Net Profit', 'Revenue', 'Expenses'). If omitted or set to 'ALL', returns all sections. Case-insensitive, matches section title in Xero report.",
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

    // Helper: List all section titles
    function listSectionTitles(rows: any[]): string[] {
      if (!Array.isArray(rows)) return [];
      return rows.filter(r => r && r.rowType === "Section" && typeof r.title === "string").map(r => r.title);
    }

    // Helper: Extract period labels from section
    function extractPeriodLabels(section: any): string[] {
      if (!section || !Array.isArray(section.rows)) return [];
      for (const row of section.rows) {
        if (row && Array.isArray(row.cells) && row.cells.length > 1) {
          return row.cells.slice(1).map((c: any) => c.label || c.value || "");
        }
      }
      return [];
    }

    // Helper: Extract values for each period from section (sum all rows per period)
    function extractPeriodValues(section: any): (number | null)[] {
      if (!section || !Array.isArray(section.rows)) return [];
      let periodCount = 0;
      for (const row of section.rows) {
        if (row && Array.isArray(row.cells) && row.cells.length > 1) {
          periodCount = row.cells.length - 1;
          break;
        }
      }
      if (!periodCount) return [];
      const sums = Array(periodCount).fill(0);
      let found = false;
      for (const row of section.rows) {
        if (row && Array.isArray(row.cells) && row.cells.length === periodCount + 1) {
          found = true;
          for (let i = 0; i < periodCount; ++i) {
            const val = row.cells[i + 1]?.value;
            const num = val !== undefined && val !== null && val !== "" ? parseFloat(String(val).replace(/[^0-9.-]+/g, "")) : 0;
            sums[i] += isNaN(num) ? 0 : num;
          }
        }
      }
      if (!found) return Array(periodCount).fill(null);
      return sums;
    }

    // Build set of all section titles from both actual and budget
    const actualTitles = listSectionTitles(actualReport?.rows || []);
    const budgetTitles = listSectionTitles(budgetReport?.rows || []);
    const allTitlesSet = new Set([...actualTitles, ...budgetTitles]);
    let sectionFilter: string[];
    if (!args.metric || args.metric.trim().toUpperCase() === "ALL" || args.metric.trim() === "*") {
      sectionFilter = Array.from(allTitlesSet);
    } else {
      // Only include the requested metric (case-insensitive, partial match allowed)
      const lower = args.metric.trim().toLowerCase();
      sectionFilter = Array.from(allTitlesSet).filter(title => title.trim().toLowerCase() === lower || title.trim().toLowerCase().includes(lower));
      if (sectionFilter.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No section found for metric '${args.metric}'.\nAvailable actuals sections: ${JSON.stringify(actualTitles)}\nAvailable budget sections: ${JSON.stringify(budgetTitles)}`,
            },
          ],
        };
      }
    }

    // For each section, extract period labels and values, align periods
    const result: Record<string, { period: string; actual: number | null; budget: number | null }[]> = {};
    for (const sectionTitle of sectionFilter) {
      const actualSection = (actualReport?.rows || []).find((row: any) => row && row.rowType === "Section" && typeof row.title === "string" && row.title === sectionTitle);
      const budgetSection = (budgetReport?.rows || []).find((row: any) => row && row.rowType === "Section" && typeof row.title === "string" && row.title === sectionTitle);
      const periodLabels = extractPeriodLabels(actualSection || budgetSection);
      const actualValues = extractPeriodValues(actualSection);
      const budgetValues = extractPeriodValues(budgetSection);
      const maxPeriods = Math.max(actualValues.length, budgetValues.length, periodLabels.length);
      const arr = [];
      for (let i = 0; i < maxPeriods; ++i) {
        arr.push({
          period: periodLabels[i] || `Period ${i + 1}`,
          actual: i < actualValues.length ? actualValues[i] : null,
          budget: i < budgetValues.length ? budgetValues[i] : null,
        });
      }
      result[sectionTitle] = arr;
    }

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
