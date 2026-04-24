export const getFormatedLegend = (value: string): string =>
	value.replaceAll(/\{\s*\{\s*(.*?)\s*\}\s*\}/g, '{{$1}}');
