// Updated list-aged-receivables.handler.ts to use Invoices instead of broken AgedReceivables endpoint

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
    const headers = await getClientHeaders();
    const result = await xeroClient.accountingApi.getInvoices(
      xeroClient.tenantId,
      undefined,
      `Status=="AUTHORISED" AND AmountDue>0`
    );

    const now = reportDate ? new Date(reportDate) : new Date();
    const invoices = result.body.invoices ?? [];

    // Only include invoices that are overdue (due date before today)
    const overdueInvoices = invoices.filter((inv) => {
      if (!inv.dueDate) return false;
      const dueDate = new Date(inv.dueDate);
      return dueDate < now;
    });

    // Prepare rows: one row per overdue invoice, flat object
    const rows = overdueInvoices.map((inv) => ({
      "Contact Name": inv.contact?.name || "Unknown",
      "Invoice ID": inv.invoiceID || "Unknown",
      "Overdue Amount": Number(inv.amountDue ?? 0),
      "Due Date": inv.dueDate || "",
    }));

    return {
      reportName: "Aged Debtors - Overdue Invoices",
      reportDate: now.toISOString().split("T")[0],
      rows,
    } as ReportWithRow;
  } catch (err) {
    console.error("Error fetching overdue receivables by contact:", err);
    throw err;
  }
}

export async function listXeroAgedReceivables(
  reportDate?: string,
  invoicesFromDate?: string,
  invoicesToDate?: string
): Promise<XeroClientResponse<ReportWithRow>> {
  try {
    const report = await listAgedReceivables(
      reportDate,
      invoicesFromDate,
      invoicesToDate
    );

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
