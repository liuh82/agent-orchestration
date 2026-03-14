import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { resolve, normalize, isAbsolute } from 'path';
import which from 'which';
import type { AgentAdapter, ExecuteRequest, ExecuteResult, AdapterInfo } from './types.js';
import type { AgentType } from '../protocol/types.js';
import { IS_WINDOWS } from '../platform/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('cli-adapter');

interface CLIConfig {
  enabled: boolean;
  path?: string;
  allowedBasePaths?: string[];
}

interface CLIAgentMapping {
  [key: string]: { command: string; args: (prompt: string) => string[] };
}

const AGENT_MAPPINGS: CLIAgentMapping = {
  codex: {
    command: 'codex',
    args: (prompt: string) => ['--quiet', prompt, '--cwd', process.cwd()],
  },
  pi: {
    command: 'pi',
    args: (prompt: string) => [prompt],
  },
  acp: {
    command: 'openclaw',
    args: (prompt: string) => ['acp', '--session', 'default', prompt],
  },
  npm: {
    command: 'npm',
    args: (prompt: string) => {
      const sanitized = sanitizePromptForSplitArgs(prompt);
      if (sanitized === null) {
        throw new Error('npm prompt contains shell metacharacters or is empty');
      }
      return sanitized.split(/\s+/);
    },
  },
  npx: {
    command: 'npx',
    args: (prompt: string) => {
      const sanitized = sanitizePromptForSplitArgs(prompt);
      if (sanitized === null) {
        throw new Error('npx prompt contains shell metacharacters or is empty');
      }
      return sanitized.split(/\s+/);
    },
  },
};

const ALLOWED_AGENT_TYPES = Object.keys(AGENT_MAPPINGS);

/** Shell metacharacters that could enable command injection when passed as args */
const SHELL_METACHAR_PATTERN = /[;&|`$><!()\[\]{}\\~\*\?#]/;

function validateAgentType(agentType: string): void {
  if (!agentType || !ALLOWED_AGENT_TYPES.includes(agentType)) {
    const err = new Error(
      `Forbidden agent type: "${agentType}". Allowed: ${ALLOWED_AGENT_TYPES.join(', ')}`
    );
    logger.error('Agent type validation failed', { agentType });
    throw err;
  }
}

/**
 * Sanitize a prompt string for safe use as CLI arguments.
 * Rejects prompts containing shell metacharacters when used with split-based arg mapping.
 * Returns null if the prompt is unsafe.
 */
function sanitizePromptForSplitArgs(prompt: string): string | null {
  if (!prompt || !prompt.trim()) {
    return null;
  }
  if (SHELL_METACHAR_PATTERN.test(prompt)) {
    return null;
  }
  return prompt.trim();
}

/**
 * Validate that a working directory path does not escape allowed base paths.
 * Resolves and normalizes the path, then checks it starts with an allowed base.
 * Prevents path traversal attacks like "../../../../etc".
 */
function validateCwd(cwd: string, allowedPaths: string[]): string {
  if (!cwd || typeof cwd !== 'string') {
    throw new Error('Working directory is required');
  }

  const resolved = resolve(normalize(cwd));

  if (!isAbsolute(resolved)) {
    throw new Error(`Working directory must be absolute: ${cwd}`);
  }

  if (!allowedPaths.some((base) => resolved.startsWith(resolve(base)))) {
    throw new Error(
      `Working directory not allowed: ${cwd}. Allowed bases: ${allowedPaths.join(', ')}`
    );
  }

  return resolved;
}

export class CLIAdapter implements AgentAdapter {
  readonly type: AgentType = 'cli';

  private processes = new Map<string, ChildProcess>();
  private agentConfigs: Map<string, CLIConfig>;
  private readonly allowedBasePaths: string[];

  constructor(agentConfigs: Map<string, CLIConfig> = new Map(), allowedBasePaths?: string[]) {
    this.agentConfigs = agentConfigs;
    this.allowedBasePaths = allowedBasePaths ?? [
      '/home', '/workspace', '/projects', '/tmp',
      process.env['HOME'] || '/home',
    ];
  }

  async isAvailable(): Promise<boolean> {
    const enabledAgents = Array.from(this.agentConfigs.entries())
      .filter(([, config]) => config.enabled)
      .map(([agent]) => agent);

    for (const agent of enabledAgents) {
      const mapping = AGENT_MAPPINGS[agent];
      if (!mapping) continue;

      const path = this.agentConfigs.get(agent)?.path;
      if (path && existsSync(path)) {
        return true;
      }

      try {
        await which(mapping.command);
        return true;
      } catch {
        continue;
      }
    }

    return enabledAgents.length > 0;
  }

  async getInfo(): Promise<AdapterInfo> {
    const availableAgents: string[] = [];

    for (const [agent, config] of this.agentConfigs.entries()) {
      if (!config.enabled) continue;

      const mapping = AGENT_MAPPINGS[agent];
      if (!mapping) continue;

      const path = config.path;
      if (path && existsSync(path)) {
        availableAgents.push(agent);
        continue;
      }

      try {
        await which(mapping.command);
        availableAgents.push(agent);
      } catch {
        continue;
      }
    }

    return {
      type: this.type,
      agentName: 'cli',
      available: availableAgents.length > 0,
      version: process.version,
      executablePath: process.execPath,
    };
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResult> {
    const startTime = Date.now();
    const taskId = request.signal?.reason || `task-${Date.now()}`;

    logger.info(`Executing task`, { taskId, agentType: request.agentType, cwd: request.cwd });

    // Strict whitelist: reject any agentType not in AGENT_MAPPINGS
    validateAgentType(request.agentType);

    // Path traversal prevention: resolve and validate working directory
    const safeCwd = validateCwd(request.cwd, this.allowedBasePaths);

    const mapping = AGENT_MAPPINGS[request.agentType]!;
    const command = mapping.command;
    const args = mapping.args(request.prompt);

    const options = {
      cwd: safeCwd,
      shell: IS_WINDOWS,
      stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'],
    };

    const proc = spawn(command, args, options);

    this.processes.set(taskId, proc);

    let output = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const line = data.toString();
      output += line;
      request.onOutput?.(line);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    return new Promise((resolve, reject) => {
      const timeout = request.timeout || 300000;

      const timeoutHandle = setTimeout(() => {
        logger.warn(`Task timeout`, { taskId, timeout });
        this.killProcess(taskId, proc);
        reject(new Error(`Task timeout after ${timeout}ms`));
      }, timeout);

      request.signal?.addEventListener('abort', () => {
        logger.info(`Task aborted by signal`, { taskId });
        clearTimeout(timeoutHandle);
        this.killProcess(taskId, proc);
        reject(new Error('Task aborted'));
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);
        this.processes.delete(taskId);

        const duration = Date.now() - startTime;
        const result: ExecuteResult = {
          exitCode: code ?? 1,
          output: output || stderr,
          changedFiles: [],
          duration,
          success: code === 0,
        };

        if (code === 0) {
          logger.info(`Task completed`, { taskId, duration });
        } else {
          logger.warn(`Task failed`, { taskId, exitCode: code, stderr });
        }

        resolve(result);
      });

      proc.on('error', (error: Error) => {
        clearTimeout(timeoutHandle);
        this.processes.delete(taskId);
        logger.error(`Task error`, { taskId, error });
        reject(error);
      });
    });
  }

  async cancel(taskId: string): Promise<void> {
    const proc = this.processes.get(taskId);
    if (proc) {
      this.killProcess(taskId, proc);
    }
  }

  dispose(): void {
    logger.info('Disposing CLI adapter');
    for (const [taskId, proc] of this.processes.entries()) {
      this.killProcess(taskId, proc);
    }
    this.processes.clear();
  }

  private killProcess(taskId: string, proc: ChildProcess): void {
    try {
      if (IS_WINDOWS) {
        proc.kill();
      } else {
        proc.kill('SIGTERM');
      }

      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 5000).unref();
    } catch (error) {
      logger.warn('Failed to kill process', { taskId, error });
    }
  }
}

export function createCLIAdapter(
  agentConfigs: Map<string, CLIConfig>,
  allowedBasePaths?: string[],
): CLIAdapter {
  return new CLIAdapter(agentConfigs, allowedBasePaths);
}
