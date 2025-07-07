import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Budget } from "xero-node";

export async function listXeroBudgets(): Promise<XeroClientResponse<Budget[]>> {
  try {
    await xeroClient.authenticate();
    const response = await xeroClient.accountingApi.getBudgets(
      xeroClient.tenantId,
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
