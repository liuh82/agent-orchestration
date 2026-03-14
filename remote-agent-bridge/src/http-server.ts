import express, { type Request, type Response, type NextFunction } from 'express';
import type { Bridge } from './bridge.js';
import type { TaskSubmit } from './protocol/types.js';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from './utils/logger.js';
import { BRIDGE_VERSION } from './version.js';

const logger = getLogger('http-server');

export interface HttpServerConfig {
  enabled: boolean;
  host: string;
  port: number;
  cors: {
    enabled: boolean;
    origin: string;
  };
  auth: {
    enabled: boolean;
    apiKey: string;
  };
}

class HttpServer {
  private app: express.Application;
  private config: HttpServerConfig;
  private server: ReturnType<express.Application['listen']> | null = null;
  private bridge: Bridge | null = null;

  constructor(config: HttpServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    if (this.config.cors.enabled) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Access-Control-Allow-Origin', this.config.cors.origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
        if (req.method === 'OPTIONS') {
          res.sendStatus(204);
          return;
        }
        next();
      });
    }

    if (this.config.auth.enabled) {
      this.app.use('/api', this.authMiddleware.bind(this));
    }

    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.debug('HTTP request', { method: req.method, path: req.path });
      next();
    });
  }

  private authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers['x-api-key'] as string || req.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      res.status(401).json({ success: false, error: 'API key required' });
      return;
    }

    if (apiKey !== this.config.auth.apiKey) {
      res.status(403).json({ success: false, error: 'Invalid API key' });
      return;
    }

    next();
  }

  private setupRoutes(): void {
    this.app.get('/api/v1/health', (_req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          version: BRIDGE_VERSION,
          timestamp: Date.now(),
        },
      });
    });

    this.app.get('/api/v1/status', (_req: Request, res: Response) => {
      if (!this.bridge) {
        res.status(503).json({ success: false, error: 'Bridge not initialized' });
        return;
      }

      const bridgeStatus = this.bridge.getStatus();
      res.json({
        success: true,
        data: {
          bridge: bridgeStatus.status,
          uptime: bridgeStatus.uptime,
          websocket: bridgeStatus.wsStatus,
          queue: bridgeStatus.queueStatus,
        },
      });
    });

    this.app.get('/api/v1/tasks', (req: Request, res: Response) => {
      const limit = parseInt(req.query['limit'] as string || '100', 10);
      const offset = parseInt(req.query['offset'] as string || '0', 10);

      res.json({
        success: true,
        data: [],
        pagination: { limit, offset, total: 0 },
      });
    });

    this.app.get('/api/v1/tasks/:id', (req: Request, res: Response) => {
      const { id } = req.params;

      res.json({
        success: true,
        data: { id, status: 'not_found' },
      });
    });

    this.app.post('/api/v1/tasks', (req: Request, res: Response) => {
      const taskData = req.body as Partial<TaskSubmit>;

      const required = ['prompt', 'projectPath', 'agentType'];
      const missing = required.filter((field) => !taskData[field as keyof TaskSubmit]);

      if (missing.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`,
        });
        return;
      }

      const taskId = uuidv4();
      const task: TaskSubmit = {
        type: 'task.submit',
        taskId,
        prompt: taskData.prompt || '',
        projectPath: taskData.projectPath || '',
        agentType: taskData.agentType || 'cli',
        timeout: taskData.timeout || 300,
        priority: taskData.priority || 'normal',
        callbackId: taskData.callbackId,
        preferredIde: taskData.preferredIde,
      };

      logger.info('Task submitted via HTTP API', { taskId, agentType: task.agentType });

      if (!this.bridge) {
        logger.error('Bridge not initialized, cannot submit task');
        res.status(503).json({
          success: false,
          error: 'Bridge not initialized',
        });
        return;
      }

      try {
        this.bridge.submitLocalTask(task);
      } catch (error) {
        logger.error('Failed to submit task to bridge', { error, taskId });
        res.status(500).json({
          success: false,
          error: 'Failed to submit task',
        });
        return;
      }

      res.status(202).json({
        success: true,
        data: { taskId, status: 'queued' },
      });
    });

    this.app.delete('/api/v1/tasks/:id', (req: Request, res: Response) => {
      const { id } = req.params;

      res.json({
        success: true,
        data: { taskId: id, status: 'cancelled' },
      });
    });

    this.app.get('/api/v1/agents', (_req: Request, res: Response) => {
      res.json({
        success: true,
        data: [
          { type: 'cli', name: 'CLI Agent', available: true },
          { type: 'codex', name: 'Codex', available: false },
          { type: 'pi', name: 'Pi', available: false },
        ],
      });
    });

    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Not found',
      });
    });

    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      logger.error('HTTP server error', { error: err.message, path: req.path });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    });
  }

  setBridge(bridge: Bridge): void {
    this.bridge = bridge;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.enabled) {
        logger.info('HTTP server disabled');
        resolve();
        return;
      }

      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          logger.info(`HTTP server listening`, { host: this.config.host, port: this.config.port });
          resolve();
        });

        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`Port ${this.config.port} already in use`);
          } else {
            logger.error('HTTP server error', { error });
          }
          reject(error);
        });
      } catch (error) {
        logger.error('Failed to start HTTP server', { error });
        reject(error);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        logger.info('HTTP server stopped');
        resolve();
      });
    });
  }

  updateConfig(partialConfig: Partial<HttpServerConfig>): void {
    this.config = { ...this.config, ...partialConfig };
    logger.info('HTTP server config updated');
  }
}

export { HttpServer };
