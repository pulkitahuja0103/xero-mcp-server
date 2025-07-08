import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroProfitAndLoss } from "../../handlers/list-xero-profit-and-loss.handler.js";
import { listXeroBudgetSummary } from "../../handlers/list-xero-budget-summary.handler.js";

const ActualVsBudgetTool = CreateXeroTool(
  "actual-vs-budget",
  "Compare actual and budget values for all available sections in the Profit & Loss and Budget Summary reports for a given period. Returns a JSON object with the comparison.",
  {
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
    timeframe: z
      .enum(["MONTH", "YEAR"])
      .optional()
      .describe("Timeframe for the report (default: MONTH)"),
  },
  async ({ fromDate, toDate, timeframe }) => {
    // Default to current month if not provided
    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const defaultToStr = defaultTo.toISOString().slice(0, 10);

    const start = fromDate || defaultFrom;
    const end = toDate || defaultToStr;
    const tf = timeframe || "MONTH";

    // Fetch actuals (P&L)
    const actualResp = await listXeroProfitAndLoss(
      start,
      end,
      undefined,
      tf,
      true,
      false,
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
    const actual = actualResp.result;

    // Fetch budget
    const budgetResp = await listXeroBudgetSummary(start, undefined, tf);
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
    const budget = budgetResp.result;

    // Helper to extract all section values from a report
    function extractSections(reportRows: unknown[]): Record<string, number> {
      const result: Record<string, number> = {};
      if (!Array.isArray(reportRows)) return result;
      for (const row of reportRows) {
        if (
          typeof row === "object" &&
          row !== null &&
          "rowType" in row &&
          row.rowType === "Section" &&
          "title" in row &&
          typeof row.title === "string" &&
          "rows" in row &&
          Array.isArray(row.rows)
        ) {
          // Sum all values in this section
          const sectionRows = row.rows;
          const total = sectionRows.reduce((sum: number, r: unknown) => {
            if (typeof r === "object" && r !== null && "cells" in r) {
              const cells = (r as { cells?: any[] }).cells;
              const val = cells?.[0]?.value
                ? parseFloat(String(cells[0].value).replace(/[^0-9.-]+/g, ""))
                : 0;
              return sum + val;
            }
            return sum;
          }, 0);
          result[row.title] = total;
        }
      }
      return result;
    }

    const actualSections = extractSections((actual as any)?.rows || []);
    const budgetSections = extractSections((budget as any)?.rows || []);

    // Build comparison for all unique section titles
    const allKeys = Array.from(new Set([
      ...Object.keys(actualSections),
      ...Object.keys(budgetSections),
    ]));
    const resultObj: Record<string, { actual: number; budget: number }> = {};
    allKeys.forEach((key) => {
      const actualVal = actualSections[key] ?? 0;
      const budgetVal = budgetSections[key] ?? 0;
      resultObj[key] = {
        actual: actualVal,
        budget: budgetVal,
      };
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(resultObj, null, 2),
        },
      ],
    };
  },
);

export default ActualVsBudgetTool;
