# AI Agent 编排可视化工具 - 架构设计报告 (v1.3)

> 设计日期：2026-03-12
> 更新：多工作流引擎支持

---

## 一、系统架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent Orchestrator                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      React Frontend                               │   │
│  │   • Agent Dashboard    • Workflow Editor    • Cost Analytics    │   │
│  │   • Task Center       • Multi-Company View • Mobile Responsive│   │
│  └──────────────────────────┬──────────────────────────────────────┘   │
│                             │                                            │
│  ┌──────────────────────────┴──────────────────────────────────────┐  │
│  │                       REST API Gateway                             │  │
│  └──────────────────────────┬──────────────────────────────────────┘  │
│                             │                                            │
│  ┌──────────────────────────┴──────────────────────────────────────┐  │
│  │                    Core Services                                   │  │
│  │   • Agent Management   • Workflow Engine  • Task Service        │  │
│  │   • Cost Controller    • Context Manager  • Company/Team Svc  │  │
│  └──────────────────────────┬──────────────────────────────────────┘  │
│                             │                                            │
│  ┌──────────────────────────┴──────────────────────────────────────┐  │
│  │              Agent Adapter Layer (可扩展)                         │  │
│  └──────────────────────────┬──────────────────────────────────────┘  │
│                             │                                            │
│  ┌──────────────────────────┴──────────────────────────────────────┐  │
│  │              Workflow Engine Registry (可插拔)                     │  │
│  │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │  │
│  │   │   Lobster   │ │  OpenViking │ │   Custom    │             │  │
│  │   │   Engine    │ │    Engine    │ │   Engine    │             │  │
│  │   └─────────────┘ └─────────────┘ └─────────────┘             │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 二、多工作流引擎设计

### 2.1 工作流引擎抽象接口

```typescript
interface WorkflowEngine {
  // 引擎标识
  readonly name: string;
  readonly version: string;
  
  // 执行工作流
  execute(workflow: WorkflowDefinition, context: ExecutionContext): Promise<ExecutionResult>;
  
  // 暂停工作流
  pause(executionId: string): Promise<void>;
  
  // 恢复工作流
  resume(executionId: string): Promise<void>;
  
  // 取消工作流
  cancel(executionId: string): Promise<void>;
  
  // 获取执行状态
  getStatus(executionId: string): Promise<ExecutionStatus>;
  
  // 获取执行日志
  getLogs(executionId: string): Promise<LogEntry[]>;
}

// 工作流引擎注册表
class WorkflowEngineRegistry {
  private engines = new Map<string, WorkflowEngine>();
  
  register(engine: WorkflowEngine): void;
  get(name: string): WorkflowEngine | undefined;
  list(): WorkflowEngine[];
}
```

### 2.2 已支持/规划引擎

| 引擎 | 状态 | 特点 |
|------|------|------|
| **Lobster** | 现有 | typed JSON pipeline，支持审批门禁，适合确定性流程 |
| **OpenViking** | 规划 | 记忆驱动，支持上下文传承，适合 AI 协作流程 |
| **Temporal** | 规划 | 分布式事务，持久化执行，适合复杂业务流 |
| **Custom** | 规划 | 用户自定义工作流引擎 |

### 2.3 各引擎适配器

```typescript
// Lobster 引擎适配器
class LobsterWorkflowEngine implements WorkflowEngine {
  readonly name = 'lobster';
  readonly version = '1.0';
  
  async execute(workflow, context) {
    // 调用 lobster CLI 执行
    const result = await execLobster(workflow.definition, context);
    return result;
  }
  
  async pause(executionId) {
    // Lobster 不支持暂停，实现为空操作
  }
  
  async resume(executionId) {
    // Lobster 支持断点续执
    return await lobsterResume(executionId);
  }
}

// OpenViking 引擎适配器
class OpenVikingWorkflowEngine implements WorkflowEngine {
  readonly name = 'openviking';
  readonly version = '1.0';
  
  async execute(workflow, context) {
    // 利用记忆能力驱动工作流
    const memories = await this.recallContext(workflow.projectId);
    return await this.executeWithMemory(workflow, context, memories);
  }
  
  async recallContext(projectId: string): Promise<MemoryContext> {
    // 从 OpenViking 检索相关上下文
    const memories = await openVikingSearch(projectId);
    return this.buildContext(memories);
  }
}

// Temporal 引擎适配器（可选）
class TemporalWorkflowEngine implements WorkflowEngine {
  readonly name = 'temporal';
  readonly version = '1.0';
  
  async execute(workflow, context) {
    // 使用 Temporal 的 workflow client
    const client = await this.getClient();
    const handle = await client.start(workflow.name, {
      workflowId: generateId(),
      input: { workflow, context }
    });
    return await handle.result();
  }
}
```

### 2.4 工作流定义（引擎无关）

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  engine: 'lobster' | 'openviking' | 'temporal' | 'custom';
  definition: any;  // 引擎特定的定义
  config: {
    timeout: number;
    retryPolicy: RetryPolicy;
    approvalGates: ApprovalGate[];
  };
}

// 工作流模板
interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  engine: WorkflowEngineType;
  category: 'development' | 'deployment' | 'custom';
  definition: any;
}
```

---

## 三、工作流选择建议

```
┌─────────────────────────────────────────────────────────────┐
│                   工作流引擎选择指南                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  场景                    推荐引擎        原因                │
│  ─────────────────────────────────────────────────────────  │
│  确定性流程              Lobster        简单、可预测          │
│  AI 协作流程             OpenViking     支持记忆、上下文      │
│  复杂业务事务            Temporal       分布式、可持久化       │
│  自定义流程              Custom         灵活、可扩展          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Lobster 适用场景

- 简单的任务流水线
- 需要审批门禁的流程
- 确定性执行步骤
- 与 OpenClaw 已有集成

### 3.2 OpenViking 适用场景

- 需要跨任务共享上下文
- AI Agent 协作开发
- 需要记忆检索的流程
- 项目知识积累

### 3.3 Temporal 适用场景

-长时间运行的任务
- 需要重试/回滚的事务
- 分布式环境
- 复杂的任务依赖

---

## 四、引擎配置示例

```yaml
workflows:
  # Lobster 工作流
  - name: 简单开发流程
    engine: lobster
    definition: ./.lobster/dev-pipeline.json
    
  # OpenViking 工作流
  - name: AI 协作开发
    engine: openviking
    definition: ./.openviking/ai-workflow.json
    config:
      memory:
        projectId: my-project
        recallOnStart: true
        
  # Temporal 工作流
  - name: 复杂部署流程
    engine: temporal
    definition:
      workflowType: deployPipeline
      taskQueue: deployment
```

---

## 五、后续规划

### 待确认需求

1. **GitHub 集成** - 与 GitHub API 集成
2. **Claude Code 工作流** - 结合 Claude Code 的开发流程
3. **自动 CI/CD** - 自动化部署到其他服务器

---

**报告状态**：v1.3 - 支持多工作流引擎
**下一步**：确认后启动开发
