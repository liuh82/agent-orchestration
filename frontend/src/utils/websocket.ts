import type { WsEvent } from '@/types/workflow';

type MessageHandler = (data: WsEvent) => void;

export class WorkflowWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private maxRetries = 5;
  private baseDelay = 1000;
  private executionId = '';
  private onMessageHandler: MessageHandler | null = null;

  connect(executionId: string, onMessage: MessageHandler) {
    this.executionId = executionId;
    this.onMessageHandler = onMessage;
    this.retryCount = 0;
    this.createConnection();
  }

  private createConnection() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/v1/ws/workflow/${this.executionId}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.retryCount = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsEvent;
          this.onMessageHandler?.(data);
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire after onerror, which handles reconnect
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.retryCount >= this.maxRetries) return;

    const delay = this.baseDelay * Math.pow(2, this.retryCount);
    this.reconnectTimer = setTimeout(() => {
      this.retryCount++;
      this.createConnection();
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.onMessageHandler = null;
    this.retryCount = this.maxRetries;
  }
}
