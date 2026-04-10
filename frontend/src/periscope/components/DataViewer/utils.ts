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
