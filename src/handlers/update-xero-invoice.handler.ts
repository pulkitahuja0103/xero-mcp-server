import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoice, LineItemTracking } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

export type InvoiceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'AUTHORISED'
  | 'DELETED'
  | 'VOIDED';

async function getInvoice(invoiceId: string): Promise<Invoice | undefined> {
  await xeroClient.authenticate();

  // First, get the current invoice to check its status
  const response = await xeroClient.accountingApi.getInvoice(
    xeroClient.tenantId,
    invoiceId, // invoiceId
    undefined, // unitdp
    getClientHeaders(), // options
  );

  return response.body.invoices?.[0];
}

async function updateInvoice(
  invoiceId: string,
  lineItems?: InvoiceLineItem[],
  reference?: string,
  dueDate?: string,
  date?: string,
  contactId?: string,
  status?: InvoiceStatus,
): Promise<Invoice | undefined> {
  const invoice: Invoice = {
    lineItems: lineItems,
    reference: reference,
    dueDate: dueDate,
    date: date,
    contact: contactId ? { contactID: contactId } : undefined,
    ...(status ? { status: Invoice.StatusEnum[status as keyof typeof Invoice.StatusEnum] } : {}),
  };

  const response = await xeroClient.accountingApi.updateInvoice(
    xeroClient.tenantId,
    invoiceId, // invoiceId
    {
      invoices: [invoice],
    }, // invoices
    undefined, // unitdp
    undefined, // idempotencyKey
    getClientHeaders(), // options
  );

  return response.body.invoices?.[0];
}

/**
 * Update an existing invoice in Xero
 * @param invoiceId
 * @param lineItems
 * @param reference
 * @param dueDate
 * @param date
 * @param contactId
 * @param status - Optional. Used for delete/void/authorize actions.
 * @param action - Optional. 'delete' | 'void' | 'authorize' | undefined
 */
export async function updateXeroInvoice(
  invoiceId: string,
  lineItems?: InvoiceLineItem[],
  reference?: string,
  dueDate?: string,
  date?: string,
  contactId?: string,
  status?: InvoiceStatus,
  action?: 'delete' | 'void' | 'authorize',
): Promise<XeroClientResponse<Invoice>> {
  try {
    const existingInvoice = await getInvoice(invoiceId);
    const invoiceStatus = existingInvoice?.status;

    // Handle delete/void/authorize actions
    if (action === 'delete') {
      if (
        invoiceStatus === Invoice.StatusEnum.DRAFT ||
        invoiceStatus === Invoice.StatusEnum.SUBMITTED
      ) {
        // Set status to DELETED
        const updatedInvoice = await updateInvoice(
          invoiceId,
          lineItems,
          reference,
          dueDate,
          date,
          contactId,
          'DELETED',
        );
        if (!updatedInvoice) throw new Error('Invoice delete failed.');
        return { result: updatedInvoice, isError: false, error: null };
      } else if (invoiceStatus === Invoice.StatusEnum.AUTHORISED) {
        // Set status to VOIDED
        const updatedInvoice = await updateInvoice(
          invoiceId,
          lineItems,
          reference,
          dueDate,
          date,
          contactId,
          'VOIDED',
        );
        if (!updatedInvoice) throw new Error('Invoice void failed.');
        return { result: updatedInvoice, isError: false, error: null };
      } else {
        return {
          result: null,
          isError: true,
          error: `Invoice cannot be deleted. Current status: ${invoiceStatus}`,
        };
      }
    }

    if (action === 'authorize') {
      if (invoiceStatus !== Invoice.StatusEnum.AUTHORISED) {
        // Set status to AUTHORISED
        const updatedInvoice = await updateInvoice(
          invoiceId,
          lineItems,
          reference,
          dueDate,
          date,
          contactId,
          'AUTHORISED',
        );
        if (!updatedInvoice) throw new Error('Invoice authorize failed.');
        return { result: updatedInvoice, isError: false, error: null };
      }
      // Already authorized, just update other fields
    }

    // Default: update invoice as before (no status change)
    const updatedInvoice = await updateInvoice(
      invoiceId,
      lineItems,
      reference,
      dueDate,
      date,
      contactId,
      status,
    );
    if (!updatedInvoice) {
      throw new Error('Invoice update failed.');
    }
    return {
      result: updatedInvoice,
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
