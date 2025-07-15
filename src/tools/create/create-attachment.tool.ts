import { z } from "zod";
import { createXeroAttachment } from "../../handlers/create-xero-attachment.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const CreateAttachmentTool = CreateXeroTool(
  "create-attachment",
  "Upload an attachment to a Xero entity (invoice, contact, credit note, etc.). Only supported file types: PDF, JPG, JPEG, PNG, DOC, DOCX, XLS, XLSX, CSV, TIFF, GIF, XML.",
  {
    entityType: z
      .enum([
        "invoices",
        "contacts",
        "creditnotes",
        "banktransactions",
        "manualjournals",
        "receipts",
        "accounts",
      ])
      .describe("The type of entity to upload the attachment to."),
    entityId: z
      .string()
      .describe("The ID of the entity to upload the attachment to."),
    fileUrl: z.string().url().describe("The public URL of the file to upload."),
    fileName: z
      .string()
      .optional()
      .describe(
        "The file name to use for the attachment (optional, will use from URL if not provided).",
      ),
  },
  async ({ entityType, entityId, fileUrl, fileName }) => {
    const result = await createXeroAttachment(
      entityType,
      entityId,
      fileUrl,
      fileName,
    );
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error uploading attachment: ${result.error}`,
          },
        ],
      };
    }
    const attachment = result.result;
    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Attachment uploaded successfully:",
            `Entity: ${entityType}`,
            `Entity ID: ${entityId}`,
            `Attachment ID: ${attachment?.attachmentID}`,
            `File Name: ${attachment?.fileName}`,
            `Mime Type: ${attachment?.mimeType}`,
            `Size: ${attachment?.contentLength} bytes`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateAttachmentTool;
