import { xeroClient } from "../clients/xero-client.js"; // Use this path based on your structure

export async function getContactById(contactId: string) {
  try {
    const response = await xeroClient.accountingApi.getContact(
      xeroClient.tenants[0],
      contactId
    );
    return response.body.contacts?.[0] || null;
  } catch (error) {
    return null;
  }
}

export async function getContactByName(contactName: string) {
  try {
    const response = await xeroClient.accountingApi.getContacts(
      xeroClient.tenants[0],
      undefined,
      `Name=="${contactName}"`
    );
    return response.body.contacts?.[0] || null;
  } catch (error) {
    return null;
  }
}