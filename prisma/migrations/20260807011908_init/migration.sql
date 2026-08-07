-- CreateTable
CREATE TABLE "RateLimitRecord" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "firstAttempt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'FIELD_AGENT',
    "tenantId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT 'changeme',
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
INSERT INTO "new_User" ("biometricProfile", "biometricRiskScore", "createdAt", "deviceFingerprint", "deviceTrustScore", "email", "id", "isLocked", "isOnline", "lastSecurityAuditAt", "lastSeenAt", "lockedAt", "lockedReason", "name", "phone", "role", "tenantId", "twoFactorSecret", "updatedAt", "whatsappJid") SELECT "biometricProfile", "biometricRiskScore", "createdAt", "deviceFingerprint", "deviceTrustScore", "email", "id", "isLocked", "isOnline", "lastSecurityAuditAt", "lastSeenAt", "lockedAt", "lockedReason", "name", "phone", "role", "tenantId", "twoFactorSecret", "updatedAt", "whatsappJid" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
