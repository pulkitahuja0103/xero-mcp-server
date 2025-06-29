import { z } from "zod";
import { createXeroInvoice } from "../../handlers/create-xero-invoice.handler.js";
import { listContactsByEmail } from "../../handlers/list-xero-contacts.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { Invoice } from "xero-node";

const trackingSchema = z.object({
  name: z.string().describe("The name of the tracking category. Can be obtained from the list-tracking-categories tool"),
  option: z.string().describe("The name of the tracking option. Can be obtained from the list-tracking-categories tool"),
  trackingCategoryID: z.string().describe("The ID of the tracking category. \
    Can be obtained from the list-tracking-categories tool"),
});

const lineItemSchema = z.object({
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The price per unit of the line item"),
  accountCode: z.string().describe("The account code of the line item - can be obtained from the list-accounts tool"),
  taxType: z.string().describe("The tax type of the line item - can be obtained from the list-tax-rates tool"),
  itemCode: z.string().describe("The item code of the line item - can be obtained from the list-items tool \
    If the item is not listed, add without an item code and ask the user if they would like to add an item code.").optional(),
  tracking: z.array(trackingSchema).describe("Up to 2 tracking categories and options can be added to the line item. \
    Can be obtained from the list-tracking-categories tool. \
    Only use if prompted by the user.").optional(),
});

const CreateInvoiceTool = CreateXeroTool(
  "create-invoice",
  "Create an invoice in Xero.\
 When an invoice is created, a deep link to the invoice in Xero is returned. \
 This deep link can be used to view the invoice in Xero directly. \
 This link should be displayed to the user. \
 You can provide either contactId or contactEmail. If contactEmail is provided and multiple contacts have the same email, \
 the tool will return a list of matching contacts and ask the user to select one by providing the contactId.",
  {
    contactId: z.string().describe("The ID of the contact to create the invoice for. \
      Can be obtained from the list-contacts tool. Required if contactEmail is not provided."),
    contactEmail: z.string().email().describe("The email address of the contact to create the invoice for. \
      Can be used instead of contactId. If multiple contacts have the same email, the tool will return a list \
      of matching contacts and ask the user to select one by providing the contactId.").optional(),
    lineItems: z.array(lineItemSchema),
    type: z.enum(["ACCREC", "ACCPAY"]).describe("The type of invoice to create. \
      ACCREC is for sales invoices, Accounts Receivable, or customer invoices. \
      ACCPAY is for purchase invoices, Accounts Payable invoices, supplier invoices, or bills. \
      If the type is not specified, the default is ACCREC."),
    reference: z.string().describe("A reference number for the invoice.").optional(),
  },
  async (params: { 
    contactId?: string; 
    contactEmail?: string; 
    lineItems: any[]; 
    type: "ACCREC" | "ACCPAY"; 
    reference?: string; 
  }) => {
    const { contactId, contactEmail, lineItems, type, reference } = params;
    let finalContactId = contactId;

    // If contactEmail is provided, look up the contact
    if (contactEmail && !contactId) {
      const contactsResponse = await listContactsByEmail(contactEmail);
      if (contactsResponse.isError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error looking up contact by email: ${contactsResponse.error}`,
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
              text: `No contacts found with email: ${contactEmail}. Please check the email address or use the list-contacts tool to find the correct contact.`,
            },
          ],
        };
      }

      if (contacts.length === 1) {
        // Only one contact found, use it
        finalContactId = contacts[0].contactID!;
      } else {
        // Multiple contacts found, ask user to select one
        return {
          content: [
            {
              type: "text" as const,
              text: `Multiple contacts found with email ${contactEmail}. Please select one by providing the contactId:`,
            },
            ...contacts.map((contact) => ({
              type: "text" as const,
              text: [
                `Contact Name: ${contact.name || "Unnamed"}`,
                `Contact ID: ${contact.contactID || "No ID"}`,
                contact.firstName ? `First Name: ${contact.firstName}` : null,
                contact.lastName ? `Last Name: ${contact.lastName}` : null,
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
      }
    }

    if (!finalContactId) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Either contactId or contactEmail must be provided.",
          },
        ],
      };
    }

    const xeroInvoiceType = type === "ACCREC" ? Invoice.TypeEnum.ACCREC : Invoice.TypeEnum.ACCPAY;
    const result = await createXeroInvoice(finalContactId, lineItems, xeroInvoiceType, reference);
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating invoice: ${result.error}`,
          },
        ],
      };
    }

    const invoice = result.result;

    const deepLink = invoice.invoiceID
      ? await getDeepLink(
          invoice.type === Invoice.TypeEnum.ACCREC ? DeepLinkType.INVOICE : DeepLinkType.BILL,
          invoice.invoiceID,
        )
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Invoice created successfully:",
            `ID: ${invoice?.invoiceID}`,
            `Contact: ${invoice?.contact?.name}`,
            `Type: ${invoice?.type}`,
            `Total: ${invoice?.total}`,
            `Status: ${invoice?.status}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateInvoiceTool;
