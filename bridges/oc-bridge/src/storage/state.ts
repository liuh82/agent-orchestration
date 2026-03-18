/**
 * Task state persistence — saves running tasks to disk so bridge can
 * warn about unfinished work after a crash.
 */
import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR } from "./config.js";
import { logger } from "../logger/index.js";
import type { Task } from "../task/types.js";

const STATE_VERSION = 1;
const STATE_FILE = path.join(CONFIG_DIR, "state.json");

export interface PersistedTask {
  taskId: string;
  prompt: string;
  projectPath: string;
  agentType: string;
  timeout: number;
  status: string;
  startedAt: number;
}

interface StateFile {
  version: number;
  tasks: PersistedTask[];
  lastSaved: string;
}

/** Read persisted state (returns empty structure if missing). */
export function loadState(): StateFile {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw) as StateFile;
  } catch {
    return { version: STATE_VERSION, tasks: [], lastSaved: new Date().toISOString() };
  }
}

/** Write full state to disk. */
export function saveState(state: StateFile): void {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    state.lastSaved = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    logger.error(`Failed to save state: ${err}`);
  }
}

/** Convert a runtime Task to a PersistedTask. */
export function toPersisted(task: Task): PersistedTask {
  return {
    taskId: task.taskId,
    prompt: task.prompt,
    projectPath: task.projectPath,
    agentType: task.agentType,
    timeout: task.timeout,
    status: task.status,
    startedAt: task.startedAt ?? Date.now(),
  };
}

/**
 * Check for unfinished tasks from a previous session.
 * Returns the list and logs a warning if any exist.
 */
export function checkPreviousSession(): PersistedTask[] {
  const state = loadState();
  if (state.tasks.length > 0) {
    logger.warn(
      `WARNING: Found ${state.tasks.length} unfinished task(s) from previous session`,
    );
    for (const t of state.tasks) {
      logger.warn(`  - ${t.taskId} (${t.status}, started: ${new Date(t.startedAt).toISOString()})`);
    }
  }
  return state.tasks;
}
