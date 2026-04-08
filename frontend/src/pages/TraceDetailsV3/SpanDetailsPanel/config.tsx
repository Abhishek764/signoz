import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@signozhq/badge';
import { Span } from 'types/api/trace/getTraceV2';

interface HighlightedOption {
	key: string;
	label: string;
	render: (span: Span) => ReactNode | null;
}

export const HIGHLIGHTED_OPTIONS: HighlightedOption[] = [
	{
		key: 'service',
		label: 'SERVICE',
		render: (span): ReactNode | null =>
			span.serviceName ? (
				<Badge color="vanilla">
					<span className="span-details-panel__service-dot" />
					{span.serviceName}
				</Badge>
			) : null,
	},
	{
		key: 'statusCodeString',
		label: 'STATUS CODE STRING',
		render: (span): ReactNode | null =>
			span.statusCodeString ? (
				<Badge color="vanilla">{span.statusCodeString}</Badge>
			) : null,
	},
	{
		key: 'traceId',
		label: 'TRACE ID',
		render: (span): ReactNode | null =>
			span.traceId ? (
				<Link
					to={{
						pathname: `/trace/${span.traceId}`,
						search: window.location.search,
					}}
					className="span-details-panel__trace-id"
				>
					{span.traceId}
				</Link>
			) : null,
	},
	{
		key: 'spanKind',
		label: 'SPAN KIND',
		render: (span): ReactNode | null =>
			span.spanKind ? <Badge color="vanilla">{span.spanKind}</Badge> : null,
	},
];
