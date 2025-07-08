import { z } from "zod";
import { listXeroAgedReceivables } from "../../handlers/list-aged-receivables.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatAgedReportFilter } from "../../helpers/format-aged-report-filter.js";

const ListAgedReceivables = CreateXeroTool(
  "list-aged-receivables",
  `Lists all aged receivables in Xero.
  This shows overdue invoices across all contacts up to a report date.`,
  {
    reportDate: z.string().optional()
      .describe("Optional date to retrieve aged receivables in YYYY-MM-DD format. If none is provided, defaults to end of the current month."),
    invoicesFromDate: z.string().optional()
      .describe("Optional from date in YYYY-MM-DD format. If provided, will only show payable invoices after this date."),
    invoicesToDate: z.string().optional()
      .describe("Optional to date in YYYY-MM-DD format. If provided, will only show payable invoices before this date."),
  },
  async ({ reportDate, invoicesFromDate, invoicesToDate }) => {
    const response = await listXeroAgedReceivables(reportDate, invoicesFromDate, invoicesToDate);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing aged receivables: ${response.error}`,
          },
        ],
      };
    }

    const agedReceivablesReport = response.result;
    const filter = formatAgedReportFilter(invoicesFromDate, invoicesToDate);

    return {
      content: [
        {
          type: "text" as const,
          text: `Report Name: ${agedReceivablesReport.reportName || "Not specified"}`,
        },
        {
          type: "text" as const,
          text: `Report Date: ${agedReceivablesReport.reportDate || "Not specified"}`
        },
        {
          type: "text" as const,
          text: filter ?? "Showing all relevant invoices"
        },
        {
          type: "text" as const,
          text: JSON.stringify(agedReceivablesReport.rows, null, 2),
        }
      ],
    };
  }
);

export default ListAgedReceivables;
