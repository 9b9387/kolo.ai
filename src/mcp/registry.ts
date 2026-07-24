import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTool } from './register';
import type { AnyToolDef } from './types';
import { overviewTools } from './tools/overview';
import { profileTools } from './tools/profile';
import { goalTools } from './tools/goals';
import { preferenceTools } from './tools/preferences';
import { metricTools } from './tools/metrics';
import { foodTools } from './tools/foods';
import { diaryTools } from './tools/diary';

export const allTools: AnyToolDef[] = [
  ...overviewTools, //   get_overview
  ...profileTools, //    update_profile
  ...goalTools, //       set_goal, list_goals
  ...preferenceTools, // update_preferences
  ...metricTools, //     log_body_metrics, list_body_metrics
  ...foodTools, //       search_foods, get_food, create_food
  ...diaryTools, //      log_meal, update_meal_entry, delete_meal_entries, list_meals, get_daily_summary
];

export function registerAllTools(server: McpServer) {
  for (const tool of allTools) registerTool(server, tool);
}
