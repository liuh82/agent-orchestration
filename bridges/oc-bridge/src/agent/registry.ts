/**
 * AgentRegistry — maps agentType string to the correct executor.
 */
import { ClaudeCodeExecutor } from "./claude-code.js";
import { AgentExecutor } from "./executor.js";

const registry = new Map<string, AgentExecutor>();

/** Register built-in executors. */
export function initRegistry(): void {
  registry.set("cli", new ClaudeCodeExecutor());
}

/** Get executor for a given agent type. */
export function getExecutor(agentType: string): AgentExecutor {
  const executor = registry.get(agentType);
  if (!executor) {
    throw new Error(`No executor registered for agent type: ${agentType}`);
  }
  return executor;
}
