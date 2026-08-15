/**
 * JWT-based authentication utilities for OmniVote Monitor.
 *
 * Uses jose (edge-compatible) for JWT signing/verification and bcryptjs for
 * password hashing. Tokens are stored in httpOnly cookies.
 *
 * NOTE: In production, JWT_SECRET must be a strong random string (≥32 chars).
 * The fallback below is ONLY for development.
 */

import { SignJWT, jwtVerify as joseJwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

// ─── Configuration ─────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in .env or your deployment config.');
}
const TOKEN_EXPIRY = '24h'; // matches tenant.sessionTimeoutMin default
const COOKIE_NAME = 'omnivote-session';

// Use a Uint8Array key for jose
function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET);
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}

// ─── Password helpers ──────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT helpers ───────────────────────────────────────────────────────────

export async function createToken(payload: JwtPayload): Promise<string> {
  const key = getSecretKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(key);
}

/**
 * Verify a JWT token and return the payload.
 * Throws on invalid/expired tokens (unlike verifyToken which returns null).
 * Used by SSE and other token-based (non-cookie) endpoints.
 */
export async function jwtVerify(token: string): Promise<JwtPayload> {
  const result = await verifyToken(token);
  if (!result) throw new Error('Invalid or expired token');
  return result;
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const key = getSecretKey();
    const { payload } = await joseJwtVerify(token, key);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

// ─── Session helpers (cookie-based) ────────────────────────────────────────

export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function createSessionCookie(token: string): {
  name: string;
  value: string;
  options: { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number };
} {
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    },
  };
}

export function deleteSessionCookie(): {
  name: string;
  value: string;
  options: { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number };
} {
  return {
    name: COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    },
  };
}

// ─── API auth guard ────────────────────────────────────────────────────────

/**
 * Extract and verify the JWT from the request's cookies.
 * Returns null if not authenticated.
 * Use at the top of every protected API route.
 */
export async function getAuthUser(req: Request): Promise<JwtPayload | null> {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/omnivote-session=([^;]+)/);
  if (!match) return null;
  return verifyToken(match[1]);
}