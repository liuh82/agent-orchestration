/**
 * agent-config.ts — 多后端 Agent 配置管理。
 *
 * 管理各后端（Claude / Codex / OpenCode）的独立配置，
 * 包括启用状态、命令路径、默认参数、超时时间、环境变量等。
 *
 * 配置文件路径: ~/.oc-bridge/agents.json
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ---- 类型定义 ----

/** 单个后端的配置 */
export interface AgentBackendConfig {
  /** 是否启用 */
  enabled: boolean;
  /** CLI 命令路径（默认使用 which 查找） */
  commandPath?: string;
  /** 默认追加参数 */
  defaultArgs?: string[];
  /** 任务超时（秒） */
  timeout?: number;
  /** 额外环境变量 */
  envVars?: Record<string, string>;
}

/** 全局 Agent 配置 */
export interface AgentsConfig {
  /** 各后端配置，key 为后端名称（claude / codex / opencode） */
  backends: Record<string, AgentBackendConfig>;
  /** 默认后端 */
  defaultBackend: string;
}

/** 默认配置 */
const DEFAULT_CONFIG: AgentsConfig = {
  backends: {
    claude: {
      enabled: true,
      timeout: 300,
    },
    codex: {
      enabled: true,
      timeout: 300,
    },
    opencode: {
      enabled: true,
      timeout: 300,
    },
  },
  defaultBackend: "claude",
};

// ---- AgentConfigManager ----

export class AgentConfigManager {
  private configPath: string;
  private config: AgentsConfig;

  constructor(configDir?: string) {
    const dir = configDir ?? path.join(os.homedir(), ".oc-bridge");
    this.configPath = path.join(dir, "agents.json");
    this.config = this.load();
  }

  /** 加载配置文件，不存在则返回默认配置 */
  load(): AgentsConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(raw);
        // 合并默认配置，确保新增字段有默认值
        return {
          backends: { ...DEFAULT_CONFIG.backends, ...parsed.backends },
          defaultBackend: parsed.defaultBackend ?? DEFAULT_CONFIG.defaultBackend,
        };
      }
    } catch (err) {
      console.error(`[agent-config] 加载配置失败: ${err}`);
    }
    return { ...DEFAULT_CONFIG };
  }

  /** 保存配置到文件 */
  save(): void {
    try {
      const dir = path.dirname(this.configPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf-8");
    } catch (err) {
      console.error(`[agent-config] 保存配置失败: ${err}`);
    }
  }

  /** 重新从文件加载配置 */
  reload(): AgentsConfig {
    this.config = this.load();
    return this.config;
  }

  /** 获取完整配置 */
  getConfig(): AgentsConfig {
    return this.config;
  }

  /** 获取默认后端名称 */
  getDefaultBackend(): string {
    return this.config.defaultBackend;
  }

  /** 设置默认后端 */
  setDefaultBackend(backend: string): void {
    if (this.config.backends[backend]) {
      this.config.defaultBackend = backend;
      this.save();
    }
  }

  /** 获取指定后端的配置 */
  getBackendConfig(name: string): AgentBackendConfig | undefined {
    return this.config.backends[name];
  }

  /** 更新指定后端的配置 */
  updateBackend(name: string, partial: Partial<AgentBackendConfig>): void {
    if (!this.config.backends[name]) {
      this.config.backends[name] = { enabled: true };
    }
    this.config.backends[name] = {
      ...this.config.backends[name],
      ...partial,
    };
    this.save();
  }

  /** 获取所有已启用的后端名称 */
  getEnabledBackends(): string[] {
    return Object.entries(this.config.backends)
      .filter(([, cfg]) => cfg.enabled)
      .map(([name]) => name);
  }

  /** 获取配置文件路径 */
  getConfigPath(): string {
    return this.configPath;
  }
}

// ---- 单例 ----

let _instance: AgentConfigManager | null = null;

/** 获取全局 AgentConfigManager 单例 */
export function getAgentConfigManager(): AgentConfigManager {
  if (!_instance) {
    _instance = new AgentConfigManager();
  }
  return _instance;
}
