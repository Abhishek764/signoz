import { sortBy } from 'lodash-es';

const MAX_QUERIES = 26;
function GetQueryName(queries: { name: string }[] = []): string | null {
	if (queries.length === 0) {
		return 'A';
	}
	if (queries.length === MAX_QUERIES) {
		return null;
	}
	const sortedQueries = sortBy(queries, (q) => q.name);

	let queryIteratorIdx = 0;

	for (
		let charItr = 'A'.codePointAt(0);
		charItr <= 'A'.codePointAt(0) + MAX_QUERIES;
		charItr += 1
	) {
		if (charItr !== sortedQueries[queryIteratorIdx]?.name.codePointAt(0)) {
			return String.fromCodePoint(charItr);
		}
		queryIteratorIdx += 1;
	}

	return null;
}

export default GetQueryName;
