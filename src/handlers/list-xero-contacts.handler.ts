import { xeroClient } from "../clients/xero-client.js";
import { Contact } from "xero-node";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getContacts(page?: number, where?: string): Promise<Contact[]> {
  await xeroClient.authenticate();

  const contacts = await xeroClient.accountingApi.getContacts(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    where, // where filter
    undefined, // order
    undefined, // iDs
    page, // page
    undefined, // includeArchived
    true, // summaryOnly
    undefined, // pageSize
    undefined, // searchTerm
    getClientHeaders(),
  );
  return contacts.body.contacts ?? [];
}

/**
 * List all contacts from Xero
 */
export async function listXeroContacts(page?: number): Promise<
  XeroClientResponse<Contact[]>
> {
  try {
    const contacts = await getContacts(page);

    return {
      result: contacts,
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

/**
 * List contacts from Xero filtered by email
 * Handles pagination to get all contacts matching the email
 */
export async function listContactsByEmail(email: string): Promise<XeroClientResponse<Contact[]>> {
  try {
    // Xero API 'where' filter for email
    const where = `EmailAddress=="${email}"`;
    let allContacts: Contact[] = [];
    let page = 1;
    let hasMorePages = true;

    // Fetch all pages of contacts matching the email
    while (hasMorePages) {
      const contacts = await getContacts(page, where);
      
      if (contacts.length === 0) {
        hasMorePages = false;
      } else {
        allContacts = allContacts.concat(contacts);
        page++;
        
        // If we get less than the default page size (100), we've reached the end
        if (contacts.length < 100) {
          hasMorePages = false;
        }
      }
    }

    return {
      result: allContacts,
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

