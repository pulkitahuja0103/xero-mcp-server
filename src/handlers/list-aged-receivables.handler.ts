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

    // Group by contact, then list each overdue invoice with id and due amount
    const contactMap: Record<
      string,
      { contactName: string; invoices: { invoiceId: string; amountDue: number; dueDate: string }[] }
    > = {};

    for (const invoice of overdueInvoices) {
      const contactName = invoice.contact?.name || "Unknown";
      const invoiceId = invoice.invoiceID || "Unknown";
      const amountDue = invoice.amountDue ?? 0;
      const dueDate = invoice.dueDate || "";

      if (!contactMap[contactName]) {
        contactMap[contactName] = { contactName, invoices: [] };
      }
      contactMap[contactName].invoices.push({ invoiceId, amountDue, dueDate });
    }

    // Optionally, add column headers if your consumer expects them
    const columns = [
      { name: "Contact Name" },
      { name: "Invoice ID" },
      { name: "Due Amount" },
      { name: "Due Date" }
    ];

    // Prepare rows: each contact, then each invoice under that contact
    const rows = Object.values(contactMap)
      .flatMap((contact) =>
        contact.invoices.map((inv) => ({
          title: contact.contactName,
          cells: [
            { value: contact.contactName }, // Contact Name
            { value: inv.invoiceId },       // Invoice ID
            { value: inv.amountDue.toFixed(2) }, // Due Amount as string
            { value: inv.dueDate }          // Due Date
          ],
        }))
      )
      .slice(0, 50); // Limit to 50 rows for payload safety

    return {
      reportName: "Overdue Invoices by Contact",
      reportDate: now.toISOString().split("T")[0],
      columns, // include columns if your consumer expects them
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
