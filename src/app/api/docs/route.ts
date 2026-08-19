// OpenAPI 3.0.3 spec for OmniVote Election Monitor API
// Built programmatically using helper functions to stay DRY

import { NextResponse } from 'next/server';
import type { OpenAPIV3 } from 'openapi-types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build an OpenAPI SchemaObject */
function schema(props: Record<string, OpenAPIV3.SchemaObject>, required?: string[]): OpenAPIV3.SchemaObject {
  const s: OpenAPIV3.SchemaObject = { type: 'object', properties: props };
  if (required && required.length > 0) s.required = required;
  return s;
}

/** Shorthand for a single property */
function prop(description: string, example?: unknown): OpenAPIV3.SchemaObject {
  return { type: 'string', description, ...(example !== undefined ? { example } : {}) };
}

function numProp(description: string, example?: number): OpenAPIV3.SchemaObject {
  return { type: 'number', description, ...(example !== undefined ? { example } : {}) };
}

function boolProp(description: string, example?: boolean): OpenAPIV3.SchemaObject {
  return { type: 'boolean', description, ...(example !== undefined ? { example } : {}) };
}

function arrayProp(items: OpenAPIV3.SchemaObject, description: string): OpenAPIV3.SchemaObject {
  return { type: 'array', items, description };
}

/** Build standard responses map */
function ok(contentSchema?: OpenAPIV3.SchemaObject): OpenAPIV3.ResponsesObject {
  const r: OpenAPIV3.ResponsesObject = {};
  if (contentSchema) {
    r['200'] = {
      description: 'Success',
      content: { 'application/json': { schema: contentSchema } },
    };
  } else {
    r['200'] = { description: 'Success' };
  }
  return r;
}

function textOk(description: string): OpenAPIV3.ResponsesObject {
  return {
    '200': { description, content: { 'text/plain': { schema: { type: 'string' } } } },
  };
}

function streamOk(): OpenAPIV3.ResponsesObject {
  return {
    '200': {
      description: 'SSE stream connected',
      content: { 'text/event-stream': { schema: { type: 'string', description: 'Server-Sent Events stream' } } },
    },
  };
}

function noContent(): OpenAPIV3.ResponsesObject {
  return { '204': { description: 'No Content' } };
}

/** Standard error responses */
function errRes(extra?: OpenAPIV3.ResponsesObject): OpenAPIV3.ResponsesObject {
  return {
    '400': { description: 'Bad Request', content: { 'application/json': { schema: errorSchema } } },
    '401': { description: 'Unauthorized', content: { 'application/json': { schema: errorSchema } } },
    '403': { description: 'Forbidden', content: { 'application/json': { schema: errorSchema } } },
    '429': { description: 'Rate Limited', content: { 'application/json': { schema: errorSchema } } },
    '500': { description: 'Internal Server Error', content: { 'application/json': { schema: errorSchema } } },
    ...extra,
  };
}

function errResPublic(extra?: OpenAPIV3.ResponsesObject): OpenAPIV3.ResponsesObject {
  return {
    '400': { description: 'Bad Request', content: { 'application/json': { schema: errorSchema } } },
    '429': { description: 'Rate Limited', content: { 'application/json': { schema: errorSchema } } },
    '500': { description: 'Internal Server Error', content: { 'application/json': { schema: errorSchema } } },
    ...extra,
  };
}

/** Make a JSON request body */
function body(contentSchema: OpenAPIV3.SchemaObject, required?: string[]): OpenAPIV3.RequestBodyObject {
  return {
    required: true,
    content: { 'application/json': { schema: contentSchema, ...(required ? { required } : {}) } },
  };
}

/** Path parameter */
function pathParam(name: string, description: string): OpenAPIV3.ParameterObject {
  return { name, in: 'path', required: true, schema: { type: 'string' }, description };
}

/** Query parameter */
function queryParam(name: string, description: string, required = false, schema?: OpenAPIV3.SchemaObject): OpenAPIV3.ParameterObject {
  return { name, in: 'query', required, description, schema: schema ?? { type: 'string' } };
}

/** Build a full OperationObject for a method */
function op(
  summary: string,
  tags: string[],
  options: {
    secured?: boolean;
    parameters?: OpenAPIV3.ParameterObject[];
    requestBody?: OpenAPIV3.RequestBodyObject;
    responses: OpenAPIV3.ResponsesObject;
    deprecated?: boolean;
    description?: string;
  }
): OpenAPIV3.OperationObject {
  const operation: OpenAPIV3.OperationObject = {
    summary,
    tags,
    responses: options.responses,
  };
  if (options.description) operation.description = options.description;
  if (options.deprecated) operation.deprecated = true;
  if (options.secured !== false) operation.security = [{ cookieAuth: [] }];
  if (options.parameters?.length) operation.parameters = options.parameters;
  if (options.requestBody) operation.requestBody = options.requestBody;
  return operation;
}

// ─── Common schemas ─────────────────────────────────────────────────────────

const errorSchema = schema({
  error: { type: 'string', description: 'Error message' },
  code: { type: 'string', description: 'Machine-readable error code' },
});

const idSchema = schema({ id: { type: 'string', description: 'Resource ID' } });

const paginationParams: OpenAPIV3.ParameterObject[] = [
  queryParam('page', 'Page number', false, { type: 'integer', minimum: 1, default: 1 }),
  queryParam('limit', 'Items per page', false, { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
];

// ─── Tags ───────────────────────────────────────────────────────────────────

const tags: OpenAPIV3.TagObject[] = [
  { name: 'Authentication', description: 'Login, logout, 2FA, password management, and session handling' },
  { name: 'Dashboard', description: 'Dashboard data, widgets, and overview statistics' },
  { name: 'Elections', description: 'Election lifecycle management – create, update, and query elections' },
  { name: 'Incidents', description: 'Incident tracking and resolution workflow' },
  { name: 'Alerts', description: 'Alert configuration and acknowledgement' },
  { name: 'Reports', description: 'Report generation, templates, and scheduled reporting' },
  { name: 'Agents', description: 'Field agent management and deployment' },
  { name: 'Monitoring', description: 'System health, metrics, SLO, and monitoring alerts' },
  { name: 'SRE', description: 'Site Reliability Engineering – runbooks and operational tooling' },
  { name: 'Campaigns', description: 'Campaign management, contacts, and campaign analytics' },
  { name: 'Security', description: 'Security audit logs, threat detection, and security settings' },
  { name: 'Chat', description: 'Real-time chat and messaging' },
  { name: 'Evidence', description: 'Evidence collection, upload, and chain-of-custody tracking' },
  { name: 'PVT', description: 'Parallel Vote Tabulation – parallel counting and verification' },
  { name: 'OSINT', description: 'Open-Source Intelligence gathering and analysis' },
  { name: 'Geofence', description: 'Geofence zones, perimeters, and location-based rules' },
  { name: 'Tenants', description: 'Multi-tenant management and configuration' },
  { name: 'Settings', description: 'Tenant and application settings' },
  { name: 'Field Operations', description: 'Field-level operations including flashpoint, honeypot, engagement, and voter suppression tracking' },
];

// ─── Paths ──────────────────────────────────────────────────────────────────

const paths: OpenAPIV3.PathsObject = {
  // ── Public routes ───────────────────────────────────────────────────────

  '/api/health': {
    get: op('Health check', ['Monitoring'], {
      secured: false,
      responses: { '200': { description: 'Service healthy', content: { 'application/json': { schema: schema({ status: { type: 'string', example: 'ok' }, uptime: numProp('Seconds since start', 1234), timestamp: prop('ISO timestamp', '2025-01-01T00:00:00Z') }) } } } },
    }),
  },

  '/api/auth': {
    get: op('Get current session or tenants list', ['Authentication'], {
      secured: false,
      responses: ok(schema({
        user: { type: 'object', description: 'Current user if authenticated', properties: { id: prop(''), email: prop(''), role: prop(''), tenantId: prop('') } },
        tenants: arrayProp(schema({ id: prop(''), name: prop(''), slug: prop(''), logo: prop('') }), 'Available tenants'),
      })),
    }),
    post: op('Login', ['Authentication'], {
      secured: false,
      requestBody: body(schema({
        email: { type: 'string', format: 'email', description: 'User email', example: 'admin@omnivote.io' },
        password: { type: 'string', format: 'password', description: 'User password' },
        tenantSlug: { type: 'string', description: 'Tenant slug for multi-tenant login' },
      }, ['email', 'password'])),
      responses: ok(schema({ token: prop('Session token'), user: { type: 'object', description: 'Authenticated user', properties: { id: prop(''), email: prop(''), name: prop(''), role: prop('') } } })),
    }),
    delete: op('Logout', ['Authentication'], {
      responses: noContent(),
    }),
  },

  '/api/auth/forgot-password': {
    post: op('Request password reset email', ['Authentication'], {
      secured: false,
      requestBody: body(schema({ email: { type: 'string', format: 'email', description: 'Registered email address' } }, ['email'])),
      responses: ok(schema({ message: prop('Confirmation message', 'Password reset email sent') })),
    }),
  },

  '/api/auth/reset-password': {
    post: op('Reset password with token', ['Authentication'], {
      secured: false,
      requestBody: body(schema({
        token: { type: 'string', description: 'Password reset token from email' },
        password: { type: 'string', format: 'password', description: 'New password (min 8 chars)' },
        confirmPassword: { type: 'string', format: 'password', description: 'Confirm new password' },
      }, ['token', 'password', 'confirmPassword'])),
      responses: ok(schema({ message: prop('Password reset successful') })),
    }),
  },

  '/api/auth/register': {
    post: op('Register a new user', ['Authentication'], {
      secured: false,
      requestBody: body(schema({
        email: { type: 'string', format: 'email', description: 'User email' },
        password: { type: 'string', format: 'password', description: 'Password (min 8 chars)' },
        name: { type: 'string', description: 'Full name' },
        tenantSlug: { type: 'string', description: 'Tenant to join (optional)' },
        inviteCode: { type: 'string', description: 'Invitation code (if applicable)' },
      }, ['email', 'password', 'name'])),
      responses: ok(schema({ user: { type: 'object', properties: { id: prop(''), email: prop(''), name: prop('') } }, token: prop('Session token') })),
    }),
  },

  '/api/auth/2fa/verify': {
    post: op('Verify 2FA code during login', ['Authentication'], {
      secured: false,
      requestBody: body(schema({
        tempToken: { type: 'string', description: 'Temporary token from login response' },
        code: { type: 'string', description: '6-digit TOTP code' },
      }, ['tempToken', 'code'])),
      responses: ok(schema({ token: prop('Session token'), user: { type: 'object', properties: { id: prop(''), email: prop('') } } })),
    }),
  },

  '/api/metrics': {
    get: op('Prometheus metrics', ['Monitoring'], {
      secured: false,
      responses: textOk('Prometheus exposition format metrics'),
    }),
    post: op('Ingest client-side metrics', ['Monitoring'], {
      secured: false,
      requestBody: body(schema({
        metrics: arrayProp(schema({ name: prop('Metric name'), value: numProp('Metric value'), tags: { type: 'object', description: 'Key-value tags', additionalProperties: { type: 'string' } }, timestamp: numProp('Unix timestamp in ms') }), 'Client metrics batch'),
      }, ['metrics'])),
      responses: noContent(),
    }),
  },

  '/api/slo': {
    get: op('Get SLO status and compliance', ['Monitoring'], {
      secured: false,
      responses: ok(arrayProp(schema({
        name: prop('SLO name'),
        target: numProp('Target percentage', 99.9),
        current: numProp('Current percentage', 99.95),
        status: prop('Status: healthy/degraded/breached'),
        window: prop('Time window'),
      }), 'SLO definitions and current status')),
    }),
  },

  '/api/runbooks': {
    get: op('List runbooks', ['SRE'], {
      secured: false,
      parameters: paginationParams,
      responses: ok(arrayProp(schema({ id: prop(''), title: prop('Runbook title'), severity: prop('Severity level'), status: prop('Status'), createdAt: prop('ISO timestamp'), updatedAt: prop('ISO timestamp') }), 'Runbooks')),
    }),
  },

  '/api/runbooks/{id}': {
    get: op('Get runbook by ID', ['SRE'], {
      secured: false,
      parameters: [pathParam('id', 'Runbook ID')],
      responses: ok(schema({ id: prop(''), title: prop(''), severity: prop(''), status: prop(''), content: prop('Markdown content'), steps: arrayProp(schema({ step: numProp('Step number'), action: prop('Action to take'), expected: prop('Expected outcome') }), 'Runbook steps'), createdAt: prop(''), updatedAt: prop('') })),
    }),
  },

  '/api/tenants': {
    get: op('List tenants (public slug lookup: ?slug=X)', ['Tenants'], {
      secured: false,
      parameters: [queryParam('slug', 'Tenant slug for public lookup')],
      responses: ok(arrayProp(schema({ id: prop(''), name: prop(''), slug: prop(''), logo: prop(''), primaryColor: prop(''), isActive: boolProp('') }), 'Tenants')),
    }),
    post: op('Create tenant (admin)', ['Tenants'], {
      requestBody: body(schema({
        name: { type: 'string', description: 'Tenant name' },
        slug: { type: 'string', description: 'Unique URL slug' },
        logo: { type: 'string', description: 'Logo URL' },
        primaryColor: { type: 'string', description: 'Brand primary color hex' },
        settings: { type: 'object', description: 'Tenant-specific settings', additionalProperties: { type: 'string' } },
      }, ['name', 'slug'])),
      responses: ok(schema({ id: prop(''), name: prop(''), slug: prop('') })),
    }),
    put: op('Update tenant (admin)', ['Tenants'], {
      requestBody: body(schema({
        name: { type: 'string', description: 'Tenant name' },
        slug: { type: 'string', description: 'Unique URL slug' },
        logo: { type: 'string', description: 'Logo URL' },
        primaryColor: { type: 'string', description: 'Brand primary color hex' },
        isActive: boolProp('Whether tenant is active'),
      })),
      responses: ok(schema({ id: prop(''), name: prop(''), slug: prop('') })),
    }),
    delete: op('Delete tenant (admin)', ['Tenants'], {
      parameters: [queryParam('id', 'Tenant ID', true)],
      responses: noContent(),
    }),
  },

  '/api/tenants/users': {
    get: op('List tenant users (admin)', ['Tenants'], {
      parameters: [...paginationParams, queryParam('tenantId', 'Filter by tenant ID')],
      responses: ok(arrayProp(schema({ id: prop(''), email: prop(''), name: prop(''), role: prop(''), tenantId: prop(''), isActive: boolProp(''), createdAt: prop('') }), 'Tenant users')),
    }),
    post: op('Add user to tenant (admin)', ['Tenants'], {
      requestBody: body(schema({
        email: { type: 'string', format: 'email', description: 'User email' },
        name: { type: 'string', description: 'User full name' },
        role: { type: 'string', description: 'User role', enum: ['admin', 'analyst', 'agent', 'viewer'] },
        tenantId: { type: 'string', description: 'Tenant ID' },
      }, ['email', 'name', 'role', 'tenantId'])),
      responses: ok(schema({ id: prop(''), email: prop(''), name: prop(''), role: prop('') })),
    }),
    patch: op('Update tenant user (admin)', ['Tenants'], {
      requestBody: body(schema({
        userId: { type: 'string', description: 'User ID' },
        role: { type: 'string', description: 'New role', enum: ['admin', 'analyst', 'agent', 'viewer'] },
        isActive: boolProp('Active status'),
      }, ['userId'])),
      responses: ok(schema({ id: prop(''), role: prop(''), isActive: boolProp('') })),
    }),
    delete: op('Remove user from tenant (admin)', ['Tenants'], {
      parameters: [queryParam('userId', 'User ID', true), queryParam('tenantId', 'Tenant ID', true)],
      responses: noContent(),
    }),
  },

  // ── Authenticated routes ────────────────────────────────────────────────

  '/api/dashboard': {
    get: op('Get dashboard data', ['Dashboard'], {
      responses: ok(schema({
        stats: { type: 'object', description: 'Key statistics', properties: { totalElections: numProp(''), activeIncidents: numProp(''), agentsDeployed: numProp(''), alertsActive: numProp('') } },
        recentActivity: arrayProp(schema({ id: prop(''), type: prop(''), message: prop(''), timestamp: prop('') }), 'Recent activity feed'),
        charts: { type: 'object', description: 'Chart data for dashboard widgets' },
      })),
    }),
    post: op('Update dashboard configuration', ['Dashboard'], {
      requestBody: body(schema({
        layout: { type: 'array', description: 'Widget layout configuration', items: { type: 'object' } },
        widgets: { type: 'array', description: 'Enabled widgets', items: { type: 'string' } },
        filters: { type: 'object', description: 'Active dashboard filters', additionalProperties: { type: 'string' } },
      })),
      responses: ok(schema({ layout: { type: 'array', items: { type: 'object' } }, widgets: { type: 'array', items: { type: 'string' } } })),
    }),
  },

  '/api/agents': {
    get: op('List agents', ['Agents'], {
      parameters: [...paginationParams, queryParam('status', 'Filter by status'), queryParam('electionId', 'Filter by election ID')],
      responses: ok(arrayProp(schema({
        id: prop(''), name: prop(''), phone: prop(''), status: prop('Status: active/inactive/deployed'),
        location: { type: 'object', description: 'GPS coordinates', properties: { lat: numProp(''), lng: numProp('') } },
        electionId: prop(''), lastSeen: prop('ISO timestamp'),
      }), 'Field agents')),
    }),
    post: op('Create agent', ['Agents'], {
      requestBody: body(schema({
        name: { type: 'string', description: 'Agent name' },
        phone: { type: 'string', description: 'Phone number' },
        electionId: { type: 'string', description: 'Assigned election ID' },
        location: { type: 'object', description: 'Initial location', properties: { lat: numProp(''), lng: numProp('') } },
      }, ['name', 'phone', 'electionId'])),
      responses: ok(schema({ id: prop(''), name: prop(''), phone: prop(''), status: prop('') })),
    }),
    patch: op('Update agent', ['Agents'], {
      requestBody: body(schema({
        id: { type: 'string', description: 'Agent ID' },
        name: { type: 'string', description: 'Agent name' },
        status: { type: 'string', description: 'New status', enum: ['active', 'inactive', 'deployed'] },
        location: { type: 'object', description: 'New location', properties: { lat: numProp(''), lng: numProp('') } },
      }, ['id'])),
      responses: ok(schema({ id: prop(''), name: prop(''), status: prop('') })),
    }),
  },

  '/api/elections': {
    get: op('List elections', ['Elections'], {
      parameters: [...paginationParams, queryParam('status', 'Filter by status'), queryParam('search', 'Search term')],
      responses: ok(arrayProp(schema({
        id: prop(''), title: prop('Election title'), status: prop('Status: upcoming/active/completed/cancelled'),
        date: prop('Election date'), location: prop('Location'),
        totalPollingStations: numProp('Number of polling stations'),
        results: { type: 'object', description: 'Election results if available' },
      }), 'Elections')),
    }),
    post: op('Create election', ['Elections'], {
      requestBody: body(schema({
        title: { type: 'string', description: 'Election title' },
        date: { type: 'string', format: 'date', description: 'Election date' },
        location: { type: 'string', description: 'Election location' },
        description: { type: 'string', description: 'Description' },
        totalPollingStations: { type: 'integer', description: 'Expected polling station count' },
        settings: { type: 'object', description: 'Election-specific settings', additionalProperties: { type: 'string' } },
      }, ['title', 'date', 'location'])),
      responses: ok(schema({ id: prop(''), title: prop(''), status: prop('') })),
    }),
  },

  '/api/elections/{id}': {
    patch: op('Update election', ['Elections'], {
      parameters: [pathParam('id', 'Election ID')],
      requestBody: body(schema({
        title: { type: 'string', description: 'Election title' },
        status: { type: 'string', description: 'New status', enum: ['upcoming', 'active', 'completed', 'cancelled'] },
        description: { type: 'string', description: 'Description' },
        settings: { type: 'object', description: 'Election settings', additionalProperties: { type: 'string' } },
      })),
      responses: ok(schema({ id: prop(''), title: prop(''), status: prop('') })),
    }),
    delete: op('Delete election', ['Elections'], {
      parameters: [pathParam('id', 'Election ID')],
      responses: noContent(),
    }),
  },

  '/api/incidents': {
    get: op('List incidents', ['Incidents'], {
      parameters: [...paginationParams, queryParam('status', 'Filter by status'), queryParam('severity', 'Filter by severity'), queryParam('electionId', 'Filter by election')],
      responses: ok(arrayProp(schema({
        id: prop(''), title: prop('Incident title'), description: prop(''),
        severity: prop('Severity: low/medium/high/critical'),
        status: prop('Status: open/investigating/resolved/closed'),
        electionId: prop(''), location: { type: 'object', description: 'Location coordinates', properties: { lat: numProp(''), lng: numProp(''), address: prop('') } },
        reportedBy: prop(''), createdAt: prop(''), updatedAt: prop(''),
      }), 'Incidents')),
    }),
    post: op('Create incident', ['Incidents'], {
      requestBody: body(schema({
        title: { type: 'string', description: 'Incident title' },
        description: { type: 'string', description: 'Detailed description' },
        severity: { type: 'string', description: 'Severity', enum: ['low', 'medium', 'high', 'critical'] },
        electionId: { type: 'string', description: 'Related election ID' },
        location: { type: 'object', description: 'Incident location', properties: { lat: numProp(''), lng: numProp(''), address: prop('') } },
        evidence: arrayProp(prop('Evidence ID reference'), 'Associated evidence IDs'),
      }, ['title', 'severity', 'electionId'])),
      responses: ok(schema({ id: prop(''), title: prop(''), severity: prop(''), status: prop('') })),
    }),
  },

  '/api/incidents/{id}': {
    patch: op('Update incident', ['Incidents'], {
      parameters: [pathParam('id', 'Incident ID')],
      requestBody: body(schema({
        title: { type: 'string', description: 'Incident title' },
        description: { type: 'string', description: 'Description' },
        severity: { type: 'string', description: 'Severity', enum: ['low', 'medium', 'high', 'critical'] },
        status: { type: 'string', description: 'Status', enum: ['open', 'investigating', 'resolved', 'closed'] },
        resolution: { type: 'string', description: 'Resolution notes' },
      })),
      responses: ok(schema({ id: prop(''), title: prop(''), status: prop('') })),
    }),
    delete: op('Delete incident', ['Incidents'], {
      parameters: [pathParam('id', 'Incident ID')],
      responses: noContent(),
    }),
  },

  '/api/alerts': {
    get: op('List alerts', ['Alerts'], {
      parameters: [...paginationParams, queryParam('status', 'Filter by status: active/acknowledged/resolved'), queryParam('severity', 'Filter by severity')],
      responses: ok(arrayProp(schema({
        id: prop(''), title: prop('Alert title'), message: prop('Alert message'),
        severity: prop('Severity: info/warning/error/critical'),
        status: prop('Status: active/acknowledged/resolved'),
        source: prop('Alert source system'),
        createdAt: prop(''), acknowledgedAt: prop(''), resolvedAt: prop(''),
      }), 'Alerts')),
    }),
    patch: op('Acknowledge or resolve alert', ['Alerts'], {
      requestBody: body(schema({
        id: { type: 'string', description: 'Alert ID' },
        action: { type: 'string', description: 'Action to take', enum: ['acknowledge', 'resolve', 'snooze'] },
        note: { type: 'string', description: 'Optional note' },
      }, ['id', 'action'])),
      responses: ok(schema({ id: prop(''), status: prop(''), acknowledgedAt: prop('') })),
    }),
  },

  '/api/reports': {
    get: op('List reports', ['Reports'], {
      parameters: paginationParams,
      responses: ok(arrayProp(schema({
        id: prop(''), title: prop(''), type: prop('Report type'),
        status: prop('Status: pending/generating/completed/failed'),
        createdAt: prop(''), completedAt: prop(''),
        downloadUrl: prop(''),
      }), 'Reports')),
    }),
    post: op('Create report', ['Reports'], {
      requestBody: body(schema({
        title: { type: 'string', description: 'Report title' },
        type: { type: 'string', description: 'Report type', enum: ['election', 'incident', 'daily', 'weekly', 'custom'] },
        electionId: { type: 'string', description: 'Related election ID' },
        dateRange: { type: 'object', description: 'Date range', properties: { start: prop('Start date'), end: prop('End date') } },
        sections: arrayProp(prop('Report section identifier'), 'Sections to include'),
      }, ['title', 'type'])),
      responses: ok(schema({ id: prop(''), title: prop(''), status: prop('') })),
    }),
  },

  '/api/reports/generate': {
    post: op('Generate report (async)', ['Reports'], {
      requestBody: body(schema({
        reportId: { type: 'string', description: 'Report ID to generate' },
        format: { type: 'string', description: 'Output format', enum: ['pdf', 'xlsx', 'csv', 'json'] },
      }, ['reportId', 'format'])),
      responses: ok(schema({ reportId: prop(''), status: prop('generating'), estimatedTime: numProp('Estimated seconds to complete') })),
    }),
  },

  '/api/osint': {
    get: op('List OSINT findings', ['OSINT'], {
      parameters: [...paginationParams, queryParam('electionId', 'Filter by election'), queryParam('source', 'Filter by source'), queryParam('verification', 'Filter by verification status')],
      responses: ok(arrayProp(schema({
        id: prop(''), title: prop(''), source: prop('Source platform'),
        content: prop('Content excerpt'), url: prop('Source URL'),
        credibilityScore: numProp('Credibility score 0-100'),
        verificationStatus: prop('Status: unverified/verified/debunked'),
        electionId: prop(''), collectedAt: prop(''),
      }), 'OSINT findings')),
    }),
    post: op('Submit OSINT finding', ['OSINT'], {
      requestBody: body(schema({
        title: { type: 'string', description: 'Finding title' },
        source: { type: 'string', description: 'Source platform' },
        content: { type: 'string', description: 'Content text' },
        url: { type: 'string', description: 'Source URL' },
        electionId: { type: 'string', description: 'Related election' },
        tags: arrayProp(prop('Tag'), 'Tags'),
      }, ['title', 'source', 'content', 'electionId'])),
      responses: ok(schema({ id: prop(''), title: prop(''), credibilityScore: numProp('') })),
    }),
  },

  '/api/results': {
    get: op('Get election results', ['Elections'], {
      parameters: [queryParam('electionId', 'Election ID', true)],
      responses: ok(schema({
        electionId: prop(''),
        candidates: arrayProp(schema({ name: prop('Candidate name'), party: prop('Party'), votes: numProp('Vote count'), percentage: numProp('Vote percentage') }), 'Candidate results'),
        totalVotes: numProp('Total votes counted'),
        pollingStationsReported: numProp(''),
        pollingStationsTotal: numProp(''),
        lastUpdated: prop('ISO timestamp'),
      })),
    }),
    post: op('Submit results from polling station', ['Elections'], {
      requestBody: body(schema({
        electionId: { type: 'string', description: 'Election ID' },
        pollingStationId: { type: 'string', description: 'Polling station ID' },
        results: arrayProp(schema({ candidateId: prop(''), votes: numProp('Vote count') }), 'Per-candidate vote counts'),
        agentId: { type: 'string', description: 'Submitting agent ID' },
        photoEvidence: arrayProp(prop('Evidence ID'), 'Photo evidence IDs'),
      }, ['electionId', 'pollingStationId', 'results'])),
      responses: ok(schema({ id: prop(''), status: prop('Recorded') })),
    }),
  },

  '/api/pvt': {
    get: op('Get PVT data', ['PVT'], {
      parameters: [queryParam('electionId', 'Election ID', true), ...paginationParams],
      responses: ok(arrayProp(schema({
        id: prop(''), pollingStationId: prop(''),
        officialResults: { type: 'object', description: 'Official results' },
        parallelResults: { type: 'object', description: 'Parallel count results' },
        discrepancy: numProp('Discrepancy percentage'),
        status: prop('Status: matched/discrepancy/pending'),
      }), 'PVT entries')),
    }),
    post: op('Submit PVT count', ['PVT'], {
      requestBody: body(schema({
        electionId: { type: 'string', description: 'Election ID' },
        pollingStationId: { type: 'string', description: 'Polling station ID' },
        results: { type: 'array', description: 'Vote counts per candidate', items: { type: 'object', properties: { candidateId: prop(''), votes: numProp('') } } },
        agentId: { type: 'string', description: 'Agent who counted' },
        notes: { type: 'string', description: 'Observations' },
      }, ['electionId', 'pollingStationId', 'results'])),
      responses: ok(schema({ id: prop(''), status: prop(''), discrepancy: numProp('') })),
    }),
  },

  '/api/flashpoint': {
    get: op('List flashpoints', ['Field Operations'], {
      parameters: [...paginationParams, queryParam('electionId', 'Filter by election'), queryParam('status', 'Filter by status')],
      responses: ok(arrayProp(schema({
        id: prop(''), title: prop(''), description: prop(''),
        severity: prop('Severity: low/medium/high/critical'),
        status: prop('Status: active/monitored/resolved'),
        location: { type: 'object', properties: { lat: numProp(''), lng: numProp(''), radius: numProp('Radius in meters') } },
        electionId: prop(''), detectedAt: prop(''),
      }), 'Flashpoints')),
    }),
    post: op('Report flashpoint', ['Field Operations'], {
      requestBody: body(schema({
        title: { type: 'string', description: 'Flashpoint title' },
        description: { type: 'string', description: 'Description of the situation' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        location: { type: 'object', properties: { lat: numProp(''), lng: numProp(''), radius: numProp('') } },
        electionId: { type: 'string', description: 'Related election' },
      }, ['title', 'severity', 'location', 'electionId'])),
      responses: ok(schema({ id: prop(''), title: prop(''), severity: prop('') })),
    }),
  },

  '/api/honeypot': {
    get: op('List honeypot entries', ['Field Operations'], {
      parameters: [...paginationParams, queryParam('electionId', 'Filter by election'), queryParam('triggered', 'Filter by triggered status')],
      responses: ok(arrayProp(schema({
        id: prop(''), type: prop('Honeypot type'),
        description: prop(''),
        triggered: boolProp('Whether triggered'),
        triggeredAt: prop(''),
        location: { type: 'object', properties: { lat: numProp(''), lng: numProp('') } },
        electionId: prop(''),
      }), 'Honeypot entries')),
    }),
    post: op('Create honeypot', ['Field Operations'], {
      requestBody: body(schema({
        type: { type: 'string', description: 'Honeypot type', enum: ['ballot_box', 'polling_station', 'result_tally', 'voter_roll'] },
        description: { type: 'string', description: 'Description' },
        location: { type: 'object', properties: { lat: numProp(''), lng: numProp('') } },
        electionId: { type: 'string', description: 'Related election' },
      }, ['type', 'location', 'electionId'])),
      responses: ok(schema({ id: prop(''), type: prop(''), status: prop('') })),
    }),
  },

  '/api/engagement': {
    get: op('List engagement records', ['Field Operations'], {
      parameters: [...paginationParams, queryParam('electionId', 'Filter by election'), queryParam('type', 'Filter by engagement type')],
      responses: ok(arrayProp(schema({
        id: prop(''), type: prop('Engagement type'),
        subject: prop(''), description: prop(''),
        status: prop('Status: scheduled/in_progress/completed'),
        participants: arrayProp(prop('Participant ID'), 'Participant IDs'),
        scheduledAt: prop(''), completedAt: prop(''),
      }), 'Engagements')),
    }),
    post: op('Create engagement', ['Field Operations'], {
      requestBody: body(schema({
        type: { type: 'string', description: 'Engagement type' },
        subject: { type: 'string', description: 'Subject' },
        description: { type: 'string', description: 'Description' },
        scheduledAt: { type: 'string', description: 'ISO datetime' },
        electionId: { type: 'string', description: 'Related election' },
      }, ['type', 'subject', 'electionId'])),
      responses: ok(schema({ id: prop(''), type: prop(''), status: prop('') })),
    }),
    patch: op('Update engagement', ['Field Operations'], {
      requestBody: body(schema({
        id: { type: 'string', description: 'Engagement ID' },
        status: { type: 'string', enum: ['scheduled', 'in_progress', 'completed', 'cancelled'] },
        description: { type: 'string', description: 'Updated description' },
      }, ['id'])),
      responses: ok(schema({ id: prop(''), status: prop('') })),
    }),
  },

  '/api/win-probability': {
    get: op('Get win probability analysis', ['Elections'], {
      parameters: [queryParam('electionId', 'Election ID', true)],
      responses: ok(schema({
        electionId: prop(''),
        candidates: arrayProp(schema({ name: prop(''), party: prop(''), winProbability: numProp('Win probability 0-100'), confidence: numProp('Confidence interval'), trend: prop('trend: rising/stable/falling') }), 'Candidate win probabilities'),
        modelInfo: { type: 'object', description: 'Model metadata', properties: { version: prop(''), lastTrained: prop(''), dataPoints: numProp('') } },
      })),
    }),
  },

  '/api/evidence': {
    get: op('List evidence', ['Evidence'], {
      parameters: [...paginationParams, queryParam('incidentId', 'Filter by incident'), queryParam('type', 'Filter by type: photo/video/audio/document')],
      responses: ok(arrayProp(schema({
        id: prop(''), type: prop('Type: photo/video/audio/document'),
        filename: prop(''), url: prop(''),
        description: prop(''),
        incidentId: prop(''), uploadedBy: prop(''),
        chainOfCustody: arrayProp(schema({ action: prop(''), performedBy: prop(''), timestamp: prop('') }), 'Chain of custody'),
        createdAt: prop(''),
      }), 'Evidence items')),
    }),
    post: op('Upload evidence', ['Evidence'], {
      requestBody: body(schema({
        type: { type: 'string', enum: ['photo', 'video', 'audio', 'document'] },
        description: { type: 'string', description: 'Description' },
        incidentId: { type: 'string', description: 'Related incident ID' },
        fileData: { type: 'string', format: 'byte', description: 'Base64-encoded file data' },
        filename: { type: 'string', description: 'Original filename' },
        mimeType: { type: 'string', description: 'MIME type' },
      }, ['type', 'incidentId'])),
      responses: ok(schema({ id: prop(''), type: prop(''), url: prop('') })),
    }),
  },

  '/api/voter-suppression': {
    get: op('List voter suppression incidents', ['Field Operations'], {
      parameters: [...paginationParams, queryParam('electionId', 'Filter by election'), queryParam('status', 'Filter by status')],
      responses: ok(arrayProp(schema({
        id: prop(''), title: prop(''), description: prop(''),
        type: prop('Suppression type'),
        severity: prop('Severity'),
        status: prop('Status: reported/verified/resolved'),
        location: { type: 'object', properties: { lat: numProp(''), lng: numProp(''), address: prop('') } },
        electionId: prop(''), reportedAt: prop(''),
      }), 'Voter suppression incidents')),
    }),
    post: op('Report voter suppression', ['Field Operations'], {
      requestBody: body(schema({
        title: { type: 'string', description: 'Incident title' },
        description: { type: 'string', description: 'Detailed description' },
        type: { type: 'string', description: 'Suppression type', enum: ['intimidation', 'disinformation', 'barrier', 'violence', 'other'] },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        location: { type: 'object', properties: { lat: numProp(''), lng: numProp(''), address: prop('') } },
        electionId: { type: 'string', description: 'Related election' },
      }, ['title', 'type', 'severity', 'location', 'electionId'])),
      responses: ok(schema({ id: prop(''), title: prop(''), status: prop('') })),
    }),
  },

  '/api/campaigns': {
    get: op('List campaigns', ['Campaigns'], {
      parameters: [...paginationParams, queryParam('status', 'Filter by status')],
      responses: ok(arrayProp(schema({
        id: prop(''), name: prop(''), type: prop('Campaign type'),
        status: prop('Status: draft/active/paused/completed'),
        startDate: prop(''), endDate: prop(''),
        stats: { type: 'object', description: 'Campaign statistics', properties: { sent: numProp(''), delivered: numProp(''), opened: numProp(''), responded: numProp('') } },
      }), 'Campaigns')),
    }),
    post: op('Create campaign', ['Campaigns'], {
      requestBody: body(schema({
        name: { type: 'string', description: 'Campaign name' },
        type: { type: 'string', description: 'Campaign type', enum: ['sms', 'email', 'whatsapp', 'push'] },
        message: { type: 'string', description: 'Message template' },
        targetGroup: { type: 'string', description: 'Target audience group' },
        scheduledAt: { type: 'string', description: 'ISO datetime to send' },
      }, ['name', 'type', 'message'])),
      responses: ok(schema({ id: prop(''), name: prop(''), status: prop('') })),
    }),
    put: op('Update campaign', ['Campaigns'], {
      requestBody: body(schema({
        id: { type: 'string', description: 'Campaign ID' },
        name: { type: 'string', description: 'Campaign name' },
        message: { type: 'string', description: 'Message template' },
        status: { type: 'string', enum: ['draft', 'active', 'paused', 'completed'] },
        scheduledAt: { type: 'string', description: 'Scheduled send time' },
      }, ['id'])),
      responses: ok(schema({ id: prop(''), name: prop(''), status: prop('') })),
    }),
    delete: op('Delete campaign', ['Campaigns'], {
      parameters: [queryParam('id', 'Campaign ID', true)],
      responses: noContent(),
    }),
  },

  '/api/campaigns/contacts': {
    get: op('List campaign contacts', ['Campaigns'], {
      parameters: [...paginationParams, queryParam('campaignId', 'Filter by campaign')],
      responses: ok(arrayProp(schema({
        id: prop(''), name: prop(''), phone: prop(''), email: prop(''),
        group: prop('Contact group'), status: prop('Delivery status'),
        lastContacted: prop(''),
      }), 'Campaign contacts')),
    }),
    post: op('Add campaign contacts', ['Campaigns'], {
      requestBody: body(schema({
        contacts: arrayProp(schema({ name: { type: 'string', description: 'Contact name' }, phone: { type: 'string', description: 'Phone number' }, email: { type: 'string', description: 'Email address' }, group: { type: 'string', description: 'Contact group' } }), 'Contacts to add'),
        campaignId: { type: 'string', description: 'Campaign ID' },
      }, ['contacts'])),
      responses: ok(schema({ added: numProp('Number of contacts added'), duplicates: numProp('Number of duplicates skipped') })),
    }),
    delete: op('Remove campaign contact', ['Campaigns'], {
      parameters: [queryParam('id', 'Contact ID', true)],
      responses: noContent(),
    }),
  },

  '/api/geofence': {
    get: op('List geofences', ['Geofence'], {
      parameters: [...paginationParams, queryParam('electionId', 'Filter by election')],
      responses: ok(arrayProp(schema({
        id: prop(''), name: prop(''), type: prop('Type: inclusion/exclusion/restriction'),
        center: { type: 'object', properties: { lat: numProp(''), lng: numProp('') } },
        radius: numProp('Radius in meters'),
        electionId: prop(''), agentCount: numProp('Agents currently inside'),
        isActive: boolProp(''),
      }), 'Geofences')),
    }),
    post: op('Create geofence', ['Geofence'], {
      requestBody: body(schema({
        name: { type: 'string', description: 'Geofence name' },
        type: { type: 'string', enum: ['inclusion', 'exclusion', 'restriction'] },
        center: { type: 'object', properties: { lat: numProp('Latitude'), lng: numProp('Longitude') } },
        radius: { type: 'number', description: 'Radius in meters' },
        electionId: { type: 'string', description: 'Related election' },
      }, ['name', 'type', 'center', 'radius', 'electionId'])),
      responses: ok(schema({ id: prop(''), name: prop(''), type: prop('') })),
    }),
  },

  '/api/chat': {
    get: op('Get chat messages', ['Chat'], {
      parameters: [...paginationParams, queryParam('channel', 'Channel ID'), queryParam('before', 'Messages before this timestamp')],
      responses: ok(arrayProp(schema({
        id: prop(''), channelId: prop(''), userId: prop(''),
        message: prop(''), timestamp: prop(''),
        attachments: arrayProp(prop('Attachment URL'), 'Attachments'),
      }), 'Chat messages')),
    }),
    post: op('Send chat message', ['Chat'], {
      requestBody: body(schema({
        channelId: { type: 'string', description: 'Channel ID' },
        message: { type: 'string', description: 'Message text' },
        attachments: arrayProp(prop('Attachment URL'), 'File attachments'),
        replyTo: { type: 'string', description: 'Message ID to reply to' },
      }, ['channelId', 'message'])),
      responses: ok(schema({ id: prop(''), channelId: prop(''), timestamp: prop('') })),
    }),
  },

  '/api/broadcast': {
    get: op('List broadcasts', ['Chat'], {
      parameters: paginationParams,
      responses: ok(arrayProp(schema({
        id: prop(''), title: prop(''), message: prop(''),
        channel: prop('Target channel'), sentBy: prop(''),
        sentAt: prop(''), recipientCount: numProp(''),
      }), 'Broadcasts')),
    }),
    post: op('Send broadcast', ['Chat'], {
      requestBody: body(schema({
        title: { type: 'string', description: 'Broadcast title' },
        message: { type: 'string', description: 'Broadcast message' },
        channel: { type: 'string', description: 'Target channel or "all"' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
      }, ['title', 'message', 'channel'])),
      responses: ok(schema({ id: prop(''), title: prop(''), recipientCount: numProp('') })),
    }),
  },

  '/api/narrative': {
    get: op('List narratives', ['Security'], {
      parameters: [...paginationParams, queryParam('electionId', 'Filter by election')],
      responses: ok(arrayProp(schema({
        id: prop(''), title: prop(''), type: prop('Narrative type'),
        content: prop('Narrative content'), status: prop('Status: active/countered/neutralized'),
        credibilityScore: numProp(''), reachEstimate: numProp(''),
        createdAt: prop(''), updatedAt: prop(''),
      }), 'Narratives')),
    }),
    post: op('Create narrative entry', ['Security'], {
      requestBody: body(schema({
        title: { type: 'string', description: 'Narrative title' },
        type: { type: 'string', description: 'Narrative type' },
        content: { type: 'string', description: 'Narrative content' },
        electionId: { type: 'string', description: 'Related election' },
        sources: arrayProp(prop('Source URL'), 'Source references'),
      }, ['title', 'type', 'content', 'electionId'])),
      responses: ok(schema({ id: prop(''), title: prop(''), status: prop('') })),
    }),
    patch: op('Update narrative', ['Security'], {
      requestBody: body(schema({
        id: { type: 'string', description: 'Narrative ID' },
        status: { type: 'string', enum: ['active', 'countered', 'neutralized'] },
        content: { type: 'string', description: 'Updated content' },
      }, ['id'])),
      responses: ok(schema({ id: prop(''), status: prop('') })),
    }),
  },

  '/api/audit-logs': {
    get: op('Get audit logs', ['Security'], {
      parameters: [...paginationParams, queryParam('userId', 'Filter by user'), queryParam('action', 'Filter by action type'), queryParam('from', 'Start timestamp'), queryParam('to', 'End timestamp')],
      responses: ok(arrayProp(schema({
        id: prop(''), userId: prop(''), action: prop('Action performed'),
        resource: prop('Resource type'), resourceId: prop(''),
        details: { type: 'object', description: 'Action details', additionalProperties: { type: 'string' } },
        ip: prop('Client IP'), timestamp: prop(''),
      }), 'Audit log entries')),
    }),
  },

  '/api/security': {
    get: op('Get security overview', ['Security'], {
      responses: ok(schema({
        threatLevel: prop('Current threat level'),
        activeThreats: numProp(''),
        recentBreaches: arrayProp(schema({ id: prop(''), type: prop(''), severity: prop(''), detectedAt: prop(''), status: prop('') }), 'Recent security events'),
        securityScore: numProp('Overall security score 0-100'),
      })),
    }),
    post: op('Report security event', ['Security'], {
      requestBody: body(schema({
        type: { type: 'string', description: 'Event type' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        description: { type: 'string', description: 'Event description' },
        sourceIp: { type: 'string', description: 'Source IP if applicable' },
        relatedResource: { type: 'string', description: 'Related resource ID' },
      }, ['type', 'severity', 'description'])),
      responses: ok(schema({ id: prop(''), type: prop(''), status: prop('') })),
    }),
  },

  '/api/situation-room': {
    get: op('Get situation room data', ['SRE'], {
      responses: ok(schema({
        activeElections: arrayProp(schema({ id: prop(''), title: prop(''), status: prop(''), incidentCount: numProp(''), agentCount: numProp('') }), 'Active elections'),
        criticalAlerts: numProp(''),
        systemHealth: { type: 'object', description: 'System health metrics' },
        recentEvents: arrayProp(schema({ type: prop(''), message: prop(''), timestamp: prop('') }), 'Recent events'),
      })),
    }),
  },

  '/api/activity-feed': {
    get: op('Get activity feed', ['Dashboard'], {
      parameters: [queryParam('limit', 'Number of items', false, { type: 'integer', maximum: 50, default: 20 }), queryParam('type', 'Filter by activity type')],
      responses: ok(arrayProp(schema({
        id: prop(''), type: prop('Activity type'),
        message: prop(''), actor: prop(''),
        metadata: { type: 'object', description: 'Additional metadata', additionalProperties: { type: 'string' } },
        timestamp: prop(''),
      }), 'Activity items')),
    }),
  },

  '/api/victory-roadmap': {
    get: op('Get victory roadmap', ['Campaigns'], {
      parameters: [queryParam('electionId', 'Election ID', true)],
      responses: ok(schema({
        electionId: prop(''),
        milestones: arrayProp(schema({ id: prop(''), title: prop(''), description: prop(''), status: prop('Status: pending/in_progress/completed'), targetDate: prop(''), progress: numProp('Progress 0-100') }), 'Milestones'),
        overallProgress: numProp('Overall progress percentage'),
        riskFactors: arrayProp(schema({ factor: prop(''), impact: prop('Impact level'), mitigation: prop('') }), 'Risk factors'),
      })),
    }),
  },

  '/api/export': {
    get: op('Export data', ['Reports'], {
      parameters: [
        queryParam('type', 'Export type', true, { type: 'string', enum: ['elections', 'incidents', 'agents', 'results', 'reports'] }),
        queryParam('format', 'Export format', false, { type: 'string', enum: ['csv', 'json', 'xlsx', 'pdf'] }),
        queryParam('electionId', 'Filter by election'),
        queryParam('from', 'Start date'),
        queryParam('to', 'End date'),
      ],
      responses: { '200': { description: 'Export file', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } } },
    }),
  },

  '/api/tenant-settings': {
    get: op('Get tenant settings', ['Settings'], {
      responses: ok(schema({
        id: prop(''),
        branding: { type: 'object', description: 'Branding settings', properties: { logo: prop(''), primaryColor: prop(''), favicon: prop('') } },
        notifications: { type: 'object', description: 'Notification settings', properties: { emailEnabled: boolProp(''), smsEnabled: boolProp(''), pushEnabled: boolProp('') } },
        features: { type: 'object', description: 'Feature flags', additionalProperties: { type: 'boolean' } },
        security: { type: 'object', description: 'Security settings', properties: { twoFactorRequired: boolProp(''), sessionTimeout: numProp('Minutes'), passwordPolicy: prop('') } },
      })),
    }),
    put: op('Update tenant settings', ['Settings'], {
      requestBody: body(schema({
        branding: { type: 'object', description: 'Branding settings', properties: { logo: prop(''), primaryColor: prop(''), favicon: prop('') } },
        notifications: { type: 'object', description: 'Notification settings', properties: { emailEnabled: boolProp(''), smsEnabled: boolProp(''), pushEnabled: boolProp('') } },
        features: { type: 'object', description: 'Feature flags', additionalProperties: { type: 'boolean' } },
        security: { type: 'object', description: 'Security settings', properties: { twoFactorRequired: boolProp(''), sessionTimeout: numProp('Minutes'), passwordPolicy: prop('') } },
      })),
      responses: ok(schema({ id: prop(''), updated: boolProp('Settings updated') })),
    }),
  },

  '/api/scheduled-reports': {
    get: op('List scheduled reports', ['Reports'], {
      parameters: paginationParams,
      responses: ok(arrayProp(schema({
        id: prop(''), title: prop(''), type: prop(''),
        schedule: prop('Cron expression'),
        lastRun: prop(''), nextRun: prop(''),
        isActive: boolProp(''),
        recipients: arrayProp(prop('Email'), 'Recipient emails'),
      }), 'Scheduled reports')),
    }),
    post: op('Create scheduled report', ['Reports'], {
      requestBody: body(schema({
        title: { type: 'string', description: 'Report title' },
        type: { type: 'string', description: 'Report type' },
        schedule: { type: 'string', description: 'Cron expression' },
        format: { type: 'string', enum: ['pdf', 'xlsx', 'csv'] },
        recipients: arrayProp({ type: 'string', format: 'email' }, 'Recipient emails'),
        filters: { type: 'object', description: 'Report filters', additionalProperties: { type: 'string' } },
      }, ['title', 'type', 'schedule', 'recipients'])),
      responses: ok(schema({ id: prop(''), title: prop(''), schedule: prop('') })),
    }),
    patch: op('Update scheduled report', ['Reports'], {
      requestBody: body(schema({
        id: { type: 'string', description: 'Scheduled report ID' },
        title: { type: 'string', description: 'Report title' },
        schedule: { type: 'string', description: 'Cron expression' },
        isActive: boolProp(''),
        recipients: arrayProp({ type: 'string', format: 'email' }, 'Recipient emails'),
      }, ['id'])),
      responses: ok(schema({ id: prop(''), title: prop(''), schedule: prop('') })),
    }),
    delete: op('Delete scheduled report', ['Reports'], {
      parameters: [queryParam('id', 'Scheduled report ID', true)],
      responses: noContent(),
    }),
  },

  '/api/report-templates': {
    get: op('List report templates', ['Reports'], {
      parameters: paginationParams,
      responses: ok(arrayProp(schema({
        id: prop(''), name: prop(''), description: prop(''),
        type: prop('Template type'),
        sections: arrayProp(prop('Section identifier'), 'Template sections'),
        isDefault: boolProp(''),
      }), 'Report templates')),
    }),
  },

  '/api/campaign-analytics/timeseries': {
    get: op('Get campaign analytics time series', ['Campaigns'], {
      parameters: [
        queryParam('campaignId', 'Campaign ID', true),
        queryParam('metric', 'Metric to plot', false, { type: 'string', enum: ['sent', 'delivered', 'opened', 'clicked', 'responded'] }),
        queryParam('interval', 'Time interval', false, { type: 'string', enum: ['hour', 'day', 'week'] }),
        queryParam('from', 'Start date'),
        queryParam('to', 'End date'),
      ],
      responses: ok(arrayProp(schema({
        timestamp: prop('Bucket timestamp'),
        value: numProp('Metric value'),
      }), 'Time series data points')),
    }),
  },

  '/api/whatsapp': {
    get: op('Get WhatsApp integration status', ['Campaigns'], {
      responses: ok(schema({
        connected: boolProp(''),
        phoneNumber: prop(''),
        messageCount: numProp('Total messages sent'),
        templates: arrayProp(schema({ id: prop(''), name: prop(''), language: prop(''), status: prop('') }), 'Message templates'),
      })),
    }),
    post: op('Send WhatsApp message', ['Campaigns'], {
      requestBody: body(schema({
        to: { type: 'string', description: 'Recipient phone number' },
        templateId: { type: 'string', description: 'Message template ID' },
        parameters: arrayProp(schema({ type: prop('Parameter type'), value: prop('Parameter value') }), 'Template parameters'),
        campaignId: { type: 'string', description: 'Related campaign ID' },
      }, ['to', 'templateId'])),
      responses: ok(schema({ messageId: prop(''), status: prop(''), timestamp: prop('') })),
    }),
    put: op('Update WhatsApp template', ['Campaigns'], {
      requestBody: body(schema({
        id: { type: 'string', description: 'Template ID' },
        name: { type: 'string', description: 'Template name' },
        content: { type: 'string', description: 'Template content' },
        language: { type: 'string', description: 'Language code' },
      }, ['id', 'name', 'content'])),
      responses: ok(schema({ id: prop(''), name: prop(''), status: prop('') })),
    }),
  },

  '/api/sse': {
    get: op('Server-Sent Events stream', ['Monitoring'], {
      description: 'Connect to receive real-time event updates via SSE. The connection stays open and pushes events.',
      responses: streamOk(),
    }),
  },

  '/api/ws-token': {
    post: op('Get WebSocket authentication token', ['Authentication'], {
      requestBody: body(schema({}), []),
      responses: ok(schema({ token: prop('WebSocket auth token'), expiresIn: numProp('Token TTL in seconds', 3600), url: prop('WebSocket endpoint') })),
    }),
  },

  '/api/monitoring/alerts': {
    get: op('List monitoring alerts', ['Monitoring'], {
      parameters: [...paginationParams, queryParam('severity', 'Filter by severity'), queryParam('service', 'Filter by service name')],
      responses: ok(arrayProp(schema({
        id: prop(''), service: prop('Service name'),
        title: prop('Alert title'), message: prop(''),
        severity: prop('Severity: info/warning/error/critical'),
        status: prop('Status: firing/resolved'),
        startedAt: prop(''), resolvedAt: prop(''),
      }), 'Monitoring alerts')),
    }),
    post: op('Create monitoring alert rule', ['Monitoring'], {
      requestBody: body(schema({
        name: { type: 'string', description: 'Alert rule name' },
        service: { type: 'string', description: 'Service to monitor' },
        condition: { type: 'string', description: 'Alert condition expression' },
        threshold: numProp('Threshold value'),
        severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'] },
        notifyChannels: arrayProp(prop('Notification channel'), 'Channels to notify'),
      }, ['name', 'service', 'condition', 'threshold'])),
      responses: ok(schema({ id: prop(''), name: prop(''), status: prop('') })),
    }),
  },

  '/api/campaign-events': {
    get: op('List campaign events', ['Campaigns'], {
      parameters: [...paginationParams, queryParam('campaignId', 'Filter by campaign'), queryParam('type', 'Filter by event type')],
      responses: ok(arrayProp(schema({
        id: prop(''), campaignId: prop(''), type: prop('Event type'),
        title: prop(''), description: prop(''),
        date: prop('Event date'), location: prop(''),
        attendeeCount: numProp(''), status: prop('Status'),
      }), 'Campaign events')),
    }),
    post: op('Create campaign event', ['Campaigns'], {
      requestBody: body(schema({
        campaignId: { type: 'string', description: 'Campaign ID' },
        type: { type: 'string', description: 'Event type' },
        title: { type: 'string', description: 'Event title' },
        description: { type: 'string', description: 'Description' },
        date: { type: 'string', description: 'Event date' },
        location: { type: 'string', description: 'Event location' },
      }, ['campaignId', 'type', 'title', 'date'])),
      responses: ok(schema({ id: prop(''), title: prop(''), status: prop('') })),
    }),
    patch: op('Update campaign event', ['Campaigns'], {
      requestBody: body(schema({
        id: { type: 'string', description: 'Event ID' },
        title: { type: 'string', description: 'Event title' },
        date: { type: 'string', description: 'Event date' },
        status: { type: 'string', enum: ['planned', 'confirmed', 'cancelled', 'completed'] },
      }, ['id'])),
      responses: ok(schema({ id: prop(''), title: prop(''), status: prop('') })),
    }),
    delete: op('Delete campaign event', ['Campaigns'], {
      parameters: [queryParam('id', 'Event ID', true)],
      responses: noContent(),
    }),
  },

  '/api/auth/password': {
    put: op('Change password', ['Authentication'], {
      requestBody: body(schema({
        currentPassword: { type: 'string', format: 'password', description: 'Current password' },
        newPassword: { type: 'string', format: 'password', description: 'New password (min 8 chars)' },
        confirmPassword: { type: 'string', format: 'password', description: 'Confirm new password' },
      }, ['currentPassword', 'newPassword', 'confirmPassword'])),
      responses: ok(schema({ message: prop('Password changed successfully') })),
    }),
  },

  '/api/auth/2fa': {
    get: op('Get 2FA status and setup', ['Authentication'], {
      responses: ok(schema({
        enabled: boolProp('Whether 2FA is enabled'),
        qrCode: prop('Base64 QR code for setup (when not enabled)'),
        backupCodes: arrayProp(prop(''), 'Backup codes (shown once during setup)'),
      })),
    }),
    post: op('Enable 2FA', ['Authentication'], {
      requestBody: body(schema({
        code: { type: 'string', description: '6-digit TOTP code to verify setup' },
      }, ['code'])),
      responses: ok(schema({ enabled: boolProp('true'), backupCodes: arrayProp(prop(''), 'Recovery codes') })),
    }),
    patch: op('Regenerate 2FA backup codes', ['Authentication'], {
      requestBody: body(schema({
        password: { type: 'string', format: 'password', description: 'Current password for verification' },
      }, ['password'])),
      responses: ok(schema({ backupCodes: arrayProp(prop(''), 'New backup codes') })),
    }),
    delete: op('Disable 2FA', ['Authentication'], {
      requestBody: body(schema({
        password: { type: 'string', format: 'password', description: 'Current password for verification' },
      }, ['password'])),
      responses: ok(schema({ enabled: boolProp('false') })),
    }),
  },

  '/api/auth/invite': {
    post: op('Invite a new user', ['Authentication'], {
      requestBody: body(schema({
        email: { type: 'string', format: 'email', description: 'Invitee email' },
        role: { type: 'string', description: 'Role to assign', enum: ['admin', 'analyst', 'agent', 'viewer'] },
        message: { type: 'string', description: 'Personal invitation message' },
      }, ['email', 'role'])),
      responses: ok(schema({ inviteId: prop(''), email: prop(''), expiresAt: prop('') })),
    }),
  },
};

// ─── Full OpenAPI document ─────────────────────────────────────────────────

const spec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'OmniVote Election Monitor API',
    version: '0.2.0',
    description: `Comprehensive REST API for the OmniVote Election Monitoring Platform.\n\nOmniVote provides real-time election monitoring, incident tracking, field agent management,\nparallel vote tabulation (PVT), OSINT analysis, and campaign analytics.\n\n## Authentication\nMost endpoints require a valid session cookie (\`omnivote-session\`). Authenticate via \`POST /api/auth\`\nto obtain a session. For 2FA-enabled accounts, complete the flow with \`POST /api/auth/2fa/verify\`.\n\n## Rate Limiting\nAPI requests are rate-limited. A \`429 Too Many Requests\` response indicates the limit has been exceeded.\n\n## Multi-Tenancy\nThe API supports multi-tenant access. Use the \`X-Tenant-Id\` header or tenant slug in query parameters\nto scope requests to a specific tenant.`,
    contact: {
      name: 'OmniVote API Support',
      email: 'api@omnivote.io',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    { url: '/', description: 'Current server' },
  ],
  tags,
  paths,
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'omnivote-session',
        description: 'Session cookie obtained via POST /api/auth',
      },
    },
  },
};

// ─── Route handler ─────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}