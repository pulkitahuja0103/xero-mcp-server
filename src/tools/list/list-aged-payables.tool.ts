import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatAgedReportFilter } from "../../helpers/format-aged-report-filter.js";
import { listXeroAgedPayables } from "../../handlers/list-aged-payables.handler.js";

const ListAgedPayables = CreateXeroTool(
  "list-aged-payables",
  `Lists the aged payables in Xero.
  This shows aged payables across all contacts up to a report date. OR for a certain contact up to a report date
  **FIRST ASK USER WHAT HE/SHE WANT FOR ALL CONTACT OR SPECIFIC CONTACT **.`,
  {
    contactId: z
      .string()
      .optional()
      .describe(
        "Optional contact ID to filter the aged receivables report. If not provided, it will show all contacts and contact ID will be undefined.",
      ),
    reportDate: z
      .string()
      .optional()
      .describe(
        "Optional date to retrieve aged payables in YYYY-MM-DD format.**FIRST ASK USER FOR DATE** If none is provided, defaults to end of the current month. and also show choosen date in the report.",
      ),
    invoicesFromDate: z
      .string()
      .optional()
      .describe(
        "Optional from date in YYYY-MM-DD format. If provided, will only show payable invoices after this date for the contact.",
      ),
    invoicesToDate: z
      .string()
      .optional()
      .describe(
        "Optional to date in YYYY-MM-DD format. If provided, will only show payable invoices before this date for the contact.",
      ),
  },
  async ({ contactId, reportDate, invoicesFromDate, invoicesToDate }) => {
    const response = await listXeroAgedPayables(
      contactId,
      reportDate,
      invoicesFromDate,
      invoicesToDate,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing aged payables by contact: ${response.error}`,
          },
        ],
      };
    }

    const agedPayablesReport = response.result;
    const filter = formatAgedReportFilter(invoicesFromDate, invoicesToDate);

    return {
      content: [
        {
          type: "text" as const,
          text: `Report Name: ${agedPayablesReport.reportName || "Not specified"}`,
        },
        {
          type: "text" as const,
          text: `Report Date: ${agedPayablesReport.reportDate || "Not specified"}`,
        },
        {
          type: "text" as const,
          text: filter ?? "Showing all relevant invoices",
        },
        {
          type: "text" as const,
          text: JSON.stringify(agedPayablesReport.rows, null, 2),
        },
      ],
    };
  },
);

export default ListAgedPayables;
