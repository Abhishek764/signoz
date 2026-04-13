'use strict';

/**
 * Shared helpers for asset pattern detection across ESLint and Stylelint rules.
 * Consolidates asset extension tracking and validation logic.
 */

const ASSET_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg', '.gif'];

/**
 * Returns true if the string ends with an asset extension.
 * e.g. "/Icons/foo.svg" → true, "/Icons/foo.svg.bak" → false
 */
function hasAssetExtension(str) {
  if (typeof str !== 'string') return false;
  return ASSET_EXTENSIONS.some((ext) => str.endsWith(ext));
}

/**
 * Returns true if the string contains an asset extension.
 * Uses boundary checking to avoid false positives:
 * - "/Icons/foo.svg" → true (at end)
 * - "/Icons/foo.svg?v=1" → true (followed by query char)
 * - "/config/jpg-settings" → false (no boundary after)
 * - "/icons.svg-dir/file" → false (no boundary after)
 */
function containsAssetExtension(str) {
  if (typeof str !== 'string') return false;
  return ASSET_EXTENSIONS.some((ext) => {
    const idx = str.indexOf(ext);
    if (idx === -1) return false;
    const afterIdx = idx + ext.length;
    // Accept if extension is at end of string or followed by non-alphanumeric char (?, #, /, etc.)
    return afterIdx >= str.length || /[^a-zA-Z0-9]/.test(str[afterIdx]);
  });
}

/**
 * Extracts the asset path from a CSS url() wrapper.
 * Handles single quotes, double quotes, unquoted, and whitespace variations.
 * e.g.
 *   "url('/Icons/foo.svg')" → "/Icons/foo.svg"
 *   "url( '../assets/bg.png' )" → "../assets/bg.png"
 *   "url(/Icons/foo.svg)" → "/Icons/foo.svg"
 * Returns null if the string is not a url() wrapper.
 */
function extractUrlPath(str) {
  if (typeof str !== 'string') return null;
  // Match url( [whitespace] [quote?] path [quote?] [whitespace] )
  // Capture group: [^'")\s]+ matches path until quote, closing paren, or whitespace
  const match = str.match(/^url\(\s*['"]?([^'")\s]+)['"]?\s*\)$/);
  return match ? match[1] : null;
}

/**
 * Returns true if the string is an absolute path (starts with /).
 * Absolute paths in url() bypass <base href> and fail under any URL prefix.
 */
function isAbsolutePath(str) {
  if (typeof str !== 'string') return false;
  return str.startsWith('/');
}

/**
 * Returns true if the path imports from the public/ directory.
 * Relative imports into public/ cause asset duplication in dist/.
 */
function isPublicRelative(str) {
  if (typeof str !== 'string') return false;
  return str.includes('/public/') || str.startsWith('public/');
}

module.exports = {
  ASSET_EXTENSIONS,
  hasAssetExtension,
  containsAssetExtension,
  extractUrlPath,
  isAbsolutePath,
  isPublicRelative,
};
