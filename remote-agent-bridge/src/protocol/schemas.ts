import { z } from 'zod';

export const messageTypeSchema = z.enum([
  'auth.request',
  'auth.response',
  'bridge.register',
  'task.submit',
  'task.progress',
  'task.complete',
  'task.cancel',
  'ping',
  'pong',
  'ack',
  'error',
]);

export const bridgeStatusSchema = z.enum([
  'INITIALIZING',
  'CONNECTING',
  'AUTHENTICATING',
  'REGISTERING',
  'READY',
  'SHUTTING_DOWN',
  'TERMINATED',
]);

export const taskStatusSchema = z.enum(['pending', 'queued', 'running', 'completed', 'failed', 'cancelled']);

export const taskPrioritySchema = z.enum(['high', 'normal', 'low']);

export const agentTypeSchema = z.enum(['cli', 'codex', 'pi', 'acp', 'vscode', 'cursor', 'intellij']);

export const osTypeSchema = z.enum(['darwin', 'win32', 'linux']);

export const availableAdapterSchema = z.object({
  type: agentTypeSchema,
  agentName: z.string(),
  version: z.string().optional(),
  executablePath: z.string().optional(),
});

export const activeIDESchema = z.object({
  name: z.string(),
  version: z.string(),
  workspace: z.string().optional(),
});

export const bridgeMessageSchema = z.object({
  msgId: z.string().uuid(),
  type: messageTypeSchema,
  ts: z.number().int().positive(),
  data: z.unknown(),
});

export const authRequestSchema = z.object({
  type: z.literal('auth.request'),
  token: z.string().min(1),
  bridgeId: z.string().min(1),
  platform: osTypeSchema,
  hostname: z.string().min(1),
  osVersion: z.string().min(1),
  nodeVersion: z.string().min(1),
  bridgeVersion: z.string().min(1),
});

export const authResponseSchema = z.object({
  type: z.literal('auth.response'),
  success: z.boolean(),
  bridgeId: z.string().optional(),
  error: z.string().optional(),
});

export const bridgeRegisterSchema = z.object({
  type: z.literal('bridge.register'),
  bridgeId: z.string().min(1),
  platform: osTypeSchema,
  hostname: z.string().min(1),
  osVersion: z.string().min(1),
  nodeVersion: z.string().min(1),
  bridgeVersion: z.string().min(1),
  availableAdapters: z.array(availableAdapterSchema),
  activeIDEs: z.array(activeIDESchema),
});

export const taskSubmitSchema = z.object({
  type: z.literal('task.submit'),
  taskId: z.string().min(1),
  prompt: z.string().min(1),
  projectPath: z.string().min(1),
  agentType: agentTypeSchema,
  timeout: z.number().int().positive().max(86400),
  priority: taskPrioritySchema,
  callbackId: z.string().optional(),
  preferredIde: z.string().optional(),
});

export const taskProgressSchema = z.object({
  type: z.literal('task.progress'),
  taskId: z.string().min(1),
  status: taskStatusSchema,
  output: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  error: z.string().optional(),
});

export const taskResultSchema = z.object({
  exitCode: z.number().int(),
  output: z.string(),
  changedFiles: z.array(z.string()),
  duration: z.number().nonnegative(),
});

export const taskCompleteSchema = z.object({
  type: z.literal('task.complete'),
  taskId: z.string().min(1),
  result: taskResultSchema,
});

export const taskCancelSchema = z.object({
  type: z.literal('task.cancel'),
  taskId: z.string().min(1),
  reason: z.string().min(1),
});

export const pingSchema = z.object({
  type: z.literal('ping'),
  timestamp: z.number().int().positive(),
});

export const pongSchema = z.object({
  type: z.literal('pong'),
  timestamp: z.number().int().positive(),
});

export const ackSchema = z.object({
  type: z.literal('ack'),
  originalMsgId: z.string().uuid(),
  success: z.boolean(),
});

export const errorSchema = z.object({
  type: z.literal('error'),
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});
