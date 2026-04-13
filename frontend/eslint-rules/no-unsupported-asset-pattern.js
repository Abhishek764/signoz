'use strict';

const {
  ASSET_EXTENSIONS,
  hasAssetExtension,
  containsAssetExtension,
  extractUrlPath,
  isAbsolutePath,
  isPublicRelative,
} = require('./shared/asset-patterns');

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Vite-unsafe asset reference patterns that break runtime base-path deployments',
      category: 'Asset Migration',
      recommended: true,
      url: 'docs/superpowers/specs/2026-04-13-eslint-no-unsupported-asset-pattern-design.md',
    },
    schema: [],
    messages: {
      absoluteString:
        'Absolute asset path "{{ value }}" is not base-path-safe. ' +
        "Use an ES import instead: import fooUrl from '@/assets/...' and reference the variable.",
      templateLiteral:
        'Dynamic asset path with absolute prefix is not base-path-safe. ' +
        "Use new URL('./asset.svg', import.meta.url).href for dynamic asset paths.",
      absoluteImport:
        'Asset imported via absolute path is not supported. ' +
        "Use import fooUrl from '@/assets/...' instead.",
      publicImport:
        'Importing from public/ causes build duplication (asset ends up in both dist/Icons/ and dist/assets/). ' +
        "Move the asset to src/assets/ and use import fooUrl from '@/assets/...'.",
    },
  },

  create(context) {
    return {
      // Pattern #1: static absolute string literals used as values (not import sources)
      Literal(node) {
        if (node.parent && node.parent.type === 'ImportDeclaration') {
          return;
        }
        const value = node.value;
        if (typeof value !== 'string') return;

        if (isAbsolutePath(value) && hasAssetExtension(value)) {
          context.report({
            node,
            messageId: 'absoluteString',
            data: { value },
          });
          return;
        }

        // CSS-in-JS url() wrapper: e.g. "url('/Images/bg.png')" or "url('/Icons/foo.svg')"
        const urlPath = extractUrlPath(value);
        if (urlPath && isAbsolutePath(urlPath) && hasAssetExtension(urlPath)) {
          context.report({
            node,
            messageId: 'absoluteString',
            data: { value: urlPath },
          });
        }
      },

      // Pattern #2: dynamic template literals — `/Icons/${name}.svg`
      // Also catches: `/Logos/java.png?v=${x}` (extension inside a quasi, not at end)
      // Also catches: `url('/Images/bg.png')` (CSS-in-JS url() wrapper in template)
      TemplateLiteral(node) {
        const quasis = node.quasis;
        if (!quasis || quasis.length === 0) return;

        const firstQuasi = quasis[0].value.raw;

        // Check for asset extension anywhere in any quasi (handles query-string suffixes)
        const hasAssetExt = quasis.some((q) => containsAssetExtension(q.value.raw));

        if (isAbsolutePath(firstQuasi) && hasAssetExt) {
          context.report({
            node,
            messageId: 'templateLiteral',
          });
          return;
        }

        // CSS-in-JS url() wrapper in template literal: `url('/Images/bg.png')`
        // The entire template may be a static url() with no expressions.
        if (quasis.length === 1) {
          const urlPath = extractUrlPath(firstQuasi);
          if (urlPath && isAbsolutePath(urlPath) && hasAssetExtension(urlPath)) {
            context.report({
              node,
              messageId: 'templateLiteral',
            });
          }
          return;
        }

        // CSS-in-JS url() wrapper with expressions: `url('/Images/${name}.png')`
        // Check if firstQuasi starts with url( and contains an asset extension somewhere in the template
        if (firstQuasi.includes('url(') && hasAssetExt) {
          const urlMatch = firstQuasi.match(/^url\(\s*['"]?\//);
          if (urlMatch) {
            context.report({
              node,
              messageId: 'templateLiteral',
            });
          }
        }
      },

      // Pattern #3 + #4: import declarations
      ImportDeclaration(node) {
        const src = node.source.value;
        if (typeof src !== 'string') return;

        if (isAbsolutePath(src) && hasAssetExtension(src)) {
          context.report({
            node,
            messageId: 'absoluteImport',
          });
          return;
        }

        if (isPublicRelative(src) && hasAssetExtension(src)) {
          context.report({
            node,
            messageId: 'publicImport',
          });
        }
      },
    };
  },
};
