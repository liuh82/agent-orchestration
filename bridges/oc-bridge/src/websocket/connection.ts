/**
 * WebSocket connection manager — handles auth, registration, and heartbeat.
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
  TaskAck,
  TaskCancel,
} from "./types.js";

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

  constructor(config: BridgeConfig, eventHandler: (event: ConnectionEvent) => void) {
    this.config = config;
    this.eventHandler = eventHandler;
  }

  /** Connect, authenticate, and register. */
  async connect(): Promise<void> {
    if (this.disposed) throw new Error("Connection disposed");

    const url = this.config.serverUrl;
    logger.info(`Connecting to ${url} ...`);

    return new Promise<void>((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
        this.ws?.terminate();
      }, 15_000);

      this.ws = new WebSocket(url);

      this.ws.on("error", (err) => {
        clearTimeout(connectTimeout);
        logger.error(`WebSocket error: ${err.message}`);
        reject(err);
      });

      this.ws.on("close", (code, reason) => {
        clearTimeout(connectTimeout);
        const msg = reason.toString() || "unknown";
        logger.warn(`WebSocket closed: code=${code}, reason=${msg}`);
        this.eventHandler({ type: "disconnected", code, reason: msg });
      });

      this.ws.on("open", async () => {
        clearTimeout(connectTimeout);
        logger.info("WebSocket connected, authenticating...");
        try {
          await this.authenticate();
          await this.register();
          this.listen();
          resolve();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`Registration failed: ${msg}`);
          this.eventHandler({ type: "error", error: msg });
          reject(err);
        }
      });
    });
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
        // Phase 1: just acknowledge — Phase 2 will execute
        this.send({ type: "task.ack", taskId: msg.taskId, ts: Date.now() } as TaskAck);
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

  /** Disconnect gracefully. */
  disconnect(): void {
    this.disposed = true;
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close(1000, "Client shutdown");
      this.ws = null;
    }
    logger.info("Disconnected");
  }
}
