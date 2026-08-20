-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KeyMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'LEADING',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KeyMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NarrativeTimeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'MILESTONE',
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NarrativeTimeline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduledReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "schedule" TEXT NOT NULL DEFAULT 'HOURLY',
    "format" TEXT NOT NULL DEFAULT 'PDF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "filters" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "ScheduledReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Election" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'LOCAL',
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Election_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Election" ("createdAt", "date", "id", "status", "tenantId", "tier", "title", "updatedAt") SELECT "createdAt", "date", "id", "status", "tenantId", "tier", "title", "updatedAt" FROM "Election";
DROP TABLE "Election";
ALTER TABLE "new_Election" RENAME TO "Election";
CREATE TABLE "new_ElectionResult" (
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
    CONSTRAINT "ElectionResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElectionResult_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElectionResult_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ElectionResult" ("accreditedVoters", "bvasUsed", "id", "materialsArrivedOnTime", "notes", "partyResults", "pollingUnitId", "rejectedBallots", "reportedById", "securityPresent", "submittedAt", "tenantId", "totalValidVotes", "totalVotesCast", "updatedAt", "verified", "verifiedById", "violenceOccurred") SELECT "accreditedVoters", "bvasUsed", "id", "materialsArrivedOnTime", "notes", "partyResults", "pollingUnitId", "rejectedBallots", "reportedById", "securityPresent", "submittedAt", "tenantId", "totalValidVotes", "totalVotesCast", "updatedAt", "verified", "verifiedById", "violenceOccurred" FROM "ElectionResult";
DROP TABLE "ElectionResult";
ALTER TABLE "new_ElectionResult" RENAME TO "ElectionResult";
CREATE UNIQUE INDEX "ElectionResult_pollingUnitId_reportedById_key" ON "ElectionResult"("pollingUnitId", "reportedById");
CREATE TABLE "new_PollingUnit" (
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
    CONSTRAINT "PollingUnit_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PollingUnit" ("code", "createdAt", "electionId", "id", "latitude", "lga", "longitude", "name", "registeredVoters", "state", "status", "totalVotes", "turnout", "updatedAt", "ward") SELECT "code", "createdAt", "electionId", "id", "latitude", "lga", "longitude", "name", "registeredVoters", "state", "status", "totalVotes", "turnout", "updatedAt", "ward" FROM "PollingUnit";
DROP TABLE "PollingUnit";
ALTER TABLE "new_PollingUnit" RENAME TO "PollingUnit";
CREATE TABLE "new_PvtSubmission" (
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
    CONSTRAINT "PvtSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PvtSubmission_pollingUnitId_fkey" FOREIGN KEY ("pollingUnitId") REFERENCES "PollingUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PvtSubmission" ("accreditedVoters", "bvasSerialNumber", "electionId", "id", "isVerified", "partyResults", "photoUrl", "pollingUnitId", "rejectedBallots", "source", "submittedAt", "submittedById", "tenantId", "totalValidVotes", "totalVotesCast", "verificationHash", "verifiedAt", "verifiedById") SELECT "accreditedVoters", "bvasSerialNumber", "electionId", "id", "isVerified", "partyResults", "photoUrl", "pollingUnitId", "rejectedBallots", "source", "submittedAt", "submittedById", "tenantId", "totalValidVotes", "totalVotesCast", "verificationHash", "verifiedAt", "verifiedById" FROM "PvtSubmission";
DROP TABLE "PvtSubmission";
ALTER TABLE "new_PvtSubmission" RENAME TO "PvtSubmission";
CREATE INDEX "PvtSubmission_tenantId_electionId_idx" ON "PvtSubmission"("tenantId", "electionId");
CREATE INDEX "PvtSubmission_tenantId_pollingUnitId_idx" ON "PvtSubmission"("tenantId", "pollingUnitId");
CREATE INDEX "PvtSubmission_tenantId_submittedAt_idx" ON "PvtSubmission"("tenantId", "submittedAt");
CREATE UNIQUE INDEX "PvtSubmission_pollingUnitId_submittedById_source_key" ON "PvtSubmission"("pollingUnitId", "submittedById", "source");
CREATE TABLE "new_SecurityEvent" (
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
    CONSTRAINT "SecurityEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SecurityEvent" ("createdAt", "description", "eventType", "id", "ipAddress", "metadata", "resolved", "resolvedAt", "resolvedById", "severity", "tenantId", "userAgent", "userId") SELECT "createdAt", "description", "eventType", "id", "ipAddress", "metadata", "resolved", "resolvedAt", "resolvedById", "severity", "tenantId", "userAgent", "userId" FROM "SecurityEvent";
DROP TABLE "SecurityEvent";
ALTER TABLE "new_SecurityEvent" RENAME TO "SecurityEvent";
CREATE INDEX "SecurityEvent_tenantId_eventType_idx" ON "SecurityEvent"("tenantId", "eventType");
CREATE INDEX "SecurityEvent_tenantId_severity_idx" ON "SecurityEvent"("tenantId", "severity");
CREATE INDEX "SecurityEvent_tenantId_createdAt_idx" ON "SecurityEvent"("tenantId", "createdAt");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'FIELD_AGENT',
    "tenantId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
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
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("biometricProfile", "biometricRiskScore", "createdAt", "deviceFingerprint", "deviceTrustScore", "email", "id", "isLocked", "isOnline", "lastSecurityAuditAt", "lastSeenAt", "lockedAt", "lockedReason", "name", "passwordHash", "phone", "role", "tenantId", "twoFactorSecret", "updatedAt", "whatsappJid") SELECT "biometricProfile", "biometricRiskScore", "createdAt", "deviceFingerprint", "deviceTrustScore", "email", "id", "isLocked", "isOnline", "lastSecurityAuditAt", "lastSeenAt", "lockedAt", "lockedReason", "name", "passwordHash", "phone", "role", "tenantId", "twoFactorSecret", "updatedAt", "whatsappJid" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ChatMessage_tenantId_createdAt_idx" ON "ChatMessage"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "KeyMessage_tenantId_category_idx" ON "KeyMessage"("tenantId", "category");

-- CreateIndex
CREATE INDEX "KeyMessage_tenantId_isActive_idx" ON "KeyMessage"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "NarrativeTimeline_tenantId_type_idx" ON "NarrativeTimeline"("tenantId", "type");

-- CreateIndex
CREATE INDEX "ScheduledReport_tenantId_isActive_idx" ON "ScheduledReport"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "ScheduledReport_tenantId_schedule_idx" ON "ScheduledReport"("tenantId", "schedule");
