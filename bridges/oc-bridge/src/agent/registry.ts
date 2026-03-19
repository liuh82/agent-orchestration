/**
 * AgentRegistry — maps agentType string to the correct executor.
 *
 * 支持两种注册模式：
 * 1. AgentExecutor（进程管理）— 用于 TaskManager 调度执行
 * 2. BaseAgent（后端抽象）— 用于 CLI 检测、参数构建、输出解析
 *
 * 每个 Agent 后端应同时注册 executor 和 agent。
 */
import { ClaudeCodeExecutor } from "./claude-code.js";
import { AgentExecutor } from "./executor.js";
import type { BaseAgent } from "./base.js";

const executorRegistry = new Map<string, AgentExecutor>();
const agentRegistry = new Map<string, BaseAgent>();

/** Register built-in executors and agents. */
export function initRegistry(): void {
  const claude = new ClaudeCodeExecutor();
  executorRegistry.set("cli", claude);
  executorRegistry.set("claude", claude);
  agentRegistry.set("claude", claude);
}

/** Register an additional executor (for custom / plugin agents). */
export function registerExecutor(agentType: string, executor: AgentExecutor): void {
  executorRegistry.set(agentType, executor);
}

/** Register an additional agent backend. */
export function registerAgent(agent: BaseAgent): void {
  agentRegistry.set(agent.name, agent);
  // Auto-register executor if it also extends AgentExecutor
  if (agent instanceof AgentExecutor) {
    executorRegistry.set(agent.name, agent);
    executorRegistry.set(agent.name, agent);
  }
}

/** Get executor for a given agent type. */
export function getExecutor(agentType: string): AgentExecutor {
  const executor = executorRegistry.get(agentType);
  if (!executor) {
    throw new Error(`No executor registered for agent type: ${agentType}`);
  }
  return executor;
}

/** Get agent backend by name. */
export function getAgent(name: string): BaseAgent {
  const agent = agentRegistry.get(name);
  if (!agent) {
    throw new Error(`No agent registered: ${name}`);
  }
  return agent;
}

/** Detect all available agents and return those present on the system. */
export async function getAvailableAgents(): Promise<BaseAgent[]> {
  const agents = Array.from(agentRegistry.values());
  const detections = await Promise.all(
    agents.map(async (a) => ({ agent: a, present: await a.detectPresence() })),
  );
  return detections.filter((d) => d.present).map((d) => d.agent);
}

/** List all registered agent names (regardless of presence). */
export function getRegisteredAgentNames(): string[] {
  return Array.from(agentRegistry.keys());
}
