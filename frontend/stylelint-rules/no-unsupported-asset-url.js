import stylelint from 'stylelint';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  ASSET_EXTENSIONS,
  containsAssetExtension,
  isAbsolutePath,
  isPublicRelative,
} = require('../eslint-rules/shared/asset-patterns');

const ruleName = 'local/no-unsupported-asset-url';

/**
 * Extracts all url() inner path strings from a CSS declaration value.
 * Handles single-quoted, double-quoted, and unquoted url() forms.
 * e.g. "url('/a.svg') url('/b.png') repeat" → ['/a.svg', '/b.png']
 */
function extractUrlPaths(value) {
  if (typeof value !== 'string') return [];
  const paths = [];
  const urlPattern = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g;
  let match = urlPattern.exec(value);
  while (match !== null) {
    paths.push(match[1]);
    match = urlPattern.exec(value);
  }
  return paths;
}

const meta = {
  url: 'https://github.com/SigNoz/signoz/blob/main/frontend/docs/superpowers/specs/2026-04-13-stylelint-no-unsupported-asset-url-design.md',
};

const messages = stylelint.utils.ruleMessages(ruleName, {
  absolutePath: (urlPath) =>
    `Absolute asset path "${urlPath}" in url() is not base-path-safe. ` +
    `Use a relative path from src/assets/ instead: url('../../assets/...')`,
  publicPath: () =>
    `url() path through public/ causes build duplication. ` +
    `Move asset to src/assets/ and use a relative path: url('../../assets/...')`,
});

/** @type {import('stylelint').Rule} */
const rule = (primaryOption) => {
  return (root, result) => {
    if (!primaryOption) return;

    root.walkDecls((decl) => {
      const urlPaths = extractUrlPaths(decl.value);

      for (const urlPath of urlPaths) {
        // Pattern #1: absolute path with asset extension
        if (isAbsolutePath(urlPath) && containsAssetExtension(urlPath)) {
          stylelint.utils.report({
            message: messages.absolutePath(urlPath),
            node: decl,
            result,
            ruleName,
          });
          continue;
        }

        // Pattern #2: relative path into public/ with asset extension
        if (isPublicRelative(urlPath) && containsAssetExtension(urlPath)) {
          stylelint.utils.report({
            message: messages.publicPath(),
            node: decl,
            result,
            ruleName,
          });
        }
      }
    });
  };
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export { ruleName, rule, meta };
export default { ruleName, rule, meta };
