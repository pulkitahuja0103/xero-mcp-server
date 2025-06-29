import { listXeroAccounts } from "../../handlers/list-xero-accounts.handler.js";
import { listContactsByEmail } from "../../handlers/list-xero-contacts.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { z } from "zod";

const ListAccountsTool = CreateXeroTool(
  "list-accounts",
  "Lists all accounts in Xero. Use this tool to get the account codes and names to be used when creating invoices in Xero. Can also filter contacts by email address.",
  {
    email: z.string().email().optional().describe("Optional email address to filter contacts by. \
      If provided, will return only contacts matching this email address along with their account information."),
  },
  async (params: { email?: string }) => {
    const { email } = params;
    if (email) {
      // If email is provided, filter contacts by email
      const contactsResponse = await listContactsByEmail(email);
      if (contactsResponse.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing contacts by email: ${contactsResponse.error}`,
            },
          ],
        };
      }

      const contacts = contactsResponse.result;

      if (!contacts || contacts.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No contacts found with email: ${email}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${contacts.length} contact(s) with email ${email}:`,
          },
          ...contacts.map((contact) => ({
            type: "text" as const,
            text: [
              `Contact Name: ${contact.name || "Unnamed"}`,
              `Contact ID: ${contact.contactID || "No ID"}`,
              contact.firstName ? `First Name: ${contact.firstName}` : null,
              contact.lastName ? `Last Name: ${contact.lastName}` : null,
              contact.emailAddress ? `Email: ${contact.emailAddress}` : null,
              `Type: ${
                [
                  contact.isCustomer ? "Customer" : null,
                  contact.isSupplier ? "Supplier" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "Unknown"
              }`,
              contact.defaultCurrency ? `Default Currency: ${contact.defaultCurrency}` : null,
              `Status: ${contact.contactStatus || "Unknown"}`,
            ]
              .filter(Boolean)
              .join("\n"),
          })),
        ],
      };
    } else {
      // If no email provided, list all accounts
      const response = await listXeroAccounts();
      if (response.error !== null) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing accounts: ${response.error}`,
            },
          ],
        };
      }

      const accounts = response.result;

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${accounts?.length || 0} accounts:`,
          },
          ...(accounts?.map((account) => ({
            type: "text" as const,
            text: [
              `Account: ${account.name || "Unnamed"}`,
              `Code: ${account.code || "No code"}`,
              `ID: ${account.accountID || "No ID"}`,
              `Type: ${account.type || "Unknown type"}`,
              `Status: ${account.status || "Unknown status"}`,
              account.description ? `Description: ${account.description}` : null,
              account.taxType ? `Tax Type: ${account.taxType}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          })) || []),
        ],
      };
    }
  },
);

export default ListAccountsTool;
