'use strict';

const {
	hasAssetExtension,
	containsAssetExtension,
	extractUrlPath,
	isAbsolutePath,
	isPublicRelative,
} = require('./shared/asset-patterns');

const PUBLIC_DIR_SEGMENTS = ['/Icons/', '/Images/', '/Logos/', '/svgs/'];

function collectBinaryStringParts(node) {
	if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
	if (node.type === 'BinaryExpression' && node.operator === '+') {
		return [...collectBinaryStringParts(node.left), ...collectBinaryStringParts(node.right)];
	}
	if (node.type === 'TemplateLiteral') {
		return node.quasis.map((q) => q.value.raw);
	}
	return [null];
}

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow Vite-unsafe asset reference patterns that break runtime base-path deployments',
			category: 'Asset Migration',
			recommended: true,
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
				'Assets in public/ bypass Vite\'s module pipeline — their URLs are not base-path-aware and will break when the app is served from a sub-path (e.g. /app/). ' +
				"Use an ES import instead: import fooUrl from '@/assets/...' so Vite injects the correct base path.",
		},
	},

	create(context) {
		return {
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

				const urlPath = extractUrlPath(value);
				if (urlPath && isAbsolutePath(urlPath) && hasAssetExtension(urlPath)) {
					context.report({
						node,
						messageId: 'absoluteString',
						data: { value: urlPath },
					});
				}
			},

			TemplateLiteral(node) {
				const quasis = node.quasis;
				if (!quasis || quasis.length === 0) return;

				const firstQuasi = quasis[0].value.raw;
				const hasAssetExt = quasis.some((q) => containsAssetExtension(q.value.raw));

				if (isAbsolutePath(firstQuasi) && hasAssetExt) {
					context.report({
						node,
						messageId: 'templateLiteral',
					});
					return;
				}

				// Expression-first template with known public-dir segment: `${base}/Icons/foo.svg`
				const hasPublicSegment = quasis.some((q) =>
					PUBLIC_DIR_SEGMENTS.some((seg) => q.value.raw.includes(seg)),
				);
				if (hasPublicSegment && hasAssetExt) {
					context.report({
						node,
						messageId: 'templateLiteral',
					});
					return;
				}

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

			// String concatenation: "/Icons/" + name + ".svg"
			BinaryExpression(node) {
				if (node.operator !== '+') return;

				const parts = collectBinaryStringParts(node);
				const prefixParts = [];
				for (const part of parts) {
					if (part === null) break;
					prefixParts.push(part);
				}
				const staticPrefix = prefixParts.join('');

				if (!isAbsolutePath(staticPrefix)) return;

				const hasExt = parts.some(
					(part) => part !== null && containsAssetExtension(part),
				);
				if (hasExt) {
					context.report({
						node,
						messageId: 'templateLiteral',
					});
				}
			},

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

			ImportExpression(node) {
				const src = node.source;
				if (!src || src.type !== 'Literal' || typeof src.value !== 'string') return;

				if (isAbsolutePath(src.value) && hasAssetExtension(src.value)) {
					context.report({
						node,
						messageId: 'absoluteImport',
					});
					return;
				}

				if (isPublicRelative(src.value) && hasAssetExtension(src.value)) {
					context.report({
						node,
						messageId: 'publicImport',
					});
				}
			},
		};
	},
};
