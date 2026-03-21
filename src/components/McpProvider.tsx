"use client";

import { useMcpTool, WebMCPProvider } from "webmcp-react";
import { z } from "zod";
import { ReactNode } from "react";

// Tool definition for creating an issue
const CreateIssueSchema = z.object({
  title: z.string().describe("The concise title of the issue"),
  description: z.string().describe("The detailed description or acceptance criteria of the issue"),
  priority: z.enum(["low", "medium", "high"]).default("medium").describe("The urgency of the issue"),
});

function McpToolsRegistration() {
  // Register the create_issue tool using the correct object-based API
  useMcpTool({
    name: "create_issue",
    description: "Create a new issue or requirement in the project. Use this tool when the user wants to add a new task, feature request, or bug report.",
    input: CreateIssueSchema,
    handler: async (args) => {
      console.log("WebMCP: AI requested to create issue:", args);
      return {
        content: [
          {
            type: "text",
            text: `[Success] AI has initiated the creation of issue: "${args.title}". Priority: ${args.priority}. (Currently in simulation mode)`,
          },
        ],
      };
    },
  });

  return null;
}

export function McpProvider({ children }: { children: ReactNode }) {
  return (
    <WebMCPProvider name="neo-jira" version="0.1.0">
      <McpToolsRegistration />
      {children}
    </WebMCPProvider>
  );
}
