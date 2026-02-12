
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Registers prompt handlers (list_prompts, get_prompt) with the MCP server.
 * 
 * Based on the pattern used in sap-datasphere-mcp but adapted for TypeScript/SDK.
 */
export function registerPrompts(server: McpServer) {
    // 1. Explore SAC Content
    server.prompt(
        "explore_content",
        {
            folder: z.string().optional().describe("Optional: Folder path to start exploration from").default("/"),
        },
        ({ folder }) => ({
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `I want to explore the content available in my SAP Analytics Cloud tenant.
Please help me discover what's available, starting from folder '${folder}'.

1. List the contents of the current folder.
2. Identify key Stories and Applications.
3. Suggest interesting items to inspect further.
4. If there are subfolders, ask me if I want to explore them.

Start by listing the contents of '${folder}'.`,
                    },
                },
            ],
        })
    );

    // 2. Analyze a Story
    server.prompt(
        "analyze_story",
        {
            story_id: z.string().describe("The ID of the Story to analyze"),
        },
        ({ story_id }) => ({
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `I need to understand the structure and dependencies of SAC Story '${story_id}'.

Please perform the following analysis:
1. Retrieve the metadata for this story.
2. Identify what models or datasets it uses.
3. List the widgets or visualizations if possible.
4. check if there are any translations available.

Start by getting the story details.`,
                    },
                },
            ],
        })
    );

    // 3. System Health Check
    server.prompt(
        "system_health_check",
        {},
        () => ({
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `Please perform a system health check on the SAC tenant.

1. Check the connectivity (Ping).
2. List the most recent Audit Log entries to see activity.
3. Check for any failed recent remote schedules or publications.
4. Summarize the overall system status.

Start with the functionality check.`,
                    },
                },
            ],
        })
    );

    // 4. User Audit
    server.prompt(
        "audit_user_activity",
        {
            username: z.string().describe("The username to audit"),
        },
        ({ username }) => ({
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `I need to audit the activity of user '${username}'.

1. Find the user's details (ID, email, roles).
2. Search the Audit Log for recent activities by this user.
3. List any teams they are a member of.
4. Summarize their recent actions.

Start by finding the user profile.`,
                    },
                },
            ],
        })
    );
}
