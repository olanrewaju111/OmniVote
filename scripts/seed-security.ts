import { db } from '../src/lib/db';

const TENANTS = [
  { id: 'cmr2itdyq0000pddbrb61v8bm', name: 'Presidential' },
  { id: 'cmr2py7if0024pdh9le57wwis', name: 'Governorship' },
  { id: 'cmr2py7m300bfpdh9cey3iz3m', name: 'Local Gov' },
];

const SECURITY_EVENT_TYPES = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'PERMISSION_CHANGE', 'DATA_EXPORT',
  'ENCRYPTION_EVENT', 'SESSION_EXPIRED', 'SUSPICIOUS_ACTIVITY', 'BRUTE_FORCE',
  'CERT_PINNING', 'API_ABUSE',
];

const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'];

const SECURITY_DESCRIPTIONS: Record<string, string[]> = {
  LOGIN_SUCCESS: [
    'Admin user logged in from 102.89.xx.xx (Lagos)',
    'Analyst logged in via mobile device (Chrome/Android)',
    'Super admin authenticated successfully from VPN endpoint',
  ],
  LOGIN_FAILED: [
    'Failed login attempt for admin@omnivote.ng from 45.33.xx.xx (Unknown)',
    'Multiple failed login attempts detected for field.agent@omnivote.ng',
    'Brute force pattern: 12 failed attempts in 5 minutes from 192.168.1.45',
  ],
  SUSPICIOUS_ACTIVITY: [
    'User accessed 500+ records in under 2 minutes — potential data exfiltration',
    'API rate limit exceeded for /api/incidents (200 req/min from single IP)',
    'Unusual user-agent string detected: "UnknownBot/1.0"',
    'Geolocation mismatch: user logged in from Lagos, then Abuja 30 minutes later',
  ],
  BRUTE_FORCE: [
    'Brute force attack detected on API auth endpoint from 45.33.xx.xx (3 attempts/sec)',
    'Rate-limited: 47 failed login attempts from single IP in 10 minutes',
  ],
  ENCRYPTION_EVENT: [
    'AES-256 encryption key rotated for tenant data store',
    'End-to-end encryption verified for all active WebSocket connections',
    'Database encryption at-rest integrity check passed',
  ],
  SESSION_EXPIRED: [
    'Session expired for field agent FA-014 after 60 minutes of inactivity',
    '5 concurrent sessions detected for admin user — policy violation',
  ],
  PERMISSION_CHANGE: [
    'User role changed: agent FA-007 promoted from FIELD_AGENT to ANALYST',
    'New permission granted: ANALYST user granted access to OSINT module',
    'Admin user revoked TRUST_SAFETY access for user analyst@omnivote.ng',
  ],
  DATA_EXPORT: [
    'Bulk data export initiated: 2,500 incident records downloaded by admin',
    'Audit log export: 30-day compliance report generated',
  ],
  CERT_PINNING: [
    'SSL certificate pinning validation failed for external API endpoint',
    'Certificate renewal reminder: TLS cert expires in 14 days',
  ],
  API_ABUSE: [
    'Excessive polling detected: /api/dashboard called 900 times in 5 minutes',
    'Unauthorized API access attempt: /api/tenants without SUPER_ADMIN role',
  ],
};

const STATES = ['Lagos', 'Abuja FCT', 'Kano', 'Rivers', 'Enugu', 'Borno', 'Oyo', 'Delta', 'Kaduna', 'Anambra'];

async function seedSecurityEvents() {
  console.log('Seeding security events...');

  for (const tenant of TENANTS) {
    const users = await db.user.findMany({
      where: { tenantId: tenant.id },
      select: { id: true },
    });

    const events = [];
    for (let i = 0; i < 40; i++) {
      const type = SECURITY_EVENT_TYPES[Math.floor(Math.random() * SECURITY_EVENT_TYPES.length)];
      const severity = type === 'BRUTE_FORCE' || type === 'LOGIN_FAILED'
        ? Math.random() > 0.4 ? 'CRITICAL' : 'WARNING'
        : type === 'SUSPICIOUS_ACTIVITY' || type === 'API_ABUSE'
        ? Math.random() > 0.5 ? 'WARNING' : 'CRITICAL'
        : Math.random() > 0.7 ? 'WARNING' : 'INFO';

      const descriptions = SECURITY_DESCRIPTIONS[type] || ['Security event recorded'];
      const desc = descriptions[Math.floor(Math.random() * descriptions.length)];
      const hoursAgo = Math.floor(Math.random() * 168); // last 7 days
      const createdAt = new Date(Date.now() - hoursAgo * 3600000);

      const ips = ['102.89.23.45', '45.33.178.90', '192.168.1.100', '10.0.0.55', '172.16.0.12', '41.58.22.110', null, null];
      const userAgents = [
        'Mozilla/5.0 (Linux; Android 13) Chrome/120.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0',
        null,
      ];

      const metadata: Record<string, unknown> = {};
      if (type === 'BRUTE_FORCE') {
        metadata.attemptsPerMinute = Math.floor(Math.random() * 20) + 5;
        metadata.blockedIps = Math.floor(Math.random() * 5) + 1;
      }
      if (type === 'DATA_EXPORT') {
        metadata.recordCount = Math.floor(Math.random() * 10000) + 100;
        metadata.exportFormat = 'CSV';
      }
      if (type === 'SUSPICIOUS_ACTIVITY') {
        metadata.recordsAccessed = Math.floor(Math.random() * 1000) + 50;
        metadata.timeWindow = '2 minutes';
      }

      events.push({
        tenantId: tenant.id,
        userId: Math.random() > 0.3 ? users[Math.floor(Math.random() * users.length)]?.id || null : null,
        eventType: type,
        severity,
        description: desc,
        ipAddress: ips[Math.floor(Math.random() * ips.length)],
        userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
        metadata: JSON.stringify(metadata),
        resolved: severity === 'INFO' ? Math.random() > 0.3 : Math.random() > 0.7,
        resolvedById: null,
        resolvedAt: null,
        createdAt,
      });
    }

    for (const event of events) {
      await db.securityEvent.create({ data: event });
    }

    // Update some user security fields
    for (const user of users) {
      await db.user.update({
        where: { id: user.id },
        data: {
          deviceTrustScore: Math.floor(Math.random() * 40) + 60,
          biometricRiskScore: Math.random() * 0.3,
          lastSecurityAuditAt: new Date(Date.now() - Math.floor(Math.random() * 72) * 3600000),
        },
      });
    }
  }
  console.log('  Created security events');
}

async function seedGeofences() {
  console.log('Seeding geofence zones...');

  const zoneData = [
    { name: 'Lagos Island PU Cluster', state: 'Lagos', lga: 'Lagos Island', lat: 6.4541, lng: 3.3947, radius: 800, agents: 5, interval: 30 },
    { name: 'Abuja Central Zone', state: 'Abuja FCT', lga: 'Abuja Municipal', lat: 9.0579, lng: 7.4951, radius: 1200, agents: 8, interval: 45 },
    { name: 'Kano Metro Monitoring', state: 'Kano', lga: 'Kano Municipal', lat: 12.0022, lng: 8.5920, radius: 1000, agents: 6, interval: 60 },
    { name: 'Rivers State Port Harcourt', state: 'Rivers', lga: 'Port Harcourt', lat: 4.8156, lng: 7.0498, radius: 900, agents: 4, interval: 45 },
    { name: 'Enugu Urban Zone', state: 'Enugu', lga: 'Enugu North', lat: 6.4424, lng: 7.5012, radius: 700, agents: 3, interval: 30 },
  ];

  for (const tenant of TENANTS) {
    const agents = await db.user.findMany({
      where: { tenantId: tenant.id, role: 'FIELD_AGENT' },
      select: { id: true },
    });

    for (const zd of zoneData) {
      const assignedIds = agents.slice(0, Math.min(zd.agents, agents.length)).map(a => a.id);

      // Create geofence zone
      const zone = await db.geofenceZone.create({
        data: {
          tenantId: tenant.id,
          name: zd.name,
          state: zd.state,
          lga: zd.lga,
          centerLat: zd.lat,
          centerLng: zd.lng,
          radiusMeters: zd.radius,
          pollingUnitIds: JSON.stringify([]),
          assignedAgentIds: JSON.stringify(assignedIds),
          isActive: Math.random() > 0.2,
          checkInIntervalMin: zd.interval,
          maxMissedCheckIns: 3,
        },
      });

      // Create check-ins for assigned agents
      for (const agentId of assignedIds) {
        const hoursAgo = Math.floor(Math.random() * 12);
        const latOffset = (Math.random() - 0.5) * 0.02;
        const lngOffset = (Math.random() - 0.5) * 0.02;
        const isInside = Math.random() > 0.15;

        await db.agentCheckIn.create({
          data: {
            tenantId: tenant.id,
            agentId,
            geofenceZoneId: zone.id,
            status: isInside ? 'CHECKED_IN' : 'CHECKED_OUT',
            latitude: zd.lat + latOffset,
            longitude: zd.lng + lngOffset,
            isInsideZone: isInside,
            batteryLevel: Math.floor(Math.random() * 60) + 20,
            networkType: ['WIFI', '4G', '3G'][Math.floor(Math.random() * 3)],
            accuracyMeters: Math.floor(Math.random() * 50) + 5,
            checkedInAt: new Date(Date.now() - hoursAgo * 3600000),
            checkedOutAt: !isInside ? new Date(Date.now() - (hoursAgo - 1) * 3600000) : null,
          },
        });
      }

      // Create dead-man's switches for some agents
      for (let i = 0; i < Math.min(3, assignedIds.length); i++) {
        const agentId = assignedIds[i];
        const missed = Math.floor(Math.random() * 3);
        const escalation = missed >= 3 ? 3 : missed >= 2 ? 2 : missed >= 1 ? 1 : 0;
        const deadlineOffset = Math.random() > 0.4 ? -1 : 1; // negative = overdue
        const minutesUntil = Math.floor(Math.random() * 120) + 10;

        await db.deadMansSwitch.create({
          data: {
            tenantId: tenant.id,
            agentId,
            geofenceZoneId: zone.id,
            isActive: Math.random() > 0.2,
            checkInDeadline: new Date(Date.now() + deadlineOffset * minutesUntil * 60000),
            lastCheckInAt: new Date(Date.now() - Math.floor(Math.random() * 4) * 3600000),
            missedCheckIns: missed,
            escalationLevel: escalation,
            autoSOSTriggered: escalation >= 3,
          },
        });
      }
    }
  }
  console.log('  Created geofence zones, check-ins, and dead-man switches');
}

async function main() {
  console.log('=== Seeding Security, Geofencing & Offline-First Modules ===\n');
  await seedSecurityEvents();
  await seedGeofences();
  console.log('\n=== All new modules seeded successfully ===');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));