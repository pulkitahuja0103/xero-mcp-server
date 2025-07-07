import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Budget } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export async function listXeroBudgets(
  dateTo?: string,
  dateFrom?: string
): Promise<XeroClientResponse<Budget[]>> {
  try {
    await xeroClient.authenticate();
    const response = await xeroClient.accountingApi.getBudgets(
      xeroClient.tenantId,
      undefined,         // No budget IDs, fetch all
      dateTo,            // To date (string or undefined)
      dateFrom,          // From date (string or undefined)
      getClientHeaders() // Headers as options
    );
    return {
      result: response.body.budgets ?? [],
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
