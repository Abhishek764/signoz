export const removeJSONStringifyQuotes = (s: string): string => {
	if (!s || s.length === 0) {
		return s;
	}

	if (s[0] === '"' && s.at(-1) === '"') {
		return s.slice(1, - 1);
	}
	return s;
};
