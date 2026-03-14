/**
 * P1-3: Tests for sandbox command whitelist bypass fix.
 *
 * Tests that validateCommand properly normalizes paths and prevents
 * bypass via relative paths, absolute paths, and escape characters.
 */

import { TaskSandbox, type SandboxConfig } from '../security/sandbox';

function createEnabledSandbox(allowedCommands: string[] = ['node', 'npm', 'npx']): TaskSandbox {
  const config: SandboxConfig = {
    enabled: true,
    allowedCommands,
    blockedPatterns: [],
    promptSafetyCheck: false,
  };
  return new TaskSandbox(config);
}

function createDisabledSandbox(): TaskSandbox {
  const config: SandboxConfig = {
    enabled: false,
    allowedCommands: [],
    blockedPatterns: [],
    promptSafetyCheck: false,
  };
  return new TaskSandbox(config);
}

describe('TaskSandbox - path injection prevention', () => {
  it('allows commands from allowlist', () => {
    const sandbox = createEnabledSandbox(['node', 'npm']);
    expect(sandbox.validateCommand('node app.js')).toEqual({ allowed: true });
    expect(sandbox.validateCommand('npm install')).toEqual({ allowed: true });
  });

  it('rejects commands not in allowlist', () => {
    const sandbox = createEnabledSandbox(['node']);
    const result = sandbox.validateCommand('python script.py');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not in allowlist');
  });

  it('rejects relative path bypass (./sudo)', () => {
    const sandbox = createEnabledSandbox(['node']);
    const result = sandbox.validateCommand('./sudo rm -rf /');
    expect(result.allowed).toBe(false);
    // Either rejected as path injection or not in allowlist — both are safe
    expect(result.reason).toBeDefined();
  });

  it('rejects absolute path bypass (/usr/bin/rm)', () => {
    const sandbox = createEnabledSandbox(['node']);
    const result = sandbox.validateCommand('/usr/bin/rm -rf /tmp');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Path-based command execution not allowed');
  });

  it('rejects absolute path bypass for allowed command', () => {
    const sandbox = createEnabledSandbox(['node']);
    const result = sandbox.validateCommand('/usr/local/bin/node app.js');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Path-based command execution not allowed');
  });

  it('rejects escape character bypass (sudo\\ rm)', () => {
    const sandbox = createEnabledSandbox(['node']);
    const result = sandbox.validateCommand('sudo\\ rm -rf /');
    // After stripping \ , becomes "sudorm -rf /"
    // baseName is "sudorm" which is not in allowlist
    expect(result.allowed).toBe(false);
  });

  it('rejects escape space bypass (./sudo\\  rm)', () => {
    const sandbox = createEnabledSandbox(['node']);
    const result = sandbox.validateCommand('./sudo\\  rm -rf /');
    expect(result.allowed).toBe(false);
  });

  it('accepts single-word allowed command', () => {
    const sandbox = createEnabledSandbox(['node']);
    expect(sandbox.validateCommand('node')).toEqual({ allowed: true });
  });

  it('accepts allowed command with arguments', () => {
    const sandbox = createEnabledSandbox(['node']);
    expect(sandbox.validateCommand('node --version')).toEqual({ allowed: true });
    expect(sandbox.validateCommand('node run dev')).toEqual({ allowed: true });
  });

  it('normalizes parent directory traversal', () => {
    const sandbox = createEnabledSandbox(['node']);
    // ../../../usr/bin/node -> normalized has separators, baseName is "node"
    const result = sandbox.validateCommand('../../../usr/bin/node');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Path-based command execution not allowed');
  });

  it('disabled sandbox allows everything', () => {
    const sandbox = createDisabledSandbox();
    expect(sandbox.validateCommand('rm -rf /')).toEqual({ allowed: true });
    expect(sandbox.validateCommand('sudo anything')).toEqual({ allowed: true });
  });
});

describe('TaskSandbox - dangerous patterns', () => {
  it('rejects rm -rf with root path', () => {
    const sandbox = createEnabledSandbox(['rm']);
    const result = sandbox.validateCommand('rm -rf /home');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('dangerous pattern');
  });

  it('rejects sudo command', () => {
    const sandbox = createEnabledSandbox(['sudo']);
    const result = sandbox.validateCommand('sudo apt install node');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('dangerous pattern');
  });

  it('rejects chmod 777', () => {
    const sandbox = createEnabledSandbox(['bash']);
    const result = sandbox.validateCommand('chmod 777 /etc/passwd');
    expect(result.allowed).toBe(false);
  });

  it('rejects fork bomb pattern', () => {
    const sandbox = createEnabledSandbox(['bash']);
    const result = sandbox.validateCommand(':(){ :|:& };:');
    expect(result.allowed).toBe(false);
  });
});

describe('TaskSandbox - blocked patterns', () => {
  it('rejects custom blocked pattern', () => {
    const config: SandboxConfig = {
      enabled: true,
      allowedCommands: ['node'],
      blockedPatterns: ['eval\\s*\\('],
      promptSafetyCheck: false,
    };
    const sandbox = new TaskSandbox(config);
    const result = sandbox.validateCommand('node -e "eval()"');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('blocked pattern');
  });
});

describe('TaskSandbox - prompt validation', () => {
  it('rejects dangerous prompt keywords', () => {
    const config: SandboxConfig = {
      enabled: false,
      allowedCommands: [],
      blockedPatterns: [],
      promptSafetyCheck: true,
    };
    const sandbox = new TaskSandbox(config);

    expect(sandbox.validatePrompt('delete all files').allowed).toBe(false);
    expect(sandbox.validatePrompt('drop database').allowed).toBe(false);
    expect(sandbox.validatePrompt('sudo rm important files').allowed).toBe(false);
  });

  it('allows safe prompts', () => {
    const config: SandboxConfig = {
      enabled: false,
      allowedCommands: [],
      blockedPatterns: [],
      promptSafetyCheck: true,
    };
    const sandbox = new TaskSandbox(config);

    expect(sandbox.validatePrompt('Fix the bug in auth module').allowed).toBe(true);
    expect(sandbox.validatePrompt('Add unit tests for API').allowed).toBe(true);
  });

  it('disabled prompt check allows everything', () => {
    const config: SandboxConfig = {
      enabled: false,
      allowedCommands: [],
      blockedPatterns: [],
      promptSafetyCheck: false,
    };
    const sandbox = new TaskSandbox(config);
    expect(sandbox.validatePrompt('delete all').allowed).toBe(true);
  });
});
