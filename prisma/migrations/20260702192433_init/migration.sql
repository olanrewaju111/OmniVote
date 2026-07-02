-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#10b981',
    "domain" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "mapBounds" TEXT NOT NULL DEFAULT 'null',
    "whatsappPhone" TEXT,
    "whatsappJid" TEXT,
    "whatsappStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "whatsappConnectedAt" DATETIME,
    "encryptionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sessionTimeoutMin" INTEGER NOT NULL DEFAULT 60,
    "ipWhitelist" TEXT NOT NULL DEFAULT '[]',
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "auditLogRetentionDays" INTEGER NOT NULL DEFAULT 730
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'FIELD_AGENT',
    "tenantId" TEXT NOT NULL,
    "phone" TEXT,
    "whatsappJid" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" DATETIME,
    "deviceFingerprint" TEXT,
    "deviceTrustScore" REAL NOT NULL DEFAULT 100,
    "lastSecurityAuditAt" DATETIME,
    "twoFactorSecret" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" DATETIME,
    "lockedReason" TEXT,
    "biometricProfile" TEXT,
    "biometricRiskScore" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Election" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'LOCAL',
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Election_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PollingUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "electionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lga" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "registeredVoters" INTEGER NOT NULL DEFAULT 0,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "turnout" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PollingUnit_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ElectionResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "pollingUnitId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "accreditedVoters" INTEGER NOT NULL DEFAULT 0,
    "totalValidVotes" INTEGER NOT NULL DEFAULT 0,
    "rejectedBallots" INTEGER NOT NULL DEFAULT 0,
    "totalVotesCast" INTEGER NOT NULL DEFAULT 0,
    "partyResults" TEXT NOT NULL DEFAULT '[]',
    "bvasUsed" BOOLEAN NOT NULL DEFAULT true,
    "materialsArrivedOnTime" BOOLEAN NOT NULL DEFAULT true,
    "securityPresent" BOOLEAN NOT NULL DEFAULT true,
    "violenceOccurred" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ElectionResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ElectionResult_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ElectionResult_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "pollingUnitId" TEXT,
    "reportedById" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OBSERVATION',
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "mediaUrls" TEXT NOT NULL DEFAULT '[]',
    "gpsLatitude" REAL,
    "gpsLongitude" REAL,
    "gpsAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "aiSummary" TEXT,
    "aiFlags" TEXT NOT NULL DEFAULT '[]',
    "isQuarantined" BOOLEAN NOT NULL DEFAULT false,
    "c2paVerified" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedById" TEXT,
    CONSTRAINT "Incident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Incident_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "category" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Alert_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sentById" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveredAt" DATETIME,
    "readAt" DATETIME,
    "responseText" TEXT,
    "respondedAt" DATETIME,
    "whatsappMessageId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentMessage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentMessage_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OsintPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorFollowers" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "mediaUrls" TEXT NOT NULL DEFAULT '[]',
    "url" TEXT,
    "sentiment" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isFakeNews" BOOLEAN NOT NULL DEFAULT false,
    "isBotSuspect" BOOLEAN NOT NULL DEFAULT false,
    "cibScore" REAL NOT NULL DEFAULT 0,
    "aiSummary" TEXT,
    "aiFlags" TEXT NOT NULL DEFAULT '[]',
    "viralityScore" REAL NOT NULL DEFAULT 0,
    "engagement" TEXT NOT NULL DEFAULT '{}',
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "location" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "publishedAt" DATETIME NOT NULL,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedById" TEXT,
    CONSTRAINT "OsintPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "totalUploaded" INTEGER NOT NULL DEFAULT 0,
    "optedOutCount" INTEGER NOT NULL DEFAULT 0,
    "hashAlgorithm" TEXT NOT NULL DEFAULT 'SHA256',
    "consentVerified" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContactList_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateBody" TEXT NOT NULL,
    "templateStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "contactListId" TEXT,
    "segment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "scheduledAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 1000,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "optOutCount" INTEGER NOT NULL DEFAULT 0,
    "consentEnforced" BOOLEAN NOT NULL DEFAULT true,
    "wabaCompliant" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Campaign_contactListId_fkey" FOREIGN KEY ("contactListId") REFERENCES "ContactList" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "readAt" DATETIME,
    "failedReason" TEXT,
    "optOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "party" TEXT,
    "state" TEXT NOT NULL,
    "lga" TEXT,
    "venue" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "estimatedCrowd" INTEGER,
    "reportedById" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "mediaUrls" TEXT NOT NULL DEFAULT '[]',
    "aiFlags" TEXT NOT NULL DEFAULT '[]',
    "incidentCount" INTEGER NOT NULL DEFAULT 0,
    "eventDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoterSuppressionReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lga" TEXT,
    "source" TEXT NOT NULL DEFAULT 'FIELD',
    "platform" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isDisinformation" BOOLEAN NOT NULL DEFAULT false,
    "affectedArea" TEXT,
    "affectedVoters" INTEGER,
    "evidenceUrls" TEXT NOT NULL DEFAULT '[]',
    "counterMeasure" TEXT,
    "aiAnalysis" TEXT,
    "reportedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoterSuppressionReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "description" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecurityEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeofenceZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lga" TEXT,
    "centerLat" REAL NOT NULL,
    "centerLng" REAL NOT NULL,
    "radiusMeters" REAL NOT NULL,
    "pollingUnitIds" TEXT NOT NULL DEFAULT '[]',
    "assignedAgentIds" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "checkInIntervalMin" INTEGER NOT NULL DEFAULT 60,
    "maxMissedCheckIns" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeofenceZone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentCheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "geofenceZoneId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CHECKED_IN',
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "isInsideZone" BOOLEAN NOT NULL,
    "batteryLevel" INTEGER,
    "networkType" TEXT,
    "accuracyMeters" REAL,
    "notes" TEXT,
    "checkedInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" DATETIME,
    CONSTRAINT "AgentCheckIn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentCheckIn_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeadMansSwitch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "geofenceZoneId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "checkInDeadline" DATETIME NOT NULL,
    "lastCheckInAt" DATETIME,
    "missedCheckIns" INTEGER NOT NULL DEFAULT 0,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "autoSOSTriggered" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    "resolvedNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeadMansSwitch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeadMansSwitch_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PvtSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "pollingUnitId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "partyResults" TEXT NOT NULL DEFAULT '[]',
    "accreditedVoters" INTEGER NOT NULL DEFAULT 0,
    "totalValidVotes" INTEGER NOT NULL DEFAULT 0,
    "rejectedBallots" INTEGER NOT NULL DEFAULT 0,
    "totalVotesCast" INTEGER NOT NULL DEFAULT 0,
    "bvasSerialNumber" TEXT,
    "photoUrl" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MOBILE',
    "verificationHash" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    CONSTRAINT "PvtSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PvtSubmission_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResultComparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "pollingUnitId" TEXT NOT NULL,
    "pvtSubmissionId" TEXT,
    "officialResultId" TEXT,
    "partyDeltas" TEXT NOT NULL DEFAULT '[]',
    "totalPvtVotes" INTEGER NOT NULL DEFAULT 0,
    "totalOfficialVotes" INTEGER NOT NULL DEFAULT 0,
    "totalDelta" INTEGER NOT NULL DEFAULT 0,
    "deltaPct" REAL NOT NULL DEFAULT 0,
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "anomalyReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResultComparison_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultComparison_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceDossier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "evidenceItems" TEXT NOT NULL DEFAULT '[]',
    "c2paSigned" BOOLEAN NOT NULL DEFAULT false,
    "c2paSignature" TEXT,
    "aiSummary" TEXT,
    "aiConfidence" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvidenceDossier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StegoScanResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "evidenceDossierId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "fileUrl" TEXT,
    "isManipulated" BOOLEAN NOT NULL DEFAULT false,
    "manipulationType" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0,
    "elaScore" REAL,
    "noiseAnalysis" TEXT,
    "metadataDiff" TEXT,
    "scanDurationMs" INTEGER NOT NULL DEFAULT 0,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StegoScanResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HoneypotUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "pollingUnitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lga" TEXT,
    "isDecoy" BOOLEAN NOT NULL DEFAULT true,
    "trapType" TEXT NOT NULL DEFAULT 'GHOST_UNIT',
    "expectedResults" TEXT NOT NULL DEFAULT '[]',
    "officialResults" TEXT NOT NULL DEFAULT '[]',
    "deviationDetected" BOOLEAN NOT NULL DEFAULT false,
    "deviationPct" REAL NOT NULL DEFAULT 0,
    "alertTriggered" BOOLEAN NOT NULL DEFAULT false,
    "alertId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HoneypotUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HoneypotUnit_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FlashpointForecast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lga" TEXT,
    "riskScores" TEXT NOT NULL DEFAULT '{}',
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "forecast" TEXT NOT NULL DEFAULT '[]',
    "contributingFactors" TEXT NOT NULL DEFAULT '[]',
    "aiModel" TEXT NOT NULL DEFAULT 'ensemble_v2',
    "confidence" REAL NOT NULL DEFAULT 0,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "FlashpointForecast_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WargameScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parameters" TEXT NOT NULL DEFAULT '{}',
    "steps" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentPlayerRole" TEXT,
    "results" TEXT,
    "score" INTEGER,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WargameScenario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessibilityReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "pollingUnitId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "features" TEXT NOT NULL DEFAULT '{}',
    "barrierTypes" TEXT NOT NULL DEFAULT '[]',
    "pwdVotersServed" INTEGER NOT NULL DEFAULT 0,
    "pwdVotersTurnedAway" INTEGER NOT NULL DEFAULT 0,
    "overallScore" REAL NOT NULL DEFAULT 0,
    "photoUrl" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessibilityReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccessibilityReport_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "OsintPost_tenantId_platform_idx" ON "OsintPost"("tenantId", "platform");

-- CreateIndex
CREATE INDEX "OsintPost_tenantId_category_idx" ON "OsintPost"("tenantId", "category");

-- CreateIndex
CREATE INDEX "OsintPost_tenantId_publishedAt_idx" ON "OsintPost"("tenantId", "publishedAt");

-- CreateIndex
CREATE INDEX "CampaignMessage_tenantId_campaignId_idx" ON "CampaignMessage"("tenantId", "campaignId");

-- CreateIndex
CREATE INDEX "CampaignMessage_tenantId_status_idx" ON "CampaignMessage"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CampaignEvent_tenantId_eventType_idx" ON "CampaignEvent"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "CampaignEvent_tenantId_state_idx" ON "CampaignEvent"("tenantId", "state");

-- CreateIndex
CREATE INDEX "VoterSuppressionReport_tenantId_reportType_idx" ON "VoterSuppressionReport"("tenantId", "reportType");

-- CreateIndex
CREATE INDEX "VoterSuppressionReport_tenantId_state_idx" ON "VoterSuppressionReport"("tenantId", "state");

-- CreateIndex
CREATE INDEX "VoterSuppressionReport_tenantId_status_idx" ON "VoterSuppressionReport"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SecurityEvent_tenantId_eventType_idx" ON "SecurityEvent"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "SecurityEvent_tenantId_severity_idx" ON "SecurityEvent"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "SecurityEvent_tenantId_createdAt_idx" ON "SecurityEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "GeofenceZone_tenantId_isActive_idx" ON "GeofenceZone"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "AgentCheckIn_tenantId_agentId_idx" ON "AgentCheckIn"("tenantId", "agentId");

-- CreateIndex
CREATE INDEX "AgentCheckIn_tenantId_status_idx" ON "AgentCheckIn"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AgentCheckIn_tenantId_checkedInAt_idx" ON "AgentCheckIn"("tenantId", "checkedInAt");

-- CreateIndex
CREATE INDEX "DeadMansSwitch_tenantId_isActive_idx" ON "DeadMansSwitch"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "DeadMansSwitch_tenantId_escalationLevel_idx" ON "DeadMansSwitch"("tenantId", "escalationLevel");

-- CreateIndex
CREATE INDEX "PvtSubmission_tenantId_electionId_idx" ON "PvtSubmission"("tenantId", "electionId");

-- CreateIndex
CREATE INDEX "PvtSubmission_tenantId_pollingUnitId_idx" ON "PvtSubmission"("tenantId", "pollingUnitId");

-- CreateIndex
CREATE INDEX "PvtSubmission_tenantId_submittedAt_idx" ON "PvtSubmission"("tenantId", "submittedAt");

-- CreateIndex
CREATE INDEX "ResultComparison_tenantId_electionId_idx" ON "ResultComparison"("tenantId", "electionId");

-- CreateIndex
CREATE INDEX "ResultComparison_tenantId_isAnomaly_idx" ON "ResultComparison"("tenantId", "isAnomaly");

-- CreateIndex
CREATE INDEX "EvidenceDossier_tenantId_status_idx" ON "EvidenceDossier"("tenantId", "status");

-- CreateIndex
CREATE INDEX "EvidenceDossier_tenantId_createdAt_idx" ON "EvidenceDossier"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "StegoScanResult_tenantId_isManipulated_idx" ON "StegoScanResult"("tenantId", "isManipulated");

-- CreateIndex
CREATE INDEX "HoneypotUnit_tenantId_isActive_idx" ON "HoneypotUnit"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "HoneypotUnit_tenantId_deviationDetected_idx" ON "HoneypotUnit"("tenantId", "deviationDetected");

-- CreateIndex
CREATE INDEX "FlashpointForecast_tenantId_state_idx" ON "FlashpointForecast"("tenantId", "state");

-- CreateIndex
CREATE INDEX "FlashpointForecast_tenantId_riskLevel_idx" ON "FlashpointForecast"("tenantId", "riskLevel");

-- CreateIndex
CREATE INDEX "WargameScenario_tenantId_status_idx" ON "WargameScenario"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AccessibilityReport_tenantId_pollingUnitId_idx" ON "AccessibilityReport"("tenantId", "pollingUnitId");

-- CreateIndex
CREATE INDEX "AccessibilityReport_tenantId_overallScore_idx" ON "AccessibilityReport"("tenantId", "overallScore");
