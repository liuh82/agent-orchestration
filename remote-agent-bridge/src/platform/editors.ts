import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { OS } from './index.js';

interface EditorInfo {
  name: string;
  displayName: string;
  path: string;
  command: string;
}

interface EditorConfig {
  name: string;
  displayName: string;
  paths: string[];
  command: string;
}

const editorConfigs: Record<string, EditorConfig[]> = {
  darwin: [
    {
      name: 'vscode',
      displayName: 'Visual Studio Code',
      paths: [
        '/usr/local/bin/code',
        '/usr/bin/code',
        join(homedir(), '.vscode-server/cli/servers/*/bin/code'),
      ],
      command: 'code',
    },
    {
      name: 'cursor',
      displayName: 'Cursor',
      paths: [
        '/usr/local/bin/cursor',
        '/usr/bin/cursor',
        join(homedir(), '.cursor-server/cli/servers/*/bin/cursor'),
      ],
      command: 'cursor',
    },
    {
      name: 'idea',
      displayName: 'IntelliJ IDEA',
      paths: ['/usr/local/bin/idea', '/usr/bin/idea'],
      command: 'idea',
    },
  ],
  win32: [
    {
      name: 'vscode',
      displayName: 'Visual Studio Code',
      paths: [
        String(process.env['LOCALAPPDATA'] || ''),
        join(String(process.env['APPDATA'] || ''), '..', 'Local', 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
        resolve('C:\\Program Files', 'Microsoft VS Code', 'bin', 'code.cmd'),
      ],
      command: 'code',
    },
    {
      name: 'cursor',
      displayName: 'Cursor',
      paths: [
        String(process.env['LOCALAPPDATA'] || ''),
        join(String(process.env['APPDATA'] || ''), '..', 'Local', 'Programs', 'Cursor', 'bin', 'cursor.cmd'),
      ],
      command: 'cursor',
    },
    {
      name: 'idea',
      displayName: 'IntelliJ IDEA',
      paths: [
        resolve('C:\\Program Files', 'JetBrains', 'IntelliJ IDEA', 'bin', 'idea.bat'),
      ],
      command: 'idea',
    },
  ],
  linux: [
    {
      name: 'vscode',
      displayName: 'Visual Studio Code',
      paths: ['/usr/bin/code', '/usr/local/bin/code', join(homedir(), '.vscode-server/cli/servers/*/bin/code')],
      command: 'code',
    },
    {
      name: 'cursor',
      displayName: 'Cursor',
      paths: ['/usr/bin/cursor', '/usr/local/bin/cursor'],
      command: 'cursor',
    },
    {
      name: 'idea',
      displayName: 'IntelliJ IDEA',
      paths: ['/usr/local/bin/idea', '/usr/bin/idea'],
      command: 'idea',
    },
  ],
};

export function findEditor(name: string): EditorInfo | null {
  const configs = editorConfigs[OS] || [];
  const editor = configs.find((e) => e.name === name);

  if (!editor) {
    return null;
  }

  for (const templatePath of editor.paths) {
    if (existsSync(templatePath)) {
      return {
        name: editor.name,
        displayName: editor.displayName,
        path: templatePath,
        command: editor.command,
      };
    }
  }

  return null;
}

export function findAllEditors(): EditorInfo[] {
  const configs = editorConfigs[OS] || [];
  const found: EditorInfo[] = [];

  for (const editor of configs) {
    for (const templatePath of editor.paths) {
      if (existsSync(templatePath)) {
        found.push({
          name: editor.name,
          displayName: editor.displayName,
          path: templatePath,
          command: editor.command,
        });
        break;
      }
    }
  }

  return found;
}

export async function getEditorVersion(editorPath: string): Promise<string | null> {
  try {
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      const proc = spawn(editorPath, ['--version'], {
        shell: OS === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        const match = output.match(/\d+\.\d+\.\d+/);
        resolve(match?.[0] || output.trim().split('\n')[0] || null);
      });

      setTimeout(() => {
        proc.kill();
      }, 5000).unref();
    });
  } catch {
    return null;
  }
}
