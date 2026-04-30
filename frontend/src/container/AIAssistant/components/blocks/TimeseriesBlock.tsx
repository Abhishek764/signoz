import blockStyles from './Block.module.scss';
import styles from './TimeseriesBlock.module.scss';

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
		<div className={blockStyles.block}>
			{(title || unit) && (
				<p className={blockStyles.title}>
					{title}
					{unit ? <span className={blockStyles.unit}> ({unit})</span> : null}
				</p>
			)}

			<div className={styles.scroll}>
				<table className={styles.table}>
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

			{rows.length === 0 && (
				<p className={blockStyles.empty}>No data available.</p>
			)}
		</div>
	);
}
