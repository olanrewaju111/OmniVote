/**
 * Basic input sanitization for user-submitted content.
 * Strips HTML tags and normalizes whitespace to prevent XSS.
 * For full sanitization in production, integrate DOMPurify on the client side.
 */

// Strip all HTML tags
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

// Escape HTML entities for safe rendering
export function escapeHtml(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return input.replace(/[&<>"']/g, (char) => map[char] || char);
}

// Sanitize user input: strip HTML, trim, limit length
export function sanitizeInput(input: string, maxLength: number = 10000): string {
  const cleaned = stripHtml(input).trim();
  return cleaned.length > maxLength ? cleaned.substring(0, maxLength) : cleaned;
}

// Sanitize for CSV export (handle quotes and newlines)
export function sanitizeCsvField(input: string): string {
  return input.replace(/"/g, '""').replace(/[\r\n]/g, ' ');
}