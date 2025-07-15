import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Attachment } from "xero-node";
import axios from "axios";
import path from "path";

const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".tiff",
  ".gif",
  ".xml",
];

export async function createXeroAttachment(
  entityType: string,
  entityId: string,
  fileUrl: string,
  fileName?: string,
): Promise<XeroClientResponse<Attachment | null>> {
  try {
    console.log(`Starting attachment upload for ${entityType} ${entityId}`);
    // Download file
    console.log(`Downloading file from: ${fileUrl}`);
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    if (response.status !== 200) throw new Error("Failed to download file");
    console.log(
      `File downloaded successfully, size: ${response.data.length} bytes`,
    );
    const ext = path.extname(fileName || fileUrl.split("?")[0]);
    if (!SUPPORTED_EXTENSIONS.includes(ext.toLowerCase())) {
      throw new Error(
        `File type ${ext} is not supported by Xero. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`,
      );
    }
    console.log(`File type validated: ${ext}`);
    const finalFileName = fileName || `attachment${ext}`;
    const mimeType =
      response.headers["content-type"] || "application/octet-stream";
    console.log(`Upload parameters:`, {
      finalFileName,
      mimeType,
      entityType,
      entityId,
    });
    let sdkResponse;
    // Use switch statement like the list handler for better error handling
    switch (entityType.toLowerCase()) {
      case "invoices":
        sdkResponse =
          await xeroClient.accountingApi.createInvoiceAttachmentByFileName(
            xeroClient.tenantId,
            entityId,
            finalFileName,
            Buffer.from(response.data),
          );
        break;
      case "contacts":
        sdkResponse =
          await xeroClient.accountingApi.createContactAttachmentByFileName(
            xeroClient.tenantId,
            entityId,
            finalFileName,
            Buffer.from(response.data),
          );
        break;
      case "creditnotes":
        sdkResponse =
          await xeroClient.accountingApi.createCreditNoteAttachmentByFileName(
            xeroClient.tenantId,
            entityId,
            finalFileName,
            Buffer.from(response.data),
          );
        break;
      case "banktransactions":
        sdkResponse =
          await xeroClient.accountingApi.createBankTransactionAttachmentByFileName(
            xeroClient.tenantId,
            entityId,
            finalFileName,
            Buffer.from(response.data),
          );
        break;
      case "manualjournals":
        sdkResponse =
          await xeroClient.accountingApi.createManualJournalAttachmentByFileName(
            xeroClient.tenantId,
            entityId,
            finalFileName,
            Buffer.from(response.data),
          );
        break;
      case "receipts":
        sdkResponse =
          await xeroClient.accountingApi.createReceiptAttachmentByFileName(
            xeroClient.tenantId,
            entityId,
            finalFileName,
            Buffer.from(response.data),
          );
        break;
      case "accounts":
        sdkResponse =
          await xeroClient.accountingApi.createAccountAttachmentByFileName(
            xeroClient.tenantId,
            entityId,
            finalFileName,
            Buffer.from(response.data),
          );
        break;
      default:
        throw new Error(
          `Attachment upload not supported for entity type: ${entityType}`,
        );
    }
    console.log(`SDK response received:`, {
      status: sdkResponse.response?.status,
      statusText: sdkResponse.response?.statusText,
      body: sdkResponse.body,
    });
    const attachment = sdkResponse.body.attachments?.[0] || null;
    if (!attachment) {
      console.error("No attachment returned in response:", sdkResponse.body);
      throw new Error("Upload completed but no attachment was returned");
    }
    console.log(`Attachment uploaded successfully:`, attachment);
    return { result: attachment, isError: false, error: null };
  } catch (error) {
    console.error("Attachment upload error:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    return { result: null, isError: true, error: formatError(error) };
  }
}
