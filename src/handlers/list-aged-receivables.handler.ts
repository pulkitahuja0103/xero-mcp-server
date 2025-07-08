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

  const response = await xeroClient.accountingApi.getReportAgedReceivables(
    xeroClient.tenantId,
    reportDate,
    invoicesFromDate,
    invoicesToDate,
    getClientHeaders()
  );

  // Limit the number of rows to avoid large payloads
  const report = response.body.reports?.[0];
  if (report && Array.isArray(report.rows)) {
    report.rows = report.rows.slice(0, 10); // Only keep first 10 rows
  }

  return report;
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
        error: "Failed to get aged receivables report from Xero."
      };
    }

    return {
      result: report,
      isError: false,
      error: null
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
