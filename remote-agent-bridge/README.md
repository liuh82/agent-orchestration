# OC Bridge

> Remote Agent Bridge for AI Agent Orchestration - Cross-platform bridge service

## Version

Current: `0.1.0`

## Overview

OC Bridge is a Node.js/TypeScript service that runs on development machines (Mac/Windows/Linux) and connects to a remote OpenClaw Gateway via WebSocket. It receives AI coding tasks (codex/pi/acp) from the gateway and executes them using local AI agents.

## Architecture

```
┌─────────────────────────────────────┐
│      OpenClaw Gateway             │
│      :18789 (WebSocket)           │
└───────────────┬─────────────────┘
                │
        WSS (双向)
                │
┌───────────────▼─────────────────┐
│      OC Bridge Service           │
│      (Node.js/TypeScript)      │
│                               │
│  ┌──────────────────────────┐   │
│  │   WebSocket Client      │   │
│  │   + Task Queue        │   │
│  │   + Task Runner       │   │
│  └──────────────────────────┘   │
│                               │
│  ┌──────────────────────────┐   │
│  │   Adapter Layer        │   │
│  │  - CLI Adapter        │   │
│  │  - VSCode Adapter    │   │
│  │  - Cursor Adapter    │   │
│  │  - IntelliJ Adapter  │   │
│  └──────────────────────────┘   │
└───────────────────────────────────┘
```

## Installation

```bash
npm install -g @liuh82/oc-bridge
```

Or from source:

```bash
git clone <repo>
cd remote-agent-bridge
npm install
npm run build
npm link
```

## Usage

### Start the Bridge

```bash
oc-bridge start
```

Options:
- `--gateway-url <url>` - Gateway WebSocket URL
- `--gateway-token <token>` - Gateway authentication token
- `--http-port <port>` - HTTP server port (default: 18790)
- `--log-level <level>` - Log level: error, warn, info, debug

### Interactive Setup

```bash
oc-bridge setup
```

### Show Status

```bash
oc-bridge status
```

### Manage Configuration

```bash
# Show config
oc-bridge config show

# Edit config
oc-bridge config edit

# Reset to defaults
oc-bridge config reset
```

### Set Gateway Token

```bash
oc-bridge token <your-token>
```

## Configuration

Configuration is stored in:
- **Mac/Linux**: `~/.oc-bridge/config.json`
- **Windows**: `%APPDATA%\oc-bridge\config.json`

### Environment Variables

- `OC_BRIDGE_ID` - Bridge identifier
- `OC_GATEWAY_URL` - Gateway WebSocket URL
- `OC_GATEWAY_TOKEN` - Gateway authentication token
- `OC_GATEWAY_HEARTBEAT_INTERVAL` - Heartbeat interval in ms
- `OC_TASKS_MAX_CONCURRENT` - Maximum concurrent tasks
- `OC_TASKS_DEFAULT_TIMEOUT` - Default task timeout in seconds
- `OC_HTTP_ENABLED` - Enable HTTP API server
- `OC_HTTP_HOST` - HTTP server host
- `OC_HTTP_PORT` - HTTP server port
- `OC_LOG_LEVEL` - Log level
- `OC_DATABASE_PATH` - SQLite database path
- `OC_CHECKPOINT_ENABLED` - Enable checkpointing
- `OC_SANDBOX_ENABLED` - Enable task sandbox

## HTTP API

When enabled, the HTTP server provides a REST API:

### Endpoints

- `GET /api/v1/health` - Health check
- `GET /api/v1/status` - Bridge status
- `GET /api/v1/tasks` - List tasks
- `GET /api/v1/tasks/:id` - Get task details
- `POST /api/v1/tasks` - Submit a task
- `DELETE /api/v1/tasks/:id` - Cancel a task
- `GET /api/v1/agents` - List available agents

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Run tests
npm run test

# Lint
npm run lint

# Format
npm run format
```

## Security

- Command whitelist validation
- Dangerous pattern detection
- Prompt safety checks
- Audit logging
- Token-based authentication

## License

MIT

## Contributing

Contributions welcome! Please read the contributing guidelines first.
