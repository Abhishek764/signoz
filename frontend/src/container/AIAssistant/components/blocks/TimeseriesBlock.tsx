export interface TimeseriesData {
	title?: string;
	unit?: string;
	/** Column header labels. Defaults to ["Time", "Value"]. */
	columns?: string[];
	/** Each row is an array of cell values (strings or numbers). */
	rows: (string | number)[][];
}

export default function TimeseriesBlock({
	data,
}: {
	data: TimeseriesData;
}): JSX.Element {
	const { title, unit, columns, rows } = data;
	const cols = columns ?? ['Time', 'Value'];

	return (
		<div className="ai-block ai-timeseries">
			{(title || unit) && (
				<p className="ai-block__title">
					{title}
					{unit ? <span className="ai-block__unit"> ({unit})</span> : null}
				</p>
			)}

			<div className="ai-timeseries__scroll">
				<table className="ai-timeseries__table">
					<thead>
						<tr>
							{cols.map((col) => (
								<th key={col}>{col}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row, i) => (
							// Row index is the stable key here since rows have no IDs
							// eslint-disable-next-line react/no-array-index-key
							<tr key={i}>
								{row.map((cell, j) => (
									// eslint-disable-next-line react/no-array-index-key
									<td key={j}>{cell}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{rows.length === 0 && <p className="ai-block__empty">No data available.</p>}
		</div>
	);
}
