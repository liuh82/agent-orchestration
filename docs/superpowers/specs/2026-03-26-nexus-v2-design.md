# Nexus v2 — Design Spec

> Personal Project Management System + Agent Team Management
> Date: 2026-03-26
> Status: Draft (pending user review)

---

## 1. Product Overview

### 1.1 Vision
Nexus is a personal project management system that evolves into an enterprise-grade project and AI agent orchestration platform. It manages projects, tasks, agents, documents, and issues in a unified workspace.

### 1.2 Core Principles
- **Extensible first** — every module is designed to grow; today's simple feature becomes tomorrow's complex system
- **Dashboard as canvas** — the dashboard is a customizable widget grid, not a fixed layout
- **Clean separation** — AI capabilities are external services, not embedded in the PM system
- **Data portability** — all data exportable, no vendor lock-in

### 1.3 Modules (Phase 1)
1. **Agent Management** — team roster + status tracking
2. **Project Management** — projects, modules, milestones, tasks
3. **Task Board** — kanban + list dual view
4. **Issue Tracking** — bugs, decisions, blockers linked to tasks
5. **Dashboard** — customizable widget grid
6. **Basic Document Links** — link external docs (future: embedded doc system)

### 1.4 Modules (Future — Enterprise Expansion)
- Task assignment to agents with workload balancing
- Full agent lifecycle (creation, permissions, cost tracking, performance evaluation)
- AI-powered insights (risk prediction, progress estimation, smart prioritization)
- Team collaboration (multi-user, roles, permissions)
- Knowledge base integration (shared document system)
- Code repository integration
- CI/CD pipeline tracking

---

## 2. Technical Architecture

### 2.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript | Full-stack, SSR, mature ecosystem |
| Styling | Tailwind CSS + shadcn/ui | Consistent components, highly customizable |
| State | Zustand | Lightweight, proven in CCDesk |
| Backend API | Next.js API Routes + tRPC | Type-safe API, auto-generated client |
| Database | PostgreSQL 16 | Reliable, scalable, enterprise-ready |
| ORM | Prisma 6 | Type-safe queries, migrations, excellent DX |
| Auth | NextAuth.js v5 | Flexible, supports future multi-user |
| Drag & Drop | @dnd-kit | Kanban card dragging |
| Charts | Recharts | Dashboard widgets |
| Rich Text | TipTap (ProseMirror) | Task descriptions, doc editing |
| Deployment | Docker + Nginx reverse proxy | Portable, migrateable |

### 2.2 Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                  Next.js App                      │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │  Pages   │  │  tRPC    │  │  Server Actions │ │
│  │ (React)  │──│  Router  │──│  (mutations)    │ │
│  └──────────┘  └──────────┘  └────────┬────────┘ │
└───────────────────────────────────────┼───────────┘
                                        │
                                 ┌──────▼──────┐
                                 │   Prisma    │
                                 │   ORM       │
                                 └──────┬──────┘
                                        │
                                 ┌──────▼──────┐
                                 │ PostgreSQL  │
                                 └─────────────┘

External Services (future):
  ┌──────────────┐
  │ AI Service   │ ← FastAPI (Python), called via HTTP
  │ (independent)│
  └──────────────┘
```

### 2.3 Key Design Decisions

**tRPC over REST API**: Type-safe client-server communication. No need to maintain separate API types. If external API consumers need REST in the future, add a thin REST layer alongside tRPC.

**App Router over Pages Router**: Next.js 15 App Router for layouts, streaming, and server components. Better caching strategy, cleaner route organization.

**Prisma over raw SQL or Drizzle**: Prisma's migration tooling and type generation are best-in-class for this project size. Drizzle is lighter but lacks some DX features we'll want at enterprise scale.

**Single monorepo**: Frontend + backend in one Next.js app. No separate backend repo. Keeps deployment simple. When enterprise scale requires backend separation, tRPC routers can be extracted to a standalone Fastify server.

---

## 3. Data Model

### 3.1 Entity Relationship

```
Agent 1───* Task
Agent *───* Project (participants)

Project 1───* Module
Project 1───* Milestone
Project 1───* Task
Project 1───* Issue
Project 1───* DocumentLink
Project 1───* CostEntry

Module 1───* Task
Milestone 1───* Task
Task 1───* Issue (linked issues)

Task has: status (kanban column), assignee (nullable Agent), module, milestone(s), project
```

### 3.2 Core Schemas (Prisma)

```prisma
// ── Agent ──
model Agent {
  id          String   @id @default(cuid())
  name        String   // Display name (e.g., "小刘")
  code        String   @unique // Codename (e.g., "writer")
  role        String   // e.g., "文案", "架构师", "PM"
  expertise   String[] // Tags: ["copywriting", "react", "python"]
  status      String   @default("active") // active, idle, offline
  avatar      String?  // URL or emoji
  currentProjectId String? // Fk to current project
  currentProject Project? @relation("AgentCurrentProject", fields: [currentProjectId], references: [id])
  projects   ProjectParticipant[]
  tasks      Task[]
  costEntries CostEntry[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ── Project ──
model Project {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique // URL-friendly identifier
  description String?
  status      String   @default("active") // active, archived, on_hold
  priority    String   @default("medium") // low, medium, high, critical
  techStack   String[] // ["react", "python", "postgresql"]
  githubUrl   String?
  coverImage  String?
  startDate   DateTime?
  deadline    DateTime?
  modules     Module[]
  milestones  Milestone[]
  tasks       Task[]
  issues      Issue[]
  documents   DocumentLink[]
  costEntries CostEntry[]
  participants ProjectParticipant[]
  agents      Agent[]  // Agents currently working on this project (reverse of currentProject)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ProjectParticipant {
  id        String @id @default(cuid())
  agentId   String
  projectId String
  agent     Agent  @relation(fields: [agentId], references: [id])
  project   Project @relation(fields: [projectId], references: [id])
  joinedAt  DateTime @default(now())
  @@unique([agentId, projectId])
}

// ── Module (functional grouping) ──
model Module {
  id        String   @id @default(cuid())
  name      String
  color     String   @default("#6366f1")
  order     Int      @default(0)
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks     Task[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ── Milestone (time-based grouping) ──
model Milestone {
  id        String   @id @default(cuid())
  name      String
  targetDate DateTime?
  status    String   @default("upcoming") // upcoming, in_progress, completed, overdue
  order     Int      @default(0)
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks     Task[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ── Task ──
model Task {
  id          String   @id @default(cuid())
  title       String
  description String?  // Rich text (TipTap JSON)
  status      String   @default("todo") // todo, in_progress, in_review, blocked, done
  priority    String   @default("medium") // none, low, medium, high, urgent
  order       Float    @default(0) // Sort order within status column
  assigneeId  String?
  assignee    Agent?   @relation(fields: [assigneeId], references: [id])
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  moduleId    String?
  module      Module?  @relation(fields: [moduleId], references: [id])
  milestoneId String?
  milestone   Milestone? @relation(fields: [milestoneId], references: [id])
  tags        String[] // User-defined tags
  dueDate     DateTime?
  estimatedHours Float?
  actualHours Float?
  issues      Issue[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([projectId, status])
  @@index([assigneeId])
  @@index([milestoneId])
  @@index([moduleId])
}

// ── Issue (problem tracking) ──
model Issue {
  id          String   @id @default(cuid())
  title       String
  description String?
  type        String   @default("bug") // bug, decision, blocker, question, risk
  severity    String   @default("medium") // low, medium, high, critical
  status      String   @default("open") // open, investigating, resolved, closed
  taskId      String?
  task        Task?    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  projectId   String
  // Note: project relation could be derived from task, but denormalized for query performance
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ── Document Link (external doc references) ──
model DocumentLink {
  id        String   @id @default(cuid())
  title     String
  url       String   // External URL (Feishu doc, GitHub, etc.)
  type      String   @default("doc") // doc, spec, design, meeting_notes, other
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

// ── Cost/Resource Tracking ──
model CostEntry {
  id          String   @id @default(cuid())
  agentId     String?
  agent       Agent?   @relation(fields: [agentId], references: [id])
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  taskId      String?  // Optional: link to specific task
  category    String   // token_usage, time_spent, api_cost, manual_entry
  value       Float
  unit        String   @default("tokens") // tokens, hours, usd, cny
  date        DateTime @default(now())
  description String?
  createdAt   DateTime @default(now())
}
```

---

## 4. Module Specifications

### 4.1 Agent Management

**Views:**
- Agent list (cards or table): name, code, role, current project, status indicator
- Agent detail: full profile, assigned tasks, cost history, project history

**Fields:**
- Name, codename (unique), role, expertise tags, status (active/idle/offline), avatar, current project

**Interactions:**
- CRUD agents
- Set status manually or via integration (future)
- View tasks assigned to an agent across all projects
- Cost summary per agent

**Extensibility hooks (future):**
- Agent creation from AI service API
- Auto-status update from task completion
- Performance metrics integration

### 4.2 Project Management

**Views:**
- Project list: cards with cover image, progress bar, task count, agent avatars, deadline
- Project detail: tabbed layout (Tasks | Modules | Milestones | Issues | Documents | Costs | Settings)

**Project detail tabs:**
1. **Tasks** — kanban + list dual view (see 4.3)
2. **Modules** — create/edit/delete modules, set color, drag to reorder
3. **Milestones** — timeline view, status, linked tasks count, target date
4. **Issues** — issue list with filters (type, severity, status)
5. **Documents** — list of external document links, grouped by type
6. **Costs** — summary charts (by agent, by category, over time)
7. **Settings** — project info, tech stack, GitHub link, participants

**Interactions:**
- Create/edit/archive projects
- Add/remove participant agents
- Progress auto-calculated from task completion ratio

### 4.3 Task Board

**Kanban View:**
- Columns: Todo → In Progress → In Review → Blocked → Done
- Cards show: title, tags, priority indicator, assignee avatar, due date
- Drag & drop between columns (updates status)
- Drag to reorder within column
- Group by module or milestone (optional filter)

**List View:**
- Table with columns: title, status, priority, assignee, module, milestone, due date
- Sortable, filterable by any column
- Inline status change
- Batch operations (future)

**Task Detail (slide-in panel):**
- Title, description (rich text editor), status, priority, assignee, module, milestone, tags, due date
- Linked issues
- Time/cost entries
- Activity log (future)

**Filtering & Grouping:**
- Filter by: status, priority, assignee, module, milestone, tags, due date
- Group by: status, assignee, module, milestone

### 4.4 Issue Tracking

**Views:**
- Issue list within project: filterable by type, severity, status
- Issue detail: title, description, linked task, resolution notes

**Issue Types:**
- Bug, Decision, Blocker, Question, Risk

**Interactions:**
- Create/edit/resolve issues
- Link/unlink to tasks
- Link issues across projects (future)

### 4.5 Dashboard

**Architecture:**
- Widget-based grid layout (not fixed)
- User can add, remove, resize, reorder widgets
- Widget configuration persisted per user (future: per-user when multi-user)

**Built-in Widgets (Phase 1):**
- Project Overview — list of active projects with progress bars
- Recent Tasks — latest updated tasks across all projects
- Agent Status — agent team with current status
- Upcoming Deadlines — tasks with due dates in next 7/14/30 days
- Task Statistics — pie chart: tasks by status across all projects
- Project Timeline — horizontal timeline of milestones across projects
- Quick Actions — create task, create project, log time (shortcuts)

**Extensibility:**
- Widget registry pattern: each widget is a React component implementing a Widget interface
- Future widgets can be added as plugins (AI insights, cost analytics, sprint burndown)

**Dashboard persistence:**
- Layout config stored in DB: widget positions, sizes, type, and per-widget settings
- Default layout for new installations

### 4.6 Document Links (Placeholder)

Simple list of external document references per project. No embedded editing.
Future: replaced by Knowledge Base integration.

---

## 5. UI/UX Approach

### 5.1 Design Language
- Dark-first, clean, minimal (similar to Linear/Vercel aesthetic)
- shadcn/ui component library as base
- Tailwind CSS for all styling
- Stitch for detailed UI design mockups

### 5.2 Navigation
- Sidebar navigation: Dashboard, Projects, Agents
- Project context: breadcrumb + tab navigation within project detail
- Command palette (⌘K) for quick actions (future)

### 5.3 Responsive
- Desktop-first (primary use case)
- Tablet-friendly (future)
- Mobile: read-only view (future)

### 5.4 Stitch Design Integration
- UI designs created in Stitch, exported as design tokens
- CC reads Stitch files via stitch-mcp to get exact Tailwind values
- Design files stored in project for reference

---

## 6. API Design

### 6.1 tRPC Router Structure

```
app/
  api/
    trpc/
      [trpc]/
        router.ts        → Root router
        agents/
          router.ts      → CRUD agents, status update
          procedures.ts
        projects/
          router.ts      → CRUD projects, participants
          procedures.ts
        tasks/
          router.ts      → CRUD tasks, status change, reorder
          procedures.ts
        modules/
          router.ts      → CRUD modules, reorder
        milestones/
          router.ts      → CRUD milestones
        issues/
          router.ts      → CRUD issues, link/unlink tasks
        dashboard/
          router.ts      → Layout CRUD, widget data
        costs/
          router.ts      → CRUD cost entries, summaries
```

### 6.2 Authentication (Phase 1)
- Single user (owner) — basic password protection
- NextAuth.js with Credentials provider
- No registration flow needed
- Cookie-based session
- Future: multi-user with role-based access

### 6.3 Real-time Updates (Future)
- WebSocket via Pusher or custom
- Task status changes, new issues, agent status updates
- Not in Phase 1 — poll-based or manual refresh for now

---

## 7. Deployment

### 7.1 Docker Setup

```dockerfile
# Multi-stage build
FROM node:22-alpine AS builder
# Build Next.js app

FROM node:22-alpine AS runner
# Production image
```

```yaml
# docker-compose.yml
services:
  nexus:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://nexus:password@db:5432/nexus
      NEXTAUTH_SECRET: ...
    depends_on:
      - db
    volumes:
      - ./data:/app/data  # SQLite backup? No, PostgreSQL volume

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: nexus
      POSTGRES_USER: nexus
      POSTGRES_PASSWORD: password

volumes:
  pgdata:
```

### 7.2 Nginx Reverse Proxy

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 7.3 Environment Variables

```env
DATABASE_URL=postgresql://nexus:password@localhost:5432/nexus
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://nexus.yourdomain.com
NEXT_PUBLIC_APP_URL=https://nexus.yourdomain.com
```

---

## 8. Phase Plan

### Phase 1 — Foundation (Current)
**Goal:** Working project management system for personal use

1. Project scaffolding (Next.js + Prisma + Docker)
2. Auth (single user, NextAuth)
3. Project CRUD + list view
4. Module & Milestone CRUD
5. Task CRUD + kanban view (drag & drop)
6. Task list view + filtering/grouping
7. Agent CRUD + roster view
8. Dashboard with built-in widgets (customizable grid)
9. Issue tracking (basic)
10. Document links (external URL list)
11. Cost entry tracking (manual)

### Phase 2 — Polish & Expand
- Task detail slide-in panel with rich text
- Milestone timeline view
- Cost summary charts
- Dashboard widget customization UI
- Activity log per task/project
- Keyboard shortcuts + command palette (⌘K)

### Phase 3 — Enterprise Expansion
- Multi-user + role-based permissions
- Task assignment to agents with notifications
- Agent lifecycle management
- AI Service integration (FastAPI microservice)
- Knowledge Base integration
- Code repository integration
- Real-time updates (WebSocket)
- Export/Import (CSV, JSON)

---

## 9. Extensibility Design

### 9.1 Towards Enterprise
- **Multi-tenancy**: Add `organizationId` to all tables, tenant isolation via Prisma middleware
- **Roles & Permissions**: RBAC model with granular permissions (project-level, org-level)
- **Audit Log**: Track all mutations for compliance
- **API Rate Limiting**: Per-organization rate limits
- **Webhooks**: Notify external systems on events

### 9.2 Towards Agent Orchestration
- **Agent Runtime Interface**: Standard protocol for agents to register, receive tasks, report status
- **Task Queue**: Background job processing (BullMQ or similar) for agent task distribution
- **Agent Communication**: Message bus between agents for collaborative workflows
- **Observability**: Agent health checks, performance metrics, cost tracking per agent

### 9.3 Plugin Architecture (Future)
- Widget plugin system for Dashboard
- Custom field types for Tasks/Projects
- Integration plugins (GitHub, Feishu, Slack, etc.)
- All plugins via well-defined interfaces, not code modification

---

## 10. Non-Goals (Phase 1)

- Multi-user support (single owner only)
- Real-time collaboration
- Mobile app
- Email notifications
- File upload/storage (use external links)
- Embedded document editor (use external links)
- AI-powered features
- Automated testing pipeline
- CI/CD integration
