import type { ExecuteRequest } from '../adapters/types.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('sandbox');

const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\s+[\/~]/i,
  /\brmdir\s+[\/~]/i,
  /\bdd\s+if=[^=]+\s+of=[\/~]/i,
  /\bmkfs\b/i,
  /\bformat\s+[a-z]:/i,
  /\bdel\s+[\/f]/i,
  /\bsudo\b/i,
  /\bsu\s+-\s+root\b/i,
  /\bchmod\s+777\b/i,
  /\b:\(\)\{\s*:\|:&\s*\};\s*:/,
  />\s*\/dev\/[a-z]+\s*/,
];

const PROMPT_DANGEROUS_KEYWORDS = [
  'delete all',
  'remove all',
  'format',
  'wipe',
  'destroy',
  'drop database',
  'truncate',
  'sudo rm',
  'del /f',
];

export interface SandboxConfig {
  enabled: boolean;
  allowedCommands: string[];
  blockedPatterns: string[];
  promptSafetyCheck: boolean;
}

export class TaskSandbox {
  private config: SandboxConfig;

  constructor(config: SandboxConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Sandbox config updated', { config: this.config });
  }

  validateCommand(command: string): { allowed: boolean; reason?: string } {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    const parts = command.split(' ');
    const cmdBase = parts[0] || '';

    if (this.config.allowedCommands.length > 0) {
      const isAllowed = this.config.allowedCommands.some((allowed) =>
        cmdBase === allowed || cmdBase.endsWith(allowed)
      );

      if (!isAllowed) {
        logger.warn('Command not in allowlist', { command: cmdBase });
        return { allowed: false, reason: `Command "${cmdBase}" not in allowlist` };
      }
    }

    for (const pattern of this.config.blockedPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(command)) {
        logger.warn('Command matched blocked pattern', { command, pattern });
        return { allowed: false, reason: `Command matches blocked pattern: ${pattern}` };
      }
    }

    for (const dangerousPattern of DANGEROUS_PATTERNS) {
      if (dangerousPattern.test(command)) {
        logger.warn('Command matched dangerous pattern', { command });
        return { allowed: false, reason: 'Command contains dangerous pattern' };
      }
    }

    return { allowed: true };
  }

  validatePrompt(prompt: string): { allowed: boolean; reason?: string } {
    if (!this.config.promptSafetyCheck) {
      return { allowed: true };
    }

    const lowerPrompt = prompt.toLowerCase();

    for (const keyword of PROMPT_DANGEROUS_KEYWORDS) {
      if (lowerPrompt.includes(keyword)) {
        logger.warn('Prompt contains dangerous keyword', { keyword, prompt: prompt.substring(0, 100) });
        return { allowed: false, reason: `Prompt contains dangerous keyword: ${keyword}` };
      }
    }

    return { allowed: true };
  }

  validateRequest(request: ExecuteRequest): { allowed: boolean; reason?: string } {
    const commandValidation = this.validateCommand(request.agentType);
    if (!commandValidation.allowed) {
      return commandValidation;
    }

    const promptValidation = this.validatePrompt(request.prompt);
    if (!promptValidation.allowed) {
      return promptValidation;
    }

    return { allowed: true };
  }

  sanitizeOutput(output: string): string {
    let sanitized = output;

    const tokenRegex = /(token|api[_-]?key|password|secret)[:=]\s*[^\s"']+/gi;
    sanitized = sanitized.replace(tokenRegex, (match) => {
      const parts = match.split('=');
      if (parts.length === 2) {
        return `${parts[0]}=***`;
      }
      const colonParts = match.split(':');
      if (colonParts.length === 2) {
        return `${colonParts[0]}:***`;
      }
      return '***';
    });

    return sanitized;
  }
}

export function createSandbox(config: SandboxConfig): TaskSandbox {
  return new TaskSandbox(config);
}
