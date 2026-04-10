import { toast } from '@signozhq/sonner';

export function copyToClipboard(value: unknown): void {
	const text =
		typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
	// eslint-disable-next-line no-restricted-properties
	navigator.clipboard.writeText(text);
	toast.success('Copied to clipboard', {
		richColors: true,
		position: 'top-right',
	});
}

// Resolve a value from a nested object using an array of keys (not dot-notation)
// e.g. resolveValueByKeys({ tagMap: { 'cloud.account.id': 'x' } }, ['tagMap', 'cloud.account.id']) → 'x'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveValueByKeys(
	data: Record<string, any>,
	keys: (string | number)[],
): unknown {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return keys.reduce((obj: any, key) => obj?.[key], data);
}

// Convert react-json-tree's reversed keyPath to forward order
// e.g. ['cloud.account.id', 'tagMap'] → ['tagMap', 'cloud.account.id']
export function keyPathToForward(
	keyPath: readonly (string | number)[],
): (string | number)[] {
	return [...keyPath].reverse();
}

// Display-friendly string for a keyPath
// e.g. ['tagMap', 'cloud.account.id'] → 'tagMap.cloud.account.id'
export function keyPathToDisplayString(
	keyPath: readonly (string | number)[],
): string {
	return [...keyPath].reverse().join('.');
}

// Serialize keyPath for storage/comparison (JSON stringified array)
export function serializeKeyPath(keyPath: (string | number)[]): string {
	return JSON.stringify(keyPath);
}

export function deserializeKeyPath(
	serialized: string,
): (string | number)[] | null {
	try {
		const parsed = JSON.parse(serialized);
		if (Array.isArray(parsed)) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}
