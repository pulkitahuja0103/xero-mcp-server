import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Attachment } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getAttachments(
  entityType: string,
  entityId: string,
): Promise<Attachment[]> {
  await xeroClient.authenticate();

  let response;

  switch (entityType) {
    case "contacts":
      response = await xeroClient.accountingApi.getContactAttachments(
        xeroClient.tenantId,
        entityId,
        getClientHeaders(),
      );
      break;
    case "invoices":
      response = await xeroClient.accountingApi.getInvoiceAttachments(
        xeroClient.tenantId,
        entityId,
        getClientHeaders(),
      );
      break;
    case "creditnotes":
      response = await xeroClient.accountingApi.getCreditNoteAttachments(
        xeroClient.tenantId,
        entityId,
        getClientHeaders(),
      );
      break;
    case "banktransactions":
      response = await xeroClient.accountingApi.getBankTransactionAttachments(
        xeroClient.tenantId,
        entityId,
        getClientHeaders(),
      );
      break;
    case "manualjournals":
      response = await xeroClient.accountingApi.getManualJournalAttachments(
        xeroClient.tenantId,
        entityId,
        getClientHeaders(),
      );
      break;
    case "receipts":
      response = await xeroClient.accountingApi.getReceiptAttachments(
        xeroClient.tenantId,
        entityId,
        getClientHeaders(),
      );
      break;
    case "accounts":
      response = await xeroClient.accountingApi.getAccountAttachments(
        xeroClient.tenantId,
        entityId,
        getClientHeaders(),
      );
      break;
    case "items":
      throw new Error(
        "getItemAttachments is not available in the Xero SDK. Please use a supported entity type.",
      );
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }

  return response.body.attachments || [];
}

/**
 * List all attachments for a specific Xero entity
 */
export async function listXeroAttachments(
  entityType: string,
  entityId: string,
): Promise<XeroClientResponse<Attachment[]>> {
  try {
    const attachments = await getAttachments(entityType, entityId);

    return {
      result: attachments,
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
