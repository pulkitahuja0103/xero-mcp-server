import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { ReportWithRow } from "xero-node";

async function listAgedReceivables(
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
        `Status=="AUTHORISED" AND AmountDue>0 AND Type=="ACCREC"`, // Only sales invoices
        "Contact.Name", // Order by contact name
        undefined, // iDs
        undefined, // invoiceNumbers
        contactId ? [contactId] : undefined, // contactIDs
        undefined, // statuses
        page,
      );
      const invoices = result.body.invoices ?? [];
      fetched = invoices.length;
      allInvoices.push(...invoices);
      page++;
    } while (fetched === 100); // Xero returns max 100 per page

    const now = reportDate ? new Date(reportDate) : new Date();

    // Only include invoices that are overdue (due date before today)
    const overdueInvoices = allInvoices.filter((inv) => {
      if (!inv.dueDate) return false;
      const dueDate = new Date(inv.dueDate);
      return dueDate < now;
    });

    // Sort by contact name to group all invoices of a contact together
    overdueInvoices.sort((a, b) => {
      const nameA = (a.contact?.name || "").toLowerCase();
      const nameB = (b.contact?.name || "").toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
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
  contactId?: string,
  reportDate?: string,
  invoicesFromDate?: string,
  invoicesToDate?: string,
): Promise<XeroClientResponse<ReportWithRow>> {
  try {
    const report = await listAgedReceivables(
      contactId,
      reportDate,
      invoicesFromDate,
      invoicesToDate,
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
