import { toast } from '@signozhq/sonner';

export function copyToClipboard(value: unknown): void {
	const text =
		typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
	navigator.clipboard.writeText(text);
	toast.success('Copied to clipboard', {
		richColors: true,
		position: 'top-right',
	});
}
