import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { ReportWithRow } from "xero-node";

async function listAgedReceivables(
  reportDate?: string,
  invoicesFromDate?: string,
  invoicesToDate?: string
): Promise<ReportWithRow | undefined> {
  await xeroClient.authenticate();

  try {
    const response = await xeroClient.accountingApi.getReportAgedReceivables(
      xeroClient.tenantId,
      reportDate,
      invoicesFromDate,
      invoicesToDate,
      getClientHeaders()
    );

    const report = response.body.reports?.[0];
    if (report && Array.isArray(report.rows)) {
      // Optionally, only return summary fields for each row
      report.rows = report.rows.slice(0, 10).map((row) => ({
        title: row.title,
        cells: row.cells?.slice(0, 5), // Only first 5 cells for brevity
      }));
    }

    return report;
  } catch (err) {
    console.error("Error fetching aged receivables:", err);
    throw err;
  }
}

export async function listXeroAgedReceivables(
  reportDate?: string,
  invoicesFromDate?: string,
  invoicesToDate?: string
): Promise<XeroClientResponse<ReportWithRow>> {
  try {
    const report = await listAgedReceivables(reportDate, invoicesFromDate, invoicesToDate);

    if (!report) {
      return {
        result: null,
        isError: true,
        error: "Failed to get aged receivables report from Xero.",
      };
    }

    return {
      result: report,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
