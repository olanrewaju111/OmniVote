import { describe, it, expect } from 'vitest';
import { stripHtml, escapeHtml, sanitizeInput, sanitizeCsvField } from '../sanitize';

// ─── stripHtml ────────────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('strips simple HTML tags', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello');
  });

  it('strips multiple tags', () => {
    expect(stripHtml('<div><b>Bold</b> text</div>')).toBe('Bold text');
  });

  it('strips self-closing tags', () => {
    expect(stripHtml('Line 1<br/>Line 2')).toBe('Line 1Line 2');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('Hello World')).toBe('Hello World');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('strips script tags (prevents XSS)', () => {
    expect(stripHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it('handles tags with attributes', () => {
    expect(stripHtml('<a href="http://example.com">link</a>')).toBe('link');
  });
});

// ─── escapeHtml ───────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('a<b')).toBe('a&lt;b');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('a>b')).toBe('a&gt;b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('a"b')).toBe('a&quot;b');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("a'b")).toBe('a&#039;b');
  });

  it('escapes all entities in one string', () => {
    expect(escapeHtml('<script>alert("xss") & more\'s</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;) &amp; more&#039;s&lt;/script&gt;',
    );
  });

  it('returns plain text unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

// ─── sanitizeInput ────────────────────────────────────────────────────────

describe('sanitizeInput', () => {
  it('strips HTML and trims', () => {
    expect(sanitizeInput('  <b>Hello</b>  ')).toBe('Hello');
  });

  it('truncates to maxLength', () => {
    expect(sanitizeInput('abcdefghij', 5)).toBe('abcde');
  });

  it('uses default maxLength of 10000', () => {
    const long = 'a'.repeat(10001);
    expect(sanitizeInput(long).length).toBe(10000);
  });

  it('returns empty string for whitespace-only HTML input', () => {
    expect(sanitizeInput('  <p></p>  ')).toBe('');
  });
});

// ─── sanitizeCsvField ─────────────────────────────────────────────────────

describe('sanitizeCsvField', () => {
  it('escapes double quotes by doubling them', () => {
    expect(sanitizeCsvField('hello "world"')).toBe('hello ""world""');
  });

  it('replaces newlines with spaces', () => {
    expect(sanitizeCsvField('line1\nline2')).toBe('line1 line2');
  });

  it('replaces carriage returns with spaces', () => {
    expect(sanitizeCsvField('line1\rline2')).toBe('line1 line2');
  });

  it('handles both quotes and newlines', () => {
    expect(sanitizeCsvField('"val\nue"')).toBe('""val ue""');
  });

  it('returns plain text unchanged', () => {
    expect(sanitizeCsvField('Hello World')).toBe('Hello World');
  });
});
