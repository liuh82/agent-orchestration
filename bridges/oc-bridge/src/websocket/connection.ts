/**
 * WebSocket connection manager — handles auth, registration, heartbeat,
 * and automatic reconnection with exponential backoff.
 */
import { v4 } from "uuid";
import WebSocket from "ws";
import { logger } from "../logger/index.js";
import { getPlatformInfo, findClaudeCli } from "../utils/platform.js";
import type { BridgeConfig } from "../storage/config.js";
import type {
  ServerMessage,
  AuthRequest,
  BridgeRegister,
  Pong,
  TaskSubmit,
  TaskCancel,
} from "./types.js";
import { getRetryDelay, formatDelay, DEFAULT_RETRY_POLICY } from "../utils/retry.js";

const BRIDGE_VERSION = "1.0.0";
const AUTH_TIMEOUT_MS = 10_000;

export type ConnectionEvent =
  | { type: "registered"; resumedTasks: unknown[] }
  | { type: "task.submit"; task: TaskSubmit }
  | { type: "task.cancel"; task: TaskCancel }
  | { type: "disconnected"; code: number; reason: string }
  | { type: "error"; error: string };

export class WSConnection {
  private ws: WebSocket | null = null;
  private config: BridgeConfig;
  private eventHandler: (event: ConnectionEvent) => void;
  private disposed = false;
  private manualClose = false;

  // Reconnection state
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: BridgeConfig, eventHandler: (event: ConnectionEvent) => void) {
    this.config = config;
    this.eventHandler = eventHandler;
  }

  /** Connect, authenticate, and register. */
  async connect(): Promise<void> {
    if (this.disposed) throw new Error("Connection disposed");
    this.manualClose = false;

    await this.doConnect();
  }

  /** Core connect/auth/register logic — used for initial and reconnection. */
  private doConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.disposed || this.manualClose) {
        reject(new Error("Connection disposed or manually closed"));
        return;
      }

      const url = this.config.serverUrl;
      logger.info(`Connecting to ${url} ...`);

      const connectTimeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
        this.ws?.terminate();
      }, 15_000);

      this.ws = new WebSocket(url);

      this.ws.on("error", (err) => {
        clearTimeout(connectTimeout);
        logger.error(`WebSocket error: ${err.message}`);
        // Only reject on first attempt; reconnection failures are handled by close
        if (this.reconnectAttempt === 0) {
          reject(err);
        }
      });

      this.ws.on("close", (code, reason) => {
        clearTimeout(connectTimeout);
        this.ws = null;
        const msg = reason.toString() || "unknown";
        logger.warn(`WebSocket closed: code=${code}, reason=${msg}`);
        this.eventHandler({ type: "disconnected", code, reason: msg });

        // Attempt reconnection unless manually closed or disposed
        if (!this.manualClose && !this.disposed) {
          this.scheduleReconnect();
        }
      });

      this.ws.on("open", async () => {
        clearTimeout(connectTimeout);
        logger.info("WebSocket connected, authenticating...");
        try {
          await this.authenticate();
          await this.register();
          this.listen();

          // Reset reconnect counter on full success
          this.reconnectAttempt = 0;
          resolve();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.error(`Registration failed: ${errMsg}`);
          this.eventHandler({ type: "error", error: errMsg });
          reject(err);
        }
      });
    });
  }

  /** Schedule a reconnection attempt with exponential backoff. */
  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= DEFAULT_RETRY_POLICY.maxAttempts) {
      logger.error(
        `Max reconnection attempts reached (${DEFAULT_RETRY_POLICY.maxAttempts}). Giving up.`,
      );
      process.exit(1);
    }

    const delay = getRetryDelay(DEFAULT_RETRY_POLICY, this.reconnectAttempt);
    this.reconnectAttempt++;

    logger.info(
      `Reconnecting in ${formatDelay(delay)} (attempt ${this.reconnectAttempt}/${DEFAULT_RETRY_POLICY.maxAttempts})...`,
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.doConnect();
        logger.info("Reconnected successfully");
      } catch {
        // doConnect already logged the error; close handler will schedule next attempt
      }
    }, delay);
  }

  /** Send auth.request message. */
  private authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Auth timeout — server did not respond"));
      }, AUTH_TIMEOUT_MS);

      const msgId = v4();
      const msg: AuthRequest = {
        type: "auth.request",
        msgId,
        ts: Date.now(),
        data: {
          token: this.config.token,
          bridgeId: this.config.bridgeId,
        },
      };

      // One-time handler for auth.response
      const handler = (data: WebSocket.Data) => {
        const parsed = JSON.parse(data.toString()) as ServerMessage;
        if (parsed.type === "auth.response") {
          clearTimeout(timeout);
          this.ws?.removeListener("message", handler);
          if (parsed.data.success) {
            logger.info("Authenticated successfully");
            resolve();
          } else {
            reject(new Error(parsed.data.error || "Authentication failed"));
          }
        }
      };

      this.ws!.on("message", handler);
      this.send(msg);
    });
  }

  /** Send bridge.register message. */
  private register(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Registration timeout — server did not respond"));
      }, AUTH_TIMEOUT_MS);

      const platform = getPlatformInfo();
      const claudePath = findClaudeCli() || "claude";

      const msg: BridgeRegister = {
        type: "bridge.register",
        bridgeId: this.config.bridgeId,
        platform: platform.platform,
        hostname: platform.hostname,
        osVersion: platform.osVersion,
        nodeVersion: platform.nodeVersion,
        bridgeVersion: BRIDGE_VERSION,
        adapters: [
          {
            type: "cli",
            name: "claude-code",
            version: "1.0.0",
            executablePath: claudePath,
          },
        ],
        activeTasks: 0,
        maxConcurrent: this.config.maxConcurrent,
      };

      // One-time handler for bridge.registered
      const handler = (data: WebSocket.Data) => {
        const parsed = JSON.parse(data.toString()) as ServerMessage;
        if (parsed.type === "bridge.registered") {
          clearTimeout(timeout);
          this.ws?.removeListener("message", handler);
          logger.info(`Registered as ${parsed.bridgeId}, status=${parsed.status}`);
          if (parsed.resumedTasks.length > 0) {
            logger.info(`Resumed ${parsed.resumedTasks.length} task(s)`);
          }
          this.eventHandler({
            type: "registered",
            resumedTasks: parsed.resumedTasks,
          });
          resolve();
        }
      };

      this.ws!.on("message", handler);
      this.send(msg);
    });
  }

  /** Listen for ongoing server messages after registration. */
  private listen(): void {
    this.ws!.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString()) as ServerMessage;
        this.handleMessage(msg);
      } catch (err) {
        logger.error(`Failed to parse message: ${err}`);
      }
    });
  }

  /** Dispatch incoming server messages. */
  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "ping":
        this.send({ type: "pong" } as Pong);
        logger.debug("Responded to ping");
        break;

      case "task.submit":
        logger.info(`Task submitted: ${msg.taskId}`);
        this.eventHandler({ type: "task.submit", task: msg });
        break;

      case "task.cancel":
        logger.info(`Task cancelled: ${msg.taskId}`);
        this.eventHandler({ type: "task.cancel", task: msg });
        break;

      case "auth.response":
      case "bridge.registered":
        // Already handled in auth/register flows
        break;

      case "error":
        logger.error(`Server error: [${msg.code}] ${msg.message}`);
        this.eventHandler({ type: "error", error: msg.message });
        break;

      default:
        logger.warn(`Unknown message type: ${(msg as { type: string }).type}`);
    }
  }

  /** Send a JSON message. */
  send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      logger.warn("Cannot send — WebSocket not open");
    }
  }

  /** Whether the WebSocket is currently open. */
  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Disconnect gracefully (stops reconnection). */
  disconnect(): void {
    this.manualClose = true;
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close(1000, "Client shutdown");
      this.ws = null;
    }
    logger.info("Disconnected");
  }
}
