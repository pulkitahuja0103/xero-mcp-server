import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { ReportWithRow } from "xero-node";

/**
 * Fetches and builds an Aged Payables report using Xero invoices.
 * Only includes overdue bills (due date before reportDate or today).
 */
async function listAgedPayables(
  contactId?: string,
  reportDate?: string,
  invoicesFromDate?: string,
  invoicesToDate?: string,
): Promise<ReportWithRow | undefined> {
  await xeroClient.authenticate();

  try {
    const allInvoices: any[] = [];
    let page = 1;
    let fetched = 0;

    do {
      const result = await xeroClient.accountingApi.getInvoices(
        xeroClient.tenantId,
        undefined,
        `Status=="AUTHORISED" AND AmountDue>0 AND Type=="ACCPAY"`, // Only purchase bills
        "Contact.Name", // Order by contact name
        undefined,
        undefined,
        contactId ? [contactId] : undefined, // filter by contact if provided
        undefined,
        page,
      );

      const invoices = result.body.invoices ?? [];
      fetched = invoices.length;
      allInvoices.push(...invoices);
      page++;
    } while (fetched === 100); // Xero paginates with max 100 per page

    const now = reportDate ? new Date(reportDate) : new Date();

    // Filter only overdue bills (due before report date)
    const overdueInvoices = allInvoices.filter((inv) => {
      if (!inv.dueDate) return false;
      const dueDate = new Date(inv.dueDate);
      return dueDate < now;
    });

    // Sort by contact name for grouping
    overdueInvoices.sort((a, b) => {
      const nameA = (a.contact?.name || "").toLowerCase();
      const nameB = (b.contact?.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Format each row for the report
    const rows = overdueInvoices.map((inv) => ({
      "Contact Name": inv.contact?.name || "Unknown",
      "Invoice Reference": inv.invoiceNumber || "Unknown",
      "Overdue Amount": Number(inv.amountDue ?? 0),
      "Due Date": inv.dueDate || "",
    }));

    return {
      reportName: "Aged Creditors - Overdue Bills",
      reportDate: now.toISOString().split("T")[0],
      rows,
    } as ReportWithRow;
  } catch (err) {
    console.error("Error fetching aged payables:", err);
    throw err;
  }
}

/**
 * Public handler for external consumption. Returns a structured report or formatted error.
 */
export async function listXeroAgedPayables(
  contactId?: string,
  reportDate?: string,
  invoicesFromDate?: string,
  invoicesToDate?: string,
): Promise<XeroClientResponse<ReportWithRow>> {
  try {
    const report = await listAgedPayables(
      contactId,
      reportDate,
      invoicesFromDate,
      invoicesToDate,
    );

    if (!report) {
      return {
        result: null,
        isError: true,
        error: "Failed to get aged payables report from Xero.",
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
