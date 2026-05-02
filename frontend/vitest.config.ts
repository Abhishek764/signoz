import { resolve } from 'path';
import type { Plugin, TransformResult } from 'vite';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

function rawMarkdownPlugin(): Plugin {
	return {
		name: 'raw-markdown',
		transform(code, id): TransformResult | undefined {
			if (!id.endsWith('.md')) {
				return undefined;
			}
			return {
				code: `export default ${JSON.stringify(code)};`,
				map: null,
			};
		},
	};
}

export default defineConfig({
	plugins: [tsconfigPaths(), rawMarkdownPlugin()],
	resolve: {
		alias: {
			'@': resolve(__dirname, './src'),
			'@signozhq/icons': resolve(
				__dirname,
				'./node_modules/@signozhq/icons/dist/index.esm.js',
			),
			'constants/env': resolve(__dirname, './__mocks__/env.ts'),
			utils: resolve(__dirname, './src/utils'),
			types: resolve(__dirname, './src/types'),
			constants: resolve(__dirname, './src/constants'),
			parser: resolve(__dirname, './src/parser'),
			providers: resolve(__dirname, './src/providers'),
			lib: resolve(__dirname, './src/lib'),
		},
	},
	ssr: {
		noExternal: ['@signozhq/ui', '@signozhq/icons'],
	},
	test: {
		globals: true,
		testTimeout: 15_000,
		environment: 'happy-dom',
		env: {
			VITE_FRONTEND_API_ENDPOINT: 'http://localhost',
		},
		setupFiles: ['./vitest.setup.ts'],
		include: ['src/**/*.test.{ts,tsx}'],
		exclude: ['node_modules', 'dist'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'cobertura', 'html', 'json-summary'],
			include: ['src/**/*.{ts,tsx}'],
			thresholds: {
				statements: 80,
				branches: 65,
				functions: 80,
				lines: 80,
			},
		},
	},
});
