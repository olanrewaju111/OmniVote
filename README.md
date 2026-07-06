# OmniVote

OmniVote is a comprehensive election monitoring platform designed for the Nigerian electoral context. It provides real-time incident tracking, field agent coordination, multi-tenant dashboard analytics, and AI-powered threat detection capabilities.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript 5
- **Database**: SQLite via Prisma 6 ORM
- **Runtime**: Bun
- **Auth**: Custom JWT (jose + bcryptjs)
- **Styling**: Tailwind CSS 4 + shadcn/ui

## Features

- **Multi-Tenant Architecture** — Isolated data for LOCAL_GOVERNMENT, STATE_GOVERNMENT, and PRESIDENTIAL scope tenants
- **Role-Based Access Control** — 5 roles: SUPER_ADMIN, TENANT_ADMIN, ANALYST, TRUST_SAFETY, FIELD_AGENT
- **Real-Time Dashboard** — 10 parallel KPI queries, election stats, polling unit map bounds, trend analysis
- **Incident Management** — Categorized incidents with priority levels, status tracking, and agent assignments
- **Alert System** — Security threats, cyber alerts, operational warnings, and intelligence reports
- **Field Agent Coordination** — WhatsApp/in-app messaging, GPS check-ins, device fingerprinting, battery/network monitoring
- **Campaign Management** — SMS/WhatsApp dispatch with delivery tracking
- **Audit Logging** — Comprehensive activity tracking with 29+ action types
- **Security** — Tenant isolation, RBAC at middleware/route/operation levels, bcryptjs password hashing

## Project Structure

```
src/
├── app/
│   ├── api/          # 26 API routes
│   ├── dashboard/    # Dashboard pages
│   ├── login/        # Authentication
│   └── layout.tsx
├── components/       # 71 components (27 dashboard + 44 UI)
│   ├── dashboard/    # Dashboard widgets
│   └── ui/           # Reusable UI components
├── lib/
│   ├── auth.ts       # JWT authentication
│   ├── rbac.ts       # Role-based access control
│   └── tenant.ts     # Tenant resolution & isolation
└── middleware.ts      # Edge middleware
```

## Getting Started

```bash
# Install dependencies
bun install

# Set up database
npx prisma db push

# Seed sample data (optional)
bun run scripts/seed-real-data.ts

# Start development server
bun dev
```

## Deployment

```bash
# Build for production (standalone output)
npx next build

# Start production server
node .next/standalone/server.js
```

## License

