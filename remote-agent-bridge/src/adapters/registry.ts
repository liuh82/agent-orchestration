import type { AgentAdapter } from './types.js';
import type { AdapterInfo } from './types.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('adapter-registry');

class AdapterRegistry {
  private adapters = new Map<string, AgentAdapter>();

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.type, adapter);
    logger.info(`Adapter registered`, { type: adapter.type });
  }

  unregister(type: string): void {
    this.adapters.delete(type);
    logger.info(`Adapter unregistered`, { type });
  }

  get(type: string): AgentAdapter | undefined {
    return this.adapters.get(type);
  }

  has(type: string): boolean {
    return this.adapters.has(type);
  }

  list(): AgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  async getAvailable(): Promise<AdapterInfo[]> {
    const results = await Promise.allSettled(
      Array.from(this.adapters.values()).map(async (adapter) => {
        try {
          const info = await adapter.getInfo();
          return info;
        } catch {
          return {
            type: adapter.type,
            agentName: adapter.type,
            available: false,
          } as AdapterInfo;
        }
      })
    );

    const available = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<AdapterInfo>).value)
      .filter((info) => info.available);

    logger.debug(`Available adapters`, { count: available.length });
    return available;
  }

  async find(agentType: string): Promise<AgentAdapter | null> {
    let adapter = this.get(agentType);
    if (adapter) {
      const available = await adapter.isAvailable();
      if (available) {
        return adapter;
      }
    }

    return null;
  }

  async getBestAdapterForAgent(agentName: string): Promise<AgentAdapter | null> {
    const available = await this.getAvailable();

    for (const info of available) {
      if (info.agentName === agentName) {
        const adapter = this.get(info.type);
        if (adapter) {
          return adapter;
        }
      }
    }

    return null;
  }

  disposeAll(): Promise<void> {
    logger.info('Disposing all adapters');
    const disposals = Array.from(this.adapters.values()).map((adapter) => {
      try {
        return Promise.resolve(adapter.dispose());
      } catch (error) {
        logger.warn('Failed to dispose adapter', { type: adapter.type, error });
        return Promise.resolve();
      }
    });

    return Promise.all(disposals).then(() => {
      this.adapters.clear();
    });
  }
}

export const registry = new AdapterRegistry();
export default registry;
