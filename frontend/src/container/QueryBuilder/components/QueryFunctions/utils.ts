export const toFloat64 = (value: string): number => {
	const parsed = Number.parseFloat(value);
	if (!Number.isFinite(parsed)) {
		console.error(`Invalid value for timeshift. value: ${value}`);
	}
	return parsed;
};
