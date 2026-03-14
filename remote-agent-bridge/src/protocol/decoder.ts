import type { BridgeMessage, MessageType, DecodedMessage, UnknownMessage } from './types.js';
import type { z } from 'zod';
import {
  bridgeMessageSchema,
  authRequestSchema,
  authResponseSchema,
  bridgeRegisterSchema,
  taskSubmitSchema,
  taskProgressSchema,
  taskCompleteSchema,
  taskCancelSchema,
  pingSchema,
  pongSchema,
  ackSchema,
  errorSchema,
} from './schemas.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('decoder');

function parseMessage(raw: string): BridgeMessage | UnknownMessage | null {
  try {
    const parsed = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) {
      logger.warn('Invalid message: not an object');
      return null;
    }

    if (!('type' in parsed) || typeof parsed.type !== 'string') {
      logger.warn('Invalid message: missing type field', { raw });
      return null;
    }

    const baseValidation = bridgeMessageSchema.safeParse(parsed);
    if (!baseValidation.success) {
      logger.warn('Message failed base validation', {
        errors: baseValidation.error.errors,
        raw,
      });
      return null;
    }

    return baseValidation.data as BridgeMessage | UnknownMessage;
  } catch (error) {
    logger.error('Failed to parse message', { error, raw });
    return null;
  }
}

function validateMessage(message: BridgeMessage): DecodedMessage | null {
  const { type, data } = message;

  const schemaMap: Record<MessageType, z.ZodType<unknown>> = {
    'auth.request': authRequestSchema,
    'auth.response': authResponseSchema,
    'bridge.register': bridgeRegisterSchema,
    'task.submit': taskSubmitSchema,
    'task.progress': taskProgressSchema,
    'task.complete': taskCompleteSchema,
    'task.cancel': taskCancelSchema,
    'ping': pingSchema,
    'pong': pongSchema,
    'ack': ackSchema,
    'error': errorSchema,
  };

  const schema = schemaMap[type];
  if (!schema) {
    logger.warn('Unknown message type', { type });
    return null;
  }

  const validation = schema.safeParse({ type, ...(data as Record<string, unknown>) });
  if (!validation.success) {
    logger.warn('Message failed type-specific validation', {
      type,
      errors: validation.error.errors,
    });
    return null;
  }

  return {
    msgId: message.msgId,
    type: message.type,
    ts: message.ts,
    data: validation.data as unknown,
  };
}

export function decodeMessage(raw: string): DecodedMessage | null {
  const message = parseMessage(raw);
  if (!message) {
    return null;
  }

  // UnknownMessage has 'raw' property, BridgeMessage doesn't
  if ('raw' in message) {
    return null;
  }

  return validateMessage(message);
}
