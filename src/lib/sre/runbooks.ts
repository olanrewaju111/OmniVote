/**
 * Runbook Library — Phase 12
 *
 * Automated runbook responses for common incidents.
 * Each runbook has an ID, severity, and step-by-step actions.
 * These correspond to the RB-001 through RB-008 runbooks from the SRE guide.
 */

export interface RunbookStep {
  order: number;
  action: string;
  command?: string;
  expectedOutcome: string;
  escalation?: string;
}

export interface Runbook {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  triggerCondition: string;
  steps: RunbookStep[];
  estimatedRecoveryTime: string;
  lastUpdated: string;
}

export const RUNBOOKS: Runbook[] = [
  {
    id: 'RB-001',
    title: 'Bun/Node Process Crash',
    severity: 'critical',
    description: 'The Next.js application process has crashed or become unresponsive.',
    triggerCondition: 'Health check fails for >60s OR process not found',
    estimatedRecoveryTime: '30s - 2min',
    lastUpdated: '2026-08-19',
    steps: [
      {
        order: 1,
        action: 'Check process status',
        command: 'docker ps | grep omnivote-app',
        expectedOutcome: 'Container status shows restarting or exited',
      },
      {
        order: 2,
        action: 'Check crash logs for root cause',
        command: 'docker logs omnivote-app --tail 100',
        expectedOutcome: 'Identify OOM, unhandled exception, or signal',
        escalation: 'If recurring crash pattern, escalate to engineering',
      },
      {
        order: 3,
        action: 'Restart the application container',
        command: 'docker compose restart app',
        expectedOutcome: 'Container restarts and health check passes within 15s',
      },
      {
        order: 4,
        action: 'Verify health endpoint responds',
        command: 'curl -s http://localhost:3000/api/health | head -1',
        expectedOutcome: '{"status":"healthy",...}',
      },
      {
        order: 5,
        action: 'Check SLO dashboard for error budget impact',
        command: 'curl -s http://localhost:3000/api/slo | jq .deploymentFreeze',
        expectedOutcome: 'Confirm error budget not exhausted',
        escalation: 'If budget < 50%, initiate deployment freeze',
      },
    ],
  },
  {
    id: 'RB-002',
    title: 'Database Connection Exhaustion',
    severity: 'high',
    description: 'Database connection pool is saturated, causing request timeouts.',
    triggerCondition: 'p95 latency > 3s for 5min OR 5xx rate > 5%',
    estimatedRecoveryTime: '1 - 5min',
    lastUpdated: '2026-08-19',
    steps: [
      {
        order: 1,
        action: 'Check connection pool utilization',
        command: 'docker exec omnivote-app sh -c "cat /proc/$(pgrep -f node)/fd 2>/dev/null | wc -l"',
        expectedOutcome: 'Identify if connection count is at limit',
      },
      {
        order: 2,
        action: 'Check for slow queries',
        command: 'docker logs omnivote-app --tail 200 | grep -i "slow\|timeout"',
        expectedOutcome: 'Identify slow query patterns',
      },
      {
        order: 3,
        action: 'Restart application to release stale connections',
        command: 'docker compose restart app',
        expectedOutcome: 'Connections released, pool utilization returns to normal',
      },
      {
        order: 4,
        action: 'Increase pool size if recurring',
        command: 'Set DATABASE_POOL_SIZE env var (default: 10, increase to 20-50)',
        expectedOutcome: 'Fewer connection exhaustion events',
        escalation: 'If pool increase does not help, investigate query optimization',
      },
    ],
  },
  {
    id: 'RB-003',
    title: 'High Memory Usage',
    severity: 'high',
    description: 'Application memory usage exceeds 85% of allocated limit.',
    triggerCondition: 'Memory > 85% sustained for 5min',
    estimatedRecoveryTime: '2 - 10min',
    lastUpdated: '2026-08-19',
    steps: [
      {
        order: 1,
        action: 'Check container memory usage',
        command: 'docker stats omnivote-app --no-stream',
        expectedOutcome: 'See current memory usage vs limit',
      },
      {
        order: 2,
        action: 'Check if this is a leak (growing over time) or spike',
        command: 'docker logs omnivote-app --since 30m | grep -c "GC\|heap"',
        expectedOutcome: 'Determine pattern: leak vs spike',
      },
      {
        order: 3,
        action: 'If leak suspected, restart process to reset memory',
        command: 'docker compose restart app',
        expectedOutcome: 'Memory returns to baseline',
        escalation: 'If memory grows again quickly, escalate for heap profiling',
      },
      {
        order: 4,
        action: 'If spike, identify the workload that caused it',
        command: 'Check /api/metrics for route with highest latency',
        expectedOutcome: 'Identify offending endpoint',
      },
    ],
  },
  {
    id: 'RB-004',
    title: 'Disk Full',
    severity: 'medium',
    description: 'Disk usage exceeds 80%, risking write failures and data loss.',
    triggerCondition: 'Disk usage > 80%',
    estimatedRecoveryTime: '5 - 30min',
    lastUpdated: '2026-08-19',
    steps: [
      {
        order: 1,
        action: 'Identify largest disk consumers',
        command: 'docker exec omnivote-app du -sh /app/data/* 2>/dev/null | sort -rh | head -10',
        expectedOutcome: 'See what is consuming disk space',
      },
      {
        order: 2,
        action: 'Clean up old log files (>7 days)',
        command: 'find /var/log -name "*.log" -mtime +7 -delete',
        expectedOutcome: 'Reclaimed space from old logs',
      },
      {
        order: 3,
        action: 'Clear temp files',
        command: 'docker exec omnivote-app sh -c "rm -rf /tmp/omnivote-* 2>/dev/null"',
        expectedOutcome: 'Temp files cleared',
      },
      {
        order: 4,
        action: 'Run SQLite VACUUM if database is the consumer (maintenance window only)',
        command: 'docker exec omnivote-app npx prisma db execute --stdin <<< "VACUUM;"',
        expectedOutcome: 'Database file size reduced',
        escalation: 'If disk is still >80%, expand the volume',
      },
    ],
  },
  {
    id: 'RB-005',
    title: 'DDoS Attack',
    severity: 'critical',
    description: 'Distributed denial of service attack detected.',
    triggerCondition: 'Request rate > 10x baseline for 5min OR all from few IPs',
    estimatedRecoveryTime: '5 - 30min',
    lastUpdated: '2026-08-19',
    steps: [
      {
        order: 1,
        action: 'Verify attack pattern (traffic spike from distributed sources)',
        command: 'docker logs omnivote-nginx --tail 500 | awk "{print \$1}" | sort | uniq -c | sort -rn | head -20',
        expectedOutcome: 'See top IPs by request count',
      },
      {
        order: 2,
        action: 'Enable rate limiting at Nginx level',
        command: 'nginx -s reload (after updating nginx/conf.d/rate-limit.conf)',
        expectedOutcome: 'Rate limiting active, excessive requests dropped',
      },
      {
        order: 3,
        action: 'Block offending IP ranges in Nginx',
        command: 'Add deny directives to nginx/conf.d/blocklist.conf && nginx -s reload',
        expectedOutcome: 'Blocked IPs receive 403',
      },
      {
        order: 4,
        action: 'Enable geographic blocking for non-operational regions',
        command: 'Update nginx geo block with allowed country codes',
        expectedOutcome: 'Requests from non-operational countries blocked',
        escalation: 'If attack persists > 30min, contact CDN provider for DDoS mitigation',
      },
    ],
  },
  {
    id: 'RB-006',
    title: 'Certificate Expired',
    severity: 'medium',
    description: 'TLS certificate has expired or is about to expire.',
    triggerCondition: 'Certificate < 14 days to expiry OR TLS handshake failure',
    estimatedRecoveryTime: '1 - 5min',
    lastUpdated: '2026-08-19',
    steps: [
      {
        order: 1,
        action: 'Check certificate expiry',
        command: 'echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -dates',
        expectedOutcome: 'See notBefore and notAfter dates',
      },
      {
        order: 2,
        action: 'Force certificate renewal via Caddy',
        command: 'caddy reload --config /path/to/Caddyfile',
        expectedOutcome: 'New certificate obtained and served',
      },
      {
        order: 3,
        action: 'Verify new certificate is served',
        command: 'openssl s_client -connect localhost:443 </dev/null 2>/dev/null | openssl x509 -noout -subject -dates',
        expectedOutcome: 'New certificate with future expiry date',
      },
      {
        order: 4,
        action: 'Post-incident: add certificate expiry monitoring (14-day warning)',
        command: 'Set up cron job or monitoring alert for cert expiry',
        expectedOutcome: 'Future expirations caught proactively',
      },
    ],
  },
  {
    id: 'RB-007',
    title: 'Agent Mass Disconnect',
    severity: 'critical',
    description: 'All or most field agents appear to disconnect simultaneously.',
    triggerCondition: 'Active WebSocket connections drop > 50% in 5min',
    estimatedRecoveryTime: '2 - 15min',
    lastUpdated: '2026-08-19',
    steps: [
      {
        order: 1,
        action: 'Verify it is not a false positive (check monitoring for actual drops)',
        command: 'curl -s http://localhost:3000/api/health | jq .websocket',
        expectedOutcome: 'Confirm WebSocket connection count',
      },
      {
        order: 2,
        action: 'Check server-side WebSocket infrastructure',
        command: 'docker logs omnivote-app --tail 100 | grep -i "websocket\|ws\|disconnect"',
        expectedOutcome: 'Identify server-side WS issues',
      },
      {
        order: 3,
        action: 'Check network connectivity from server',
        command: 'ping -c 3 8.8.8.8 && curl -s -o /dev/null -w "%{http_code}" https://api.whatsapp.com',
        expectedOutcome: 'Network is reachable',
      },
      {
        order: 4,
        action: 'If server-side issue, restart WebSocket service',
        command: 'docker compose restart app',
        expectedOutcome: 'WebSocket connections re-established',
        escalation: 'If network issue, contact infrastructure provider immediately',
      },
    ],
  },
  {
    id: 'RB-008',
    title: "Dead-Man's Switch False Positive",
    severity: 'critical',
    description: "A dead-man's switch has been triggered — verify agent safety FIRST.",
    triggerCondition: "Any dead-man's switch escalation",
    estimatedRecoveryTime: '5 - 30min',
    lastUpdated: '2026-08-19',
    steps: [
      {
        order: 1,
        action: 'VERIFY AGENT SAFETY FIRST — contact the agent via phone immediately',
        command: 'N/A — Human action required: Call the agent directly',
        expectedOutcome: 'Agent confirms safety',
        escalation: 'If agent cannot be reached within 5 min, escalate to operations commander',
      },
      {
        order: 2,
        action: 'Once safety confirmed, investigate technical cause',
        command: 'Check agent last check-in time, device status, battery level',
        expectedOutcome: 'Identify if app crash, network issue, or dead battery',
      },
      {
        order: 3,
        action: 'Resolve the switch in the system',
        command: 'Update DeadMansSwitch record to resolved with cause',
        expectedOutcome: 'Switch resolved, alerts cleared',
      },
      {
        order: 4,
        action: 'Document the false positive for future tuning',
        command: 'Create incident record with root cause analysis',
        expectedOutcome: 'Switch sensitivity parameters adjusted for future',
      },
    ],
  },
];

/**
 * Find a runbook by ID.
 */
export function getRunbook(id: string): Runbook | undefined {
  return RUNBOOKS.find(rb => rb.id === id);
}

/**
 * Get runbooks filtered by severity.
 */
export function getRunbooksBySeverity(severity: Runbook['severity']): Runbook[] {
  return RUNBOOKS.filter(rb => rb.severity === severity);
}
