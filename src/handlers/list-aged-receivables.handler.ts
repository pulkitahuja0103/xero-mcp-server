// ✅ Updated list-aged-receivables.handler.ts to use Invoices instead of broken AgedReceivables endpoint

import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { ReportWithRow } from "xero-node";

interface AgedReceivableRow {
  contact: string;
  current: number;
  "1–30": number;
  "31–60": number;
  "61–90": number;
  "90+": number;
}

function getAgingBucket(daysOverdue: number): keyof AgedReceivableRow {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1–30";
  if (daysOverdue <= 60) return "31–60";
  if (daysOverdue <= 90) return "61–90";
  return "90+";
}

async function listAgedReceivables(
  reportDate?: string,
  invoicesFromDate?: string,
  invoicesToDate?: string
): Promise<ReportWithRow | undefined> {
  await xeroClient.authenticate();

  try {
    const headers = await getClientHeaders();
    const result = await xeroClient.accountingApi.getInvoices(
      xeroClient.tenantId,
      undefined,
      `Status=="AUTHORISED" AND AmountDue>0`
    );

    const now = reportDate ? new Date(reportDate) : new Date();
    const invoices = result.body.invoices ?? [];

    const summaryMap: Record<string, AgedReceivableRow> = {};

    for (const invoice of invoices) {
      const contactName = invoice.contact?.name || "Unknown";
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const amountDue = invoice.amountDue ?? 0;

      if (!dueDate || isNaN(dueDate.getTime())) continue;

      const diffDays = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = getAgingBucket(diffDays);

      if (!summaryMap[contactName]) {
        summaryMap[contactName] = {
          contact: contactName,
          current: 0,
          "1–30": 0,
          "31–60": 0,
          "61–90": 0,
          "90+": 0,
        };
      }

      (summaryMap[contactName][bucket as keyof AgedReceivableRow] as number) += amountDue;
    }

    // Limit to first 10 rows to avoid large payloads
    const rows = Object.values(summaryMap)
      .slice(0, 10)
      .map((row) => ({
        title: row.contact,
        cells: [
          { value: row.current.toFixed(2) },
          { value: row["1–30"].toFixed(2) },
          { value: row["31–60"].toFixed(2) },
          { value: row["61–90"].toFixed(2) },
          { value: row["90+"].toFixed(2) },
        ],
      }));

    return {
      reportName: "Custom Aged Receivables Summary",
      reportDate: now.toISOString().split("T")[0],
      rows: rows,
    } as ReportWithRow;
  } catch (err) {
    console.error("Error fetching aged receivables via invoices fallback:", err);
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
    console.error("Handler error:", error);
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
