import { useMemo, useState } from 'react';
import { useCopyToClipboard } from 'react-use';
import { Copy } from '@signozhq/icons';
import { toast } from '@signozhq/ui';
// TODO: Replace antd Select with @signozhq/ui component when moving to design library
import { Select } from 'antd';
import { JsonView } from 'periscope/components/JsonView';
import { PrettyView } from 'periscope/components/PrettyView';
import { PrettyViewProps } from 'periscope/components/PrettyView';

import './DataViewer.styles.scss';

type ViewMode = 'pretty' | 'json';

export interface DataViewerProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: Record<string, any>;
	drawerKey?: string;
	prettyViewProps?: Omit<PrettyViewProps, 'data' | 'drawerKey'>;
}

function DataViewer({
	data,
	drawerKey = 'default',
	prettyViewProps,
}: DataViewerProps): JSX.Element {
	const [viewMode, setViewMode] = useState<ViewMode>('pretty');
	const [, setCopy] = useCopyToClipboard();

	const jsonString = useMemo(() => JSON.stringify(data, null, 2), [data]);

	const handleCopy = (): void => {
		const text = JSON.stringify(data, null, 2);
		setCopy(text);
		toast.success('Copied to clipboard', {
			richColors: true,
			position: 'top-right',
		});
	};

	return (
		<div className="data-viewer">
			<div className="data-viewer__toolbar">
				<Select
					className="data-viewer__mode-select"
					size="small"
					value={viewMode}
					onChange={(value: ViewMode): void => setViewMode(value)}
					options={[
						{ label: 'Pretty', value: 'pretty' },
						{ label: 'JSON', value: 'json' },
					]}
					getPopupContainer={(trigger): HTMLElement =>
						trigger.parentElement || document.body
					}
				/>
				<button
					type="button"
					className="data-viewer__copy-btn"
					onClick={handleCopy}
					aria-label="Copy JSON"
				>
					<Copy size={14} />
				</button>
			</div>

			<div className="data-viewer__content">
				{viewMode === 'pretty' && (
					<PrettyView data={data} drawerKey={drawerKey} {...prettyViewProps} />
				)}
				{viewMode === 'json' && <JsonView data={jsonString} />}
			</div>
		</div>
	);
}

export default DataViewer;
