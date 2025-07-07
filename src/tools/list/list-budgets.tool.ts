import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroBudgets } from "../../handlers/list-xero-budget.handler.js";

const ListBudgetsTool = CreateXeroTool(
  "list-budgets",
  "List all budgets in Xero.",
  {},
  async () => {
    const response = await listXeroBudgets();
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing budgets: ${response.error}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response.result, null, 2),
        },
      ],
    };
  },
);

export default ListBudgetsTool;
