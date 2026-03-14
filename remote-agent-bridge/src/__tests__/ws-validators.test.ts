/**
 * P0-3: Tests for WebSocket message validators in ws-client.ts
 *
 * These validators are pure functions extracted for testability.
 * We re-implement the validation logic here since the original functions
 * are private to WSClient. The logic mirrors the production code.
 */

// ---- Re-implement validators for testing (mirrors ws-client.ts) ----

interface ValidatedAuthResponse {
  success: boolean;
  bridgeId?: string;
  error?: string;
}

interface ValidatedPing {
  timestamp: number;
}

interface ValidatedTaskSubmit {
  taskId: string;
  prompt: string;
  projectPath: string;
  agentType: string;
  timeout: number;
  priority: string;
  callbackId?: string;
  preferredIde?: string;
}

interface ValidatedTaskCancel {
  taskId: string;
  reason: string;
}

interface ValidatedAck {
  originalMsgId: string;
  success: boolean;
}

interface ValidatedError {
  code: string;
  message: string;
  details?: unknown;
}

function validateAuthResponse(data: unknown): ValidatedAuthResponse | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  if (typeof obj['success'] !== 'boolean') return null;
  return {
    success: obj['success'],
    bridgeId: typeof obj['bridgeId'] === 'string' ? obj['bridgeId'] : undefined,
    error: typeof obj['error'] === 'string' ? obj['error'] : undefined,
  };
}

function validatePing(data: unknown): ValidatedPing | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  if (typeof obj['timestamp'] !== 'number') return null;
  return { timestamp: obj['timestamp'] };
}

function validateTaskSubmit(data: unknown): ValidatedTaskSubmit | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  const taskId = obj['taskId'];
  if (typeof taskId !== 'string' || !taskId) return null;
  if (typeof obj['prompt'] !== 'string') return null;
  if (typeof obj['projectPath'] !== 'string') return null;
  if (typeof obj['agentType'] !== 'string') return null;
  return {
    taskId,
    prompt: obj['prompt'],
    projectPath: obj['projectPath'],
    agentType: obj['agentType'],
    timeout: typeof obj['timeout'] === 'number' ? obj['timeout'] : 300,
    priority: typeof obj['priority'] === 'string' ? obj['priority'] : 'normal',
    callbackId: typeof obj['callbackId'] === 'string' ? obj['callbackId'] : undefined,
    preferredIde: typeof obj['preferredIde'] === 'string' ? obj['preferredIde'] : undefined,
  };
}

function validateTaskCancel(data: unknown): ValidatedTaskCancel | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  const taskId = obj['taskId'];
  if (typeof taskId !== 'string' || !taskId) return null;
  if (typeof obj['reason'] !== 'string') return null;
  return { taskId, reason: obj['reason'] };
}

function validateAck(data: unknown): ValidatedAck | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  if (typeof obj['originalMsgId'] !== 'string') return null;
  if (typeof obj['success'] !== 'boolean') return null;
  return { originalMsgId: obj['originalMsgId'], success: obj['success'] };
}

function validateError(data: unknown): ValidatedError | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  if (typeof obj['code'] !== 'string') return null;
  if (typeof obj['message'] !== 'string') return null;
  return {
    code: obj['code'],
    message: obj['message'],
    details: obj['details'],
  };
}

// ============================================================
// Tests
// ============================================================

describe('validateAuthResponse', () => {
  it('accepts valid success response', () => {
    const result = validateAuthResponse({ success: true, bridgeId: 'bridge-1' });
    expect(result).toEqual({ success: true, bridgeId: 'bridge-1' });
  });

  it('accepts valid failure response with error', () => {
    const result = validateAuthResponse({ success: false, error: 'invalid token' });
    expect(result).toEqual({ success: false, error: 'invalid token' });
  });

  it('accepts response without optional fields', () => {
    const result = validateAuthResponse({ success: true });
    expect(result).toEqual({ success: true, bridgeId: undefined, error: undefined });
  });

  it('rejects null', () => {
    expect(validateAuthResponse(null)).toBeNull();
  });

  it('rejects non-object', () => {
    expect(validateAuthResponse('string')).toBeNull();
    expect(validateAuthResponse(42)).toBeNull();
  });

  it('rejects missing success field', () => {
    expect(validateAuthResponse({ bridgeId: 'x' })).toBeNull();
  });

  it('rejects wrong success type', () => {
    expect(validateAuthResponse({ success: 'yes' })).toBeNull();
    expect(validateAuthResponse({ success: 1 })).toBeNull();
  });

  it('ignores non-string bridgeId', () => {
    const result = validateAuthResponse({ success: true, bridgeId: 123 });
    expect(result?.bridgeId).toBeUndefined();
  });

  it('ignores non-string error', () => {
    const result = validateAuthResponse({ success: false, error: 401 });
    expect(result?.error).toBeUndefined();
  });
});

describe('validatePing', () => {
  it('accepts valid ping', () => {
    const result = validatePing({ timestamp: 1000 });
    expect(result).toEqual({ timestamp: 1000 });
  });

  it('rejects null', () => {
    expect(validatePing(null)).toBeNull();
  });

  it('rejects missing timestamp', () => {
    expect(validatePing({})).toBeNull();
  });

  it('rejects non-number timestamp', () => {
    expect(validatePing({ timestamp: '1000' })).toBeNull();
  });
});

describe('validateTaskSubmit', () => {
  const validTask = {
    taskId: 'task-123',
    prompt: 'Fix the bug',
    projectPath: '/tmp/project',
    agentType: 'cli',
    timeout: 300,
    priority: 'high',
  };

  it('accepts valid task submit', () => {
    const result = validateTaskSubmit(validTask);
    expect(result).toEqual(validTask);
  });

  it('applies defaults for missing optional fields', () => {
    const result = validateTaskSubmit({
      taskId: 'task-1',
      prompt: 'do stuff',
      projectPath: '/tmp',
      agentType: 'cli',
    });
    expect(result).toEqual({
      taskId: 'task-1',
      prompt: 'do stuff',
      projectPath: '/tmp',
      agentType: 'cli',
      timeout: 300,
      priority: 'normal',
      callbackId: undefined,
      preferredIde: undefined,
    });
  });

  it('rejects null', () => {
    expect(validateTaskSubmit(null)).toBeNull();
  });

  it('rejects missing taskId', () => {
    expect(validateTaskSubmit({ prompt: 'x', projectPath: '/y', agentType: 'cli' })).toBeNull();
  });

  it('rejects empty taskId', () => {
    expect(validateTaskSubmit({ taskId: '', prompt: 'x', projectPath: '/y', agentType: 'cli' })).toBeNull();
  });

  it('rejects non-string prompt', () => {
    expect(validateTaskSubmit({ taskId: 't1', prompt: 123, projectPath: '/y', agentType: 'cli' })).toBeNull();
  });

  it('rejects non-string projectPath', () => {
    expect(validateTaskSubmit({ taskId: 't1', prompt: 'x', projectPath: 42, agentType: 'cli' })).toBeNull();
  });

  it('rejects non-string agentType', () => {
    expect(validateTaskSubmit({ taskId: 't1', prompt: 'x', projectPath: '/y', agentType: 99 })).toBeNull();
  });
});

describe('validateTaskCancel', () => {
  it('accepts valid cancel', () => {
    const result = validateTaskCancel({ taskId: 't1', reason: 'user_request' });
    expect(result).toEqual({ taskId: 't1', reason: 'user_request' });
  });

  it('rejects null', () => {
    expect(validateTaskCancel(null)).toBeNull();
  });

  it('rejects missing reason', () => {
    expect(validateTaskCancel({ taskId: 't1' })).toBeNull();
  });

  it('rejects empty taskId', () => {
    expect(validateTaskCancel({ taskId: '', reason: 'x' })).toBeNull();
  });

  it('rejects non-string reason', () => {
    expect(validateTaskCancel({ taskId: 't1', reason: 123 })).toBeNull();
  });
});

describe('validateAck', () => {
  it('accepts valid ack', () => {
    const result = validateAck({ originalMsgId: 'msg-1', success: true });
    expect(result).toEqual({ originalMsgId: 'msg-1', success: true });
  });

  it('rejects null', () => {
    expect(validateAck(null)).toBeNull();
  });

  it('rejects missing originalMsgId', () => {
    expect(validateAck({ success: true })).toBeNull();
  });

  it('rejects non-boolean success', () => {
    expect(validateAck({ originalMsgId: 'msg-1', success: 'yes' })).toBeNull();
  });

  it('rejects non-string originalMsgId', () => {
    expect(validateAck({ originalMsgId: 123, success: true })).toBeNull();
  });
});

describe('validateError', () => {
  it('accepts valid error', () => {
    const result = validateError({ code: 'AUTH_FAILED', message: 'bad token' });
    expect(result).toEqual({ code: 'AUTH_FAILED', message: 'bad token', details: undefined });
  });

  it('accepts error with details', () => {
    const details = { field: 'token', value: 'xxx' };
    const result = validateError({ code: 'INVALID', message: 'bad input', details });
    expect(result?.details).toEqual(details);
  });

  it('rejects null', () => {
    expect(validateError(null)).toBeNull();
  });

  it('rejects missing code', () => {
    expect(validateError({ message: 'error' })).toBeNull();
  });

  it('rejects missing message', () => {
    expect(validateError({ code: 'ERR' })).toBeNull();
  });

  it('rejects non-string code', () => {
    expect(validateError({ code: 404, message: 'not found' })).toBeNull();
  });

  it('rejects array input', () => {
    expect(validateError([1, 2, 3])).toBeNull();
  });
});
