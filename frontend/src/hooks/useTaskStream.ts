/**
 * useTaskStream — 连接后端 SSE 端点，实时推送任务事件。
 *
 * 对接: GET /api/gateway/tasks/{taskId}/stream
 *
 * 事件格式:
 *   data: {"type": "event", "event": {...CCEvent}, "progress": 50, "ts": ...}
 *   data: {"type": "done", "success": true, "ts": ...}
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';

/** 单条解析后的事件 */
export interface TaskStreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'done';
  subtype?: string;
  content: string;
  toolName?: string;
  toolInput?: unknown;
  isError?: boolean;
  costUsd?: number;
  tokenUsage?: { input: number; output: number };
}

/** SSE 消息 */
export interface SSEMessage {
  type: 'event' | 'done' | 'workflow_event';
  event?: TaskStreamEvent;
  /** workflow_event 时的原始事件对象 */
  data?: Record<string, any>;
  progress?: number;
  success?: boolean;
  ts: number;
}

interface UseTaskStreamOptions {
  /** 仅当任务处于 running 状态时才连接 */
  enabled?: boolean;
}

interface UseTaskStreamResult {
  /** 累积的事件列表 */
  events: SSEMessage[];
  /** 当前百分比进度 */
  progress: number;
  /** 是否正在连接/接收中 */
  isConnected: boolean;
  /** 任务是否已完成流传输 */
  isDone: boolean;
  /** 手动断开 */
  disconnect: () => void;
}

export function useTaskStream(
  taskId: string | undefined,
  options: UseTaskStreamOptions = {},
): UseTaskStreamResult {
  const { enabled = true } = options;
  const [events, setEvents] = useState<SSEMessage[]>([]);
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!taskId || !enabled) {
      disconnect();
      return;
    }

    // 构造 SSE URL，携带 token
    const token = useAuthStore.getState().accessToken;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const url = new URL(`${baseUrl}/gateway/tasks/${taskId}/stream`, window.location.origin);
    if (token) {
      url.searchParams.set('token', token);
    }

    const es = new EventSource(url.toString());
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setIsDone(false);
    };

    es.onmessage = (e) => {
      try {
        const msg: SSEMessage = JSON.parse(e.data);

        setEvents((prev) => [...prev, msg]);

        if (msg.progress != null) {
          setProgress(msg.progress);
        }

        if (msg.type === 'done') {
          setIsDone(true);
          es.close();
          eventSourceRef.current = null;
          setIsConnected(false);
        }
      } catch {
        // 忽略解析错误
      }
    };

    es.onerror = () => {
      // EventSource 会自动重连，我们只更新状态
      setIsConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [taskId, enabled, disconnect]);

  return { events, progress, isConnected, isDone, disconnect };
}
