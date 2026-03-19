# OpenClaw Bridge 架构设计方案

**版本：** v2.0  
**日期：** 2026-03-18  
**作者：** 老张（系统架构师）  
**状态：** 待评审  
**核心设计**：通用 OpenClaw Agent Bridge — 每个 Agent Session 都能注册到 Nexus Gateway

---

## 1. 概述

### 1.1 什么是 OpenClaw Bridge

OpenClaw Bridge 是一个**通用的 Nexus Bridge 客户端**，让任意 OpenClaw Agent Session 都能注册到 Nexus Gateway 成为工作流执行节点。

```bash
# 不同的 agent 实例
openclaw-bridge --agent main       # 主 agent（协调/决策/用户沟通）
openclaw-bridge --agent architect  # 架构师（评审/设计）
openclaw-bridge --agent writer     # 写手（文案/文档）
openclaw-bridge --agent reviewer   # 审查员（代码审查）
```

### 1.2 与 oc-bridge 的对比

| 特性 | oc-bridge | openclaw-bridge |
|------|-----------|-----------------|
| **执行者** | Claude Code CLI（外部进程） | OpenClaw Agent Session（内部调用） |
| **运行模式** | 单一实例 | 多实例（每个 agent 一个） |
| **执行方式** | `claude --print "prompt"` | OpenClaw session API |
| **任务类型** | 代码开发、文件操作 | 决策、沟通、协调、评审 |
| **交互能力** | 无（单次执行） | 有（多轮对话、飞书通信） |
| **状态** | 无状态 | 有状态（记忆、会话上下文） |
| **标识** | bridgeId | bridgeId + agentId |

### 1.3 核心价值

1. **多 Agent 协作**：architect → programmer → reviewer → writer 全链路自动化
2. **有状态执行**：利用 Agent Session 的记忆和上下文
3. **双向通信**：支持飞书/Telegram 等渠道与用户交互
4. **远程接入**：Nexus 迁移后仍可连接
5. **完全自主**：从提交到完成全链路自动化

---

## 2. 整体架构

### 2.1 多实例架构

```mermaid
graph TB
    subgraph "Nexus Gateway"
        WSServer["WebSocket Server"]
        BridgeMgr["Bridge Manager"]
        TaskRouter["Task Router"]
    end
    
    subgraph "OpenClaw 服务器"
        subgraph "OpenClaw Core"
            SessionMgr["Session Manager"]
            AgentMain["main session"]
            AgentArch["architect session"]
            AgentWriter["writer session"]
            AgentRev["reviewer session"]
        end
        
        subgraph "Bridge 实例群"
            Bridge1["openclaw-bridge<br/>--agent main"]
            Bridge2["openclaw-bridge<br/>--agent architect"]
            Bridge3["openclaw-bridge<br/>--agent writer"]
            Bridge4["openclaw-bridge<br/>--agent reviewer"]
        end
    end
    
    subgraph "外部"
        OCBridge["oc-bridge<br/>--bridge-id oc-001"]
        CLI1["Claude Code CLI 1"]
        CLI2["Claude Code CLI 2"]
    end
    
    WSServer <-->|"ws + auth"|<--> Bridge1
    WSServer <-->|"ws + auth"|<--> Bridge2
    WSServer <-->|"ws + auth"|<--> Bridge3
    WSServer <-->|"ws + auth"|<--> Bridge4
    WSServer <-->|"ws + auth"|<--> OCBridge
    
    Bridge1 -->|"内部调用"|<--> AgentMain
    Bridge2 -->|"内部调用"|<--> AgentArch
    Bridge3 -->|"内部调用"|<--> AgentWriter
    Bridge4 -->|"内部调用"|<--> AgentRev
    
    OCBridge -->|"spawn"|<--> CLI1
    OCBridge -->|"spawn"|<--> CLI2
    
    TaskRouter -->|"route by agentId"|<--> Bridge1
    TaskRouter -->|"route by agentId"|<--> Bridge2
```

### 2.2 工作流示例

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Nexus 工作流                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Input: 产品需求文档]                                               │
│        │                                                            │
│        ▼                                                            │
│  ┌─────────────────┐                                                │
│  │ Agent: architect │  ← openclaw-bridge --agent architect          │
│  │ (架构评审/拆解)   │     产出：技术方案 + 子任务列表                  │
│  └────────┬────────┘                                                │
│           │                                                         │
│     ┌─────┴─────┐                                                   │
│     ▼           ▼                                                   │
│  ┌──────┐   ┌──────┐                                                │
│  │ cc-1 │   │ cc-2 │  ← oc-bridge (Claude Code CLI)                 │
│  │(开发) │   │(开发) │     并行执行开发任务                           │
│  └──┬───┘   └───┬──┘                                                │
│     │           │                                                   │
│     └─────┬─────┘                                                   │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │ Agent: reviewer │  ← openclaw-bridge --agent reviewer            │
│  │ (代码审查)       │     产出：审查报告 + 改进建议                    │
│  └────────┬────────┘                                                │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │ Agent: writer   │  ← openclaw-bridge --agent writer              │
│  │ (生成文档)       │     产出：CHANGELOG / 用户文档                  │
│  └────────┬────────┘                                                │
│           │                                                         │
│           ▼                                                         │
│  [Result Output]                                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 协议设计

### 3.1 协议复用与扩展

**完全复用** oc-bridge 的基础协议，**新增** agentId 相关字段：

```
┌─────────────────────────────────────────────────────────────────┐
│                       共享协议层                                 │
├─────────────────────────────────────────────────────────────────┤
│  auth.request / auth.response                                   │
│  bridge.register / bridge.registered    ← 新增 agentId 字段     │
│  task.submit / task.ack / task.progress / task.complete         │
│  task.confirm / task.confirmed          ← 新增：需要人工确认     │
│  ping / pong                                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 注册消息扩展

```typescript
// Bridge → Server: 注册
interface BridgeRegister {
  type: "bridge.register";
  bridgeId: string;           // 唯一标识
  agentId?: string;           // NEW: agent 类型标识
  agentCapabilities?: string[]; // NEW: 能力声明
  platform: string;
  hostname: string;
  osVersion: string;
  nodeVersion: string;
  bridgeVersion: string;
  adapters: AdapterInfo[];
  activeTasks: number;
  maxConcurrent: number;
}

// 示例：architect agent 注册
{
  "type": "bridge.register",
  "bridgeId": "openclaw-architect-001",
  "agentId": "architect",
  "agentCapabilities": [
    "architecture_review",
    "task_decomposition",
    "technical_design"
  ],
  "platform": "linux",
  "hostname": "openclaw-server",
  "adapters": [{
    "type": "openclaw",
    "name": "architect",
    "version": "1.0.0",
    "executablePath": "internal://openclaw/session/architect"
  }],
  "maxConcurrent": 1
}
```

### 3.3 任务消息扩展

```typescript
// Server → Bridge: 任务分发
interface TaskSubmit {
  type: "task.submit";
  taskId: string;
  prompt: string;
  projectPath: string;
  agentType: string;          // "openclaw" | "cli" | ...
  agentId?: string;           // NEW: 目标 agent（可选）
  timeout: number;
  priority: string;
  preferredIde: string | null;
  context?: {                 // NEW: 任务上下文
    workflowId?: string;
    nodeId?: string;
    parentTaskId?: string;
    artifacts?: Record<string, unknown>;
  };
}

// Bridge → Server: 需要人工确认（新增）
interface TaskConfirm {
  type: "task.confirm";
  taskId: string;
  question: string;
  options?: string[];
  timeout?: number;           // 等待确认的超时时间
  ts: number;
}

// Server → Bridge: 确认响应（新增）
interface TaskConfirmed {
  type: "task.confirmed";
  taskId: string;
  confirmed: boolean;
  selectedOption?: string;
  userResponse?: string;
  ts: number;
}

// Bridge → Server: 任务完成
interface TaskComplete {
  type: "task.complete";
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  changedFiles?: string[];
  artifacts?: Record<string, unknown>;  // NEW: 产出物
  duration?: number;
  ts: number;
}
```

### 3.4 Gateway 路由逻辑

```python
# backend/app/services/gateway/task_router.py

class TaskRouter:
    def route_task(self, task: TaskSubmit) -> str:
        """根据 agentType 和 agentId 路由任务到正确的 bridge"""
        
        # 1. 如果指定了 agentId，精确匹配
        if task.agentId:
            bridge = self.find_bridge_by_agent_id(task.agentId)
            if bridge:
                return bridge.bridge_id
            raise NoBridgeAvailable(f"No bridge for agentId: {task.agentId}")
        
        # 2. 否则按 agentType 负载均衡
        bridges = self.find_bridges_by_type(task.agentType)
        if not bridges:
            raise NoBridgeAvailable(f"No bridge for agentType: {task.agentType}")
        
        # 选择负载最低的 bridge
        return min(bridges, key=lambda b: b.active_tasks).bridge_id
    
    def find_bridge_by_agent_id(self, agent_id: str) -> BridgeInfo | None:
        for bridge in self.bridges.values():
            if bridge.agent_id == agent_id and bridge.status == "online":
                return bridge
        return None
```

---

## 4. 核心模块设计

### 4.1 目录结构

```
bridges/
├── shared/                          # 共享模块
│   ├── src/
│   │   ├── protocol/
│   │   │   └── types.ts             # 协议类型定义
│   │   ├── websocket/
│   │   │   └── connection.ts        # WebSocket 连接
│   │   ├── task/
│   │   │   └── manager.ts           # 任务管理
│   │   └── utils/
│   │       ├── retry.ts
│   │       └── logger.ts
│   └── package.json
│
├── oc-bridge/                       # 现有：Claude Code CLI
│   └── ...
│
└── openclaw-bridge/                 # 新增：OpenClaw Agent
    ├── src/
    │   ├── index.ts                 # CLI 入口
    │   ├── commands/
    │   │   ├── setup.ts             # 配置命令
    │   │   ├── start.ts             # 启动命令
    │   │   └── status.ts            # 状态命令
    │   ├── executor/
    │   │   ├── base.ts              # 执行器基类
    │   │   └── openclaw.ts          # OpenClaw 执行器
    │   ├── session/
    │   │   ├── manager.ts           # Session 管理
    │   │   └── communication.ts     # 通信（飞书等）
    │   ├── confirm/
    │   │   └── handler.ts           # 确认请求处理
    │   ├── registry.ts              # Agent 注册
    │   ├── config.ts                # 配置管理
    │   └── state.ts                 # 状态持久化
    ├── package.json
    └── tsconfig.json
```

### 4.2 CLI 入口

```typescript
// bridges/openclaw-bridge/src/index.ts

import { Command } from "commander";
import { setupCommand } from "./commands/setup.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";

const BRIDGE_VERSION = "1.0.0";

const program = new Command();

program
  .name("openclaw-bridge")
  .description("Universal OpenClaw Agent Bridge for Nexus Gateway")
  .version(BRIDGE_VERSION);

program.addCommand(setupCommand());
program.addCommand(startCommand());
program.addCommand(statusCommand());

program.parse();
```

### 4.3 启动命令

```typescript
// bridges/openclaw-bridge/src/commands/start.ts

import { Command } from "commander";
import { WSConnection } from "@nexus-bridge/shared/websocket";
import { TaskManager } from "@nexus-bridge/shared/task";
import { OpenClawExecutor } from "../executor/openclaw.js";
import { initRegistry } from "../registry.js";
import { loadConfig } from "../config.js";
import { checkPreviousSession } from "../state.js";
import { logger } from "@nexus-bridge/shared/logger";

export function startCommand(): Command {
  return new Command("start")
    .description("Start the bridge client")
    .requiredOption("-a, --agent <type>", "Agent type (main|architect|writer|reviewer|...)")
    .option("-v, --verbose", "Enable verbose logging", false)
    .option("-c, --config <path>", "Config file path")
    .action(async (options) => {
      if (options.verbose) {
        process.env.LOG_LEVEL = "debug";
      }

      // 加载配置（根据 agent 类型）
      const config = loadConfig(options.agent, options.config);
      if (!config) {
        console.error(`❌ No configuration found for agent: ${options.agent}`);
        console.error("   Run 'setup' first.");
        process.exit(1);
      }

      // 检查未完成任务
      const unfinished = checkPreviousSession(options.agent);
      if (unfinished.length > 0) {
        logger.warn(`Found ${unfinished.length} unfinished task(s) from previous session`);
      }

      // 初始化执行器
      initRegistry(config);

      // 创建 Task Manager
      const taskManager = new TaskManager(config.maxConcurrent, {
        send: (msg) => connection.send(msg),
      });

      // 创建 WebSocket 连接
      const connection = new WSConnection(config, async (event) => {
        switch (event.type) {
          case "registered":
            logger.info(`✅ Registered as ${config.agentId} (${config.bridgeId})`);
            // 恢复任务
            for (const task of event.resumedTasks) {
              taskManager.submit(task);
            }
            break;

          case "task.submit":
            taskManager.submit(event.task);
            break;

          case "task.cancel":
            taskManager.cancel(event.task.taskId);
            break;

          case "task.confirmed":
            taskManager.handleConfirmation(
              event.taskId,
              event.confirmed,
              event.selectedOption,
              event.userResponse,
            );
            break;

          case "disconnected":
            logger.warn(`Disconnected: code=${event.code}`);
            break;

          case "error":
            logger.error(`Connection error: ${event.error}`);
            break;
        }
      });

      // 优雅关闭
      const shutdown = async () => {
        logger.info("Shutting down...");
        taskManager.stopAccepting();
        await taskManager.drainRunning(30_000);
        connection.disconnect();
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);

      // 启动
      try {
        await connection.connect();
        logger.info(`🚀 OpenClaw Bridge started (agent=${config.agentId})`);
      } catch (err) {
        logger.error(`Failed to start: ${err}`);
        process.exit(1);
      }
    });
}
```

### 4.4 配置管理

```typescript
// bridges/openclaw-bridge/src/config.ts

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { v4 } from "uuid";

export interface AgentCapability {
  id: string;
  name: string;
  description?: string;
}

export interface BridgeConfig {
  // 连接配置
  serverUrl: string;
  token: string;
  bridgeId: string;
  maxConcurrent: number;

  // Agent 配置
  agentId: string;                    // agent 类型标识
  agentName: string;                  // 显示名称
  agentCapabilities: string[];        // 能力列表

  // OpenClaw 配置
  openclawApiUrl: string;
  openclawSessionKey: string;         // session 路由 key
  internalToken: string;

  // 模型配置
  defaultModel: string;

  // 通信配置
  communicationChannel?: "feishu" | "telegram" | "none";
  feishuWebhook?: string;
}

export const CONFIG_DIR = path.join(os.homedir(), ".openclaw-bridge");

// 预定义的 Agent 配置模板
const AGENT_TEMPLATES: Record<string, Partial<BridgeConfig>> = {
  main: {
    agentName: "主 Agent",
    agentCapabilities: [
      "decision_making",
      "user_communication",
      "task_coordination",
      "cross_system_ops",
    ],
    maxConcurrent: 1,
  },
  architect: {
    agentName: "架构师",
    agentCapabilities: [
      "architecture_review",
      "task_decomposition",
      "technical_design",
      "risk_assessment",
    ],
    maxConcurrent: 2,
  },
  writer: {
    agentName: "写手",
    agentCapabilities: [
      "document_writing",
      "changelog_generation",
      "translation",
    ],
    maxConcurrent: 3,
  },
  reviewer: {
    agentName: "审查员",
    agentCapabilities: [
      "code_review",
      "security_audit",
      "quality_assurance",
    ],
    maxConcurrent: 2,
  },
};

export function loadConfig(agentId: string, configPath?: string): BridgeConfig | null {
  const file = configPath || path.join(CONFIG_DIR, "agents", `${agentId}.json`);
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as BridgeConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: BridgeConfig): void {
  const file = path.join(CONFIG_DIR, "agents", `${config.agentId}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2), "utf-8");
  fs.chmodSync(file, 0o600);
}

export function getAgentTemplate(agentId: string): Partial<BridgeConfig> {
  return AGENT_TEMPLATES[agentId] || {
    agentName: agentId,
    agentCapabilities: [],
    maxConcurrent: 1,
  };
}

export function generateBridgeId(agentId: string): string {
  const existing = loadConfig(agentId);
  if (existing?.bridgeId) return existing.bridgeId;

  const id = `openclaw-${agentId}-${v4().slice(0, 8)}`;
  return id;
}
```

### 4.5 OpenClaw 执行器

```typescript
// bridges/openclaw-bridge/src/executor/openclaw.ts

import { AgentExecutor } from "./base.js";
import type { Task, ExecutionResult } from "../task/types.js";
import type { BridgeConfig } from "../config.js";
import { logger } from "@nexus-bridge/shared/logger";
import { sendConfirmation } from "../confirm/handler.js";

interface OpenClawSession {
  sessionId: string;
  status: "active" | "idle" | "closed";
}

interface OpenClawResponse {
  content: string;
  changedFiles: string[];
  artifacts: Record<string, unknown>;
  needsConfirmation?: boolean;
  confirmationQuestion?: string;
  confirmationOptions?: string[];
}

export class OpenClawExecutor extends AgentExecutor {
  private config: BridgeConfig;
  private pendingConfirmations: Map<string, {
    resolve: (confirmed: boolean, option?: string, response?: string) => void;
    timer: NodeJS.Timeout;
  }> = new Map();

  constructor(config: BridgeConfig) {
    super();
    this.config = config;
  }

  async execute(
    task: Task,
    onProgress: (progress: number) => void,
    signal: AbortSignal,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info(`[${this.config.agentId}] Starting task ${task.taskId}`);
      onProgress(5);

      // 1. 创建或复用 Session
      const session = await this.getOrCreateSession(task);
      onProgress(10);

      // 2. 构建 prompt（注入上下文）
      const enrichedPrompt = this.buildPrompt(task);
      onProgress(15);

      // 3. 执行
      const response = await this.executePrompt(
        session.sessionId,
        enrichedPrompt,
        {
          onProgress: (p) => onProgress(15 + p * 0.75),
          signal,
        },
      );

      // 4. 处理确认请求
      if (response.needsConfirmation) {
        onProgress(90);
        
        const confirmed = await this.requestConfirmation(
          task.taskId,
          response.confirmationQuestion || "需要确认",
          response.confirmationOptions,
        );

        if (!confirmed) {
          return {
            success: false,
            output: "用户取消了操作",
            exitCode: 130,
            duration: (Date.now() - startTime) / 1000,
          };
        }

        // 继续执行
        onProgress(92);
        const finalResponse = await this.continueAfterConfirmation(
          session.sessionId,
          task.taskId,
        );
        Object.assign(response, finalResponse);
      }

      onProgress(100);

      return {
        success: true,
        output: response.content,
        exitCode: 0,
        changedFiles: response.changedFiles,
        artifacts: response.artifacts,
        duration: (Date.now() - startTime) / 1000,
      };

    } catch (err) {
      const duration = (Date.now() - startTime) / 1000;
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (signal.aborted) {
        logger.warn(`[${this.config.agentId}] Task ${task.taskId} aborted`);
        return {
          success: false,
          output: "",
          exitCode: 130,
          error: "Task cancelled or timed out",
          duration,
        };
      }

      logger.error(`[${this.config.agentId}] Task ${task.taskId} failed: ${errorMsg}`);
      return {
        success: false,
        output: "",
        exitCode: 1,
        error: errorMsg,
        duration,
      };
    }
  }

  /**
   * 获取或创建 OpenClaw Session
   */
  private async getOrCreateSession(task: Task): Promise<OpenClawSession> {
    // 检查是否有活跃 session
    const activeSession = await this.getActiveSession();
    if (activeSession) {
      return activeSession;
    }

    // 创建新 session
    const response = await fetch(`${this.config.openclawApiUrl}/api/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.internalToken}`,
      },
      body: JSON.stringify({
        agentId: this.config.agentId,
        sessionKey: this.config.openclawSessionKey,
        workingDirectory: task.projectPath,
        model: this.config.defaultModel,
        metadata: {
          taskId: task.taskId,
          source: "nexus-bridge",
          bridgeId: this.config.bridgeId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 构建增强 prompt
   */
  private buildPrompt(task: Task): string {
    const parts: string[] = [];

    // 任务上下文
    if (task.context) {
      parts.push("## 任务上下文");
      if (task.context.workflowId) {
        parts.push(`- 工作流 ID: ${task.context.workflowId}`);
      }
      if (task.context.parentTaskId) {
        parts.push(`- 父任务: ${task.context.parentTaskId}`);
      }
      if (task.context.artifacts) {
        parts.push("- 上游产出:");
        for (const [key, value] of Object.entries(task.context.artifacts)) {
          parts.push(`  - ${key}: ${JSON.stringify(value).slice(0, 200)}...`);
        }
      }
      parts.push("");
    }

    // 主 prompt
    parts.push("## 任务要求");
    parts.push(task.prompt);
    parts.push("");

    // Agent 能力提示
    parts.push("## 你的角色");
    parts.push(`你是 ${this.config.agentName}，具备以下能力：`);
    for (const cap of this.config.agentCapabilities) {
      parts.push(`- ${cap}`);
    }
    parts.push("");

    // 输出提示
    parts.push("## 输出要求");
    parts.push("完成任务后，请提供：");
    parts.push("1. 执行结果摘要");
    parts.push("2. 关键产出物（如有）");
    parts.push("3. 后续建议（如有）");

    return parts.join("\n");
  }

  /**
   * 执行 prompt
   */
  private async executePrompt(
    sessionId: string,
    prompt: string,
    options: {
      onProgress: (progress: number) => void;
      signal: AbortSignal;
    },
  ): Promise<OpenClawResponse> {
    const response = await fetch(
      `${this.config.openclawApiUrl}/api/v1/sessions/${sessionId}/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.internalToken}`,
        },
        body: JSON.stringify({ prompt, stream: true }),
        signal: options.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Execute failed: ${response.status}`);
    }

    return this.parseStreamResponse(response, options.onProgress);
  }

  /**
   * 解析 SSE 流式响应
   */
  private async parseStreamResponse(
    response: Response,
    onProgress: (progress: number) => void,
  ): Promise<OpenClawResponse> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    let content = "";
    const changedFiles: string[] = [];
    const artifacts: Record<string, unknown> = {};
    let needsConfirmation = false;
    let confirmationQuestion: string | undefined;
    let confirmationOptions: string[] | undefined;
    let progress = 0;

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;

        try {
          const data = JSON.parse(line.slice(6));

          switch (data.type) {
            case "content":
              content += data.delta || "";
              progress = Math.min(progress + 1, 85);
              onProgress(progress);
              break;

            case "file_change":
              if (data.path) changedFiles.push(data.path);
              break;

            case "artifact":
              if (data.key && data.value !== undefined) {
                artifacts[data.key] = data.value;
              }
              break;

            case "confirm_request":
              needsConfirmation = true;
              confirmationQuestion = data.question;
              confirmationOptions = data.options;
              break;

            case "complete":
              content = data.final_content || content;
              Object.assign(artifacts, data.artifacts || {});
              break;

            case "error":
              throw new Error(data.message || "Execution error");
          }
        } catch (parseErr) {
          logger.debug(`Parse error: ${parseErr}`);
        }
      }
    }

    return {
      content,
      changedFiles,
      artifacts,
      needsConfirmation,
      confirmationQuestion,
      confirmationOptions,
    };
  }

  /**
   * 请求用户确认
   */
  private async requestConfirmation(
    taskId: string,
    question: string,
    options?: string[],
  ): Promise<{ confirmed: boolean; selectedOption?: string; response?: string }> {
    return new Promise((resolve) => {
      // 设置超时（默认 5 分钟）
      const timeout = 5 * 60 * 1000;
      const timer = setTimeout(() => {
        this.pendingConfirmations.delete(taskId);
        resolve({ confirmed: false });
      }, timeout);

      this.pendingConfirmations.set(taskId, {
        resolve: (confirmed, selectedOption, response) => {
          clearTimeout(timer);
          this.pendingConfirmations.delete(taskId);
          resolve({ confirmed, selectedOption, response });
        },
        timer,
      });

      // 发送确认请求到 Gateway
      sendConfirmation(taskId, question, options, timeout);
    });
  }

  /**
   * 处理外部确认响应
   */
  handleConfirmation(
    taskId: string,
    confirmed: boolean,
    selectedOption?: string,
    userResponse?: string,
  ): void {
    const pending = this.pendingConfirmations.get(taskId);
    if (pending) {
      pending.resolve(confirmed, selectedOption, userResponse);
    }
  }

  /**
   * 确认后继续执行
   */
  private async continueAfterConfirmation(
    sessionId: string,
    taskId: string,
  ): Promise<Partial<OpenClawResponse>> {
    // 发送确认信号到 session
    const response = await fetch(
      `${this.config.openclawApiUrl}/api/v1/sessions/${sessionId}/continue`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.internalToken}`,
        },
        body: JSON.stringify({ taskId, action: "confirmed" }),
      },
    );

    if (!response.ok) {
      throw new Error(`Continue failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 获取活跃 session
   */
  private async getActiveSession(): Promise<OpenClawSession | null> {
    try {
      const response = await fetch(
        `${this.config.openclawApiUrl}/api/v1/sessions/active?agentId=${this.config.agentId}`,
        {
          headers: {
            "Authorization": `Bearer ${this.config.internalToken}`,
          },
        },
      );

      if (response.ok) {
        const sessions = await response.json();
        if (sessions.length > 0) {
          return sessions[0];
        }
      }
    } catch (err) {
      logger.debug(`No active session: ${err}`);
    }
    return null;
  }
}
```

### 4.6 确认请求处理

```typescript
// bridges/openclaw-bridge/src/confirm/handler.ts

import type { TaskConfirm } from "@nexus-bridge/shared/protocol";
import { logger } from "@nexus-bridge/shared/logger";

let sender: { send: (msg: unknown) => void } | null = null;

export function setSender(s: { send: (msg: unknown) => void }): void {
  sender = s;
}

export function sendConfirmation(
  taskId: string,
  question: string,
  options?: string[],
  timeout?: number,
): void {
  if (!sender) {
    logger.error("No sender configured for confirmations");
    return;
  }

  const msg: TaskConfirm = {
    type: "task.confirm",
    taskId,
    question,
    options,
    timeout,
    ts: Date.now(),
  };

  sender.send(msg);
  logger.info(`Sent confirmation request for task ${taskId}: ${question}`);
}
```

---

## 5. OpenClaw API 需求

### 5.1 Session 管理 API

```
POST /api/v1/sessions
  - 创建 session
  - Body: { agentId, sessionKey, workingDirectory, model, metadata }
  - Response: { sessionId, status }

GET /api/v1/sessions/active?agentId={agentId}
  - 获取活跃 session
  - Response: [{ sessionId, status, ... }]

DELETE /api/v1/sessions/{sessionId}
  - 关闭 session
```

### 5.2 执行 API

```
POST /api/v1/sessions/{sessionId}/execute
  - 执行 prompt（SSE 流式）
  - Body: { prompt, stream: true }
  - Response: SSE stream
    event: content
    data: {"type":"content","delta":"..."}

    event: file_change
    data: {"type":"file_change","path":"..."}

    event: artifact
    data: {"type":"artifact","key":"...","value":...}

    event: confirm_request
    data: {"type":"confirm_request","question":"...","options":[...]}

    event: complete
    data: {"type":"complete","final_content":"...","artifacts":{...}}

POST /api/v1/sessions/{sessionId}/continue
  - 确认后继续
  - Body: { taskId, action: "confirmed" }
```

### 5.3 SSE 事件类型

| 事件类型 | 说明 | 数据 |
|---------|------|------|
| `content` | 内容增量 | `{ delta: string }` |
| `tool_use` | 工具调用 | `{ tool_name, status }` |
| `file_change` | 文件变更 | `{ path, action }` |
| `artifact` | 产出物 | `{ key, value }` |
| `confirm_request` | 需要确认 | `{ question, options }` |
| `complete` | 执行完成 | `{ final_content, artifacts }` |
| `error` | 错误 | `{ message, code }` |

---

## 6. Gateway 扩展

### 6.1 BridgeInfo 扩展

```python
# backend/app/models/gateway_schemas.py

class AdapterInfo(BaseModel):
    type: str
    name: str
    version: str
    executable_path: str

class BridgeInfo(BaseModel):
    bridge_id: str
    platform: str
    hostname: str
    os_version: str
    node_version: str
    bridge_version: str
    status: BridgeStatus
    last_seen: int
    available_adapters: list[AdapterInfo]
    active_tasks: int
    max_concurrent: int
    created_at: int
    updated_at: int
    
    # 新增字段
    agent_id: str | None = None
    agent_capabilities: list[str] = []
```

### 6.2 TaskSubmit 扩展

```python
# backend/app/models/gateway_schemas.py

class TaskSubmit(BaseModel):
    type: Literal["task.submit"] = "task.submit"
    task_id: str
    prompt: str
    project_path: str
    agent_type: str
    timeout: int
    priority: str
    preferred_ide: str | None
    
    # 新增字段
    agent_id: str | None = None
    context: dict | None = None
```

### 6.3 确认消息处理

```python
# backend/app/services/gateway/ws_server.py

async def _handle_task_confirm(self, bridge_id: str, data: dict) -> None:
    """Handle task.confirm message."""
    task_id = data.get("taskId", "unknown")
    question = data.get("question", "")
    options = data.get("options")
    timeout = data.get("timeout", 300000)  # 5 minutes
    
    logger.info(f"Task {task_id} needs confirmation from Bridge {bridge_id}")
    
    # 存储确认请求
    await self.confirmation_manager.store(
        task_id=task_id,
        bridge_id=bridge_id,
        question=question,
        options=options,
        timeout=timeout,
    )
    
    # TODO: 通知前端/用户
    # 可以通过 WebSocket 推送到前端，或调用飞书 API

async def _handle_task_confirmed(self, bridge_id: str, data: dict) -> None:
    """Handle task.confirmed message (from user/frontend)."""
    task_id = data.get("taskId")
    confirmed = data.get("confirmed", False)
    selected_option = data.get("selectedOption")
    user_response = data.get("userResponse")
    
    # 转发给对应的 bridge
    bridge = self.get_bridge_for_task(task_id)
    if bridge:
        await self.send_message(bridge, {
            "type": "task.confirmed",
            "taskId": task_id,
            "confirmed": confirmed,
            "selectedOption": selected_option,
            "userResponse": user_response,
            "ts": int(time.time() * 1000),
        })
```

---

## 7. 部署架构

### 7.1 多实例部署

```bash
# 配置各个 agent
openclaw-bridge setup --agent main \
  --server ws://nexus.example.com/api/v1/gateway/ws \
  --token your-token \
  --openclaw-url http://localhost:8080

openclaw-bridge setup --agent architect \
  --server ws://nexus.example.com/api/v1/gateway/ws \
  --token your-token \
  --openclaw-url http://localhost:8080

openclaw-bridge setup --agent writer \
  --server ws://nexus.example.com/api/v1/gateway/ws \
  --token your-token \
  --openclaw-url http://localhost:8080

# 启动
openclaw-bridge start --agent main &
openclaw-bridge start --agent architect &
openclaw-bridge start --agent writer &
```

### 7.2 Systemd 服务

```ini
# /etc/systemd/system/openclaw-bridge@.service
[Unit]
Description=OpenClaw Bridge (%i)
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/openclaw
ExecStart=/usr/local/bin/openclaw-bridge start --agent %i
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 启动各 agent
systemctl enable --now openclaw-bridge@main
systemctl enable --now openclaw-bridge@architect
systemctl enable --now openclaw-bridge@writer
systemctl enable --now openclaw-bridge@reviewer
```

---

## 8. 开发计划

### Phase 1: 共享模块（1 周）
- [ ] 创建 `bridges/shared/` 目录
- [ ] 抽取协议类型定义
- [ ] 抽取 WebSocket 连接逻辑
- [ ] 抽取任务管理逻辑
- [ ] 重构 oc-bridge 使用共享模块

### Phase 2: Bridge 核心（1.5 周）
- [ ] 实现 CLI 入口（--agent 参数）
- [ ] 实现配置管理（按 agent 分离）
- [ ] 实现 OpenClawExecutor
- [ ] 实现确认请求机制

### Phase 3: Gateway 扩展（0.5 周）
- [ ] BridgeInfo 扩展（agentId, capabilities）
- [ ] TaskSubmit 扩展（agentId, context）
- [ ] 任务路由逻辑
- [ ] 确认消息处理

### Phase 4: OpenClaw API（1 周）
- [ ] Session 管理 API
- [ ] 执行 API（SSE）
- [ ] 确认/继续机制

### Phase 5: 集成测试（1 周）
- [ ] 单元测试
- [ ] Gateway 集成测试
- [ ] 工作流端到端测试
- [ ] 性能测试

---

## 9. 风险与应对

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|---------|
| Session 状态冲突 | 中 | 高 | 每个 agent 独立 session key |
| 确认超时 | 中 | 中 | 默认 5 分钟超时，可配置 |
| 多实例资源竞争 | 低 | 中 | maxConcurrent 限制 |
| 网络断连恢复 | 中 | 中 | WebSocket 自动重连 + 状态恢复 |
| 任务路由错误 | 低 | 高 | agentId 精确匹配 + 日志追踪 |

---

## 10. 下一步

```
□ 确认 Agent 类型列表（main/architect/writer/reviewer/...）
□ 确认 OpenClaw API 设计
□ 确认确认机制的用户交互方式（飞书？前端？）
□ 开始 Phase 1 开发
```

---

**文档结束**

v2.0 核心设计：
- 通用 Agent Bridge，支持任意 OpenClaw agent 注册
- `--agent` 参数化启动
- agentId + capabilities 注册
- Gateway 按 agentId 路由任务
- 确认机制支持人工介入
- SSE 流式执行 + 产出物
