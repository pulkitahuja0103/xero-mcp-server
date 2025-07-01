import { z } from "zod";
import { listXeroAttachments } from "../../handlers/list-xero-attachments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListAttachmentsTool = CreateXeroTool(
  "list-attachments",
  "List all attachments for a specific Xero entity (contact, invoice, bill, etc.). \
  This tool returns all attachments associated with the specified entity.",
  {
    entityType: z
      .enum([
        "contacts",
        "invoices",
        "creditnotes",
        "banktransactions",
        "manualjournals",
        "receipts",
        "accounts",
        "items",
      ])
      .describe("The type of entity to get attachments for"),
    entityId: z
      .string()
      .describe("The ID of the entity to get attachments for"),
  },
  async ({ entityType, entityId }) => {
    const result = await listXeroAttachments(entityType, entityId);

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing attachments: ${result.error}`,
          },
        ],
      };
    }

    const attachments = result.result;

    if (!attachments || attachments.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No attachments found for ${entityType} with ID: ${entityId}`,
          },
        ],
      };
    }

    const attachmentList = attachments
      .map((attachment, index) =>
        [
          `${index + 1}. ${attachment.fileName || "Unnamed file"}`,
          `   ID: ${attachment.attachmentID}`,
          `   Size: ${attachment.contentLength ? `${Math.round(attachment.contentLength / 1024)}KB` : "Unknown"}`,
          `   Type: ${attachment.mimeType || "Unknown"}`,
        ].join("\n"),
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Found ${attachments.length} attachment(s) for ${entityType} (ID: ${entityId}):`,
            "",
            attachmentList,
          ].join("\n"),
        },
      ],
    };
  },
);

export default ListAttachmentsTool;
