/**
 * Security module barrel exports.
 */

export {
  generateCsrfToken,
  validateCsrfToken,
  CsrfError,
  CSRF_COOKIE_NAME,
} from './csrf';

export {
  checkLoginAttempt,
  recordFailedAttempt,
  recordSuccessfulLogin,
  isAccountLocked,
  type LoginCheckResult,
} from './brute-force';

export {
  validateEmail,
  validatePassword,
  validateUrl,
  validateJsonDepth,
  validatePhoneNumber,
  validateId,
  sanitizeObject,
} from './input-validator';

export {
  getCorsHeaders,
  isOriginAllowed,
} from './cors';

export {
  logSecurityEvent,
  type SecurityEventType,
} from './security-logger';

export {
  createRouteGuard,
} from './request-guard';

export {
  requireCsrf,
  setCsrfCookie,
} from './csrf-enforce';
