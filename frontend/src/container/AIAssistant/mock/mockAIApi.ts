/**
 * Dummy streaming API — mimics a real fetch() response with a ReadableStream body.
 * Swap `mockAIStream` for `fetch(...)` in the store when the real backend is ready.
 */

const CANNED_RESPONSES: Record<string, string> = {
	default: `I'm the SigNoz AI Assistant. I can help you explore your observability data — traces, logs, metrics, and more.

Here are a few things you can ask me:

- **"Show me error rates"** — table view of errors per service
- **"Show me a latency graph"** — line chart of p99 latency over time
- **"Show me a bar chart of top services"** — horizontal bar chart
- **"Show me a pie chart of errors"** — doughnut chart by service
- **"Any anomalies?"** — confirmation flow example

What would you like to investigate?`,

	error: `I found several issues in your traces over the last 15 minutes:

\`\`\`ai-timeseries
{
  "title": "Error Rates by Service",
  "columns": ["Service", "Error Rate", "Change"],
  "rows": [
    ["payment-svc", "4.2%", "↑ +3.1%"],
    ["auth-svc",    "0.8%", "→ stable"],
    ["cart-svc",   "12.1%", "↑ +11.4%"]
  ]
}
\`\`\`

The \`cart-svc\` spike started around **14:32 UTC** — correlates with a deploy event.

\`\`\`
TraceID: 7f3a9c2b1e4d6f80
Span: cart-svc → inventory-svc
Error: connection timeout after 5000ms
\`\`\``,

	latency: `Here's the p99 latency over the last hour for your top services:

\`\`\`ai-graph
{
  "title": "p99 Latency (ms)",
  "unit": "ms",
  "labels": ["13:00","13:10","13:20","13:30","13:40","13:45","13:50","14:00"],
  "datasets": [
    {
      "label": "checkout-svc",
      "data": [310, 318, 325, 340, 480, 842, 790, 650],
      "fill": true
    },
    {
      "label": "payment-svc",
      "data": [195, 201, 198, 205, 210, 208, 203, 201]
    },
    {
      "label": "user-svc",
      "data": [112, 108, 105, 102, 99, 98, 96, 98]
    }
  ]
}
\`\`\`

The **checkout-svc** degradation started at ~13:45. Its upstream dependency \`inventory-svc\` shows the same pattern — likely the root cause.`,

	logs: `I searched your logs for the last 30 minutes and found **1,247 ERROR** entries.

Top error messages:

1. \`NullPointerException in OrderProcessor.java:142\` — 843 occurrences
2. \`Database connection pool exhausted\` — 312 occurrences
3. \`HTTP 429 Too Many Requests from stripe-api\` — 92 occurrences

The \`NullPointerException\` is new — first seen at **14:01 UTC**, which lines up with your latest deployment.`,

	barchart: `Here are the **top 8 services** ranked by total error count in the last hour:

\`\`\`ai-barchart
{
  "title": "Error Count by Service (last 1h)",
  "unit": "errors",
  "bars": [
    { "label": "cart-svc",         "value": 3842 },
    { "label": "checkout-svc",     "value": 2910 },
    { "label": "payment-svc",      "value": 1204 },
    { "label": "inventory-svc",    "value": 987  },
    { "label": "user-svc",         "value": 543  },
    { "label": "recommendation",   "value": 312  },
    { "label": "notification-svc", "value": 198  },
    { "label": "auth-svc",         "value": 74   }
  ]
}
\`\`\`

**cart-svc** is the clear outlier — 3.8× more errors than the next service. I'd start there.`,

	piechart: `Here is how errors are distributed across your top services:

\`\`\`ai-piechart
{
  "title": "Error Share by Service (last 1h)",
  "slices": [
    { "label": "cart-svc",      "value": 3842 },
    { "label": "checkout-svc",  "value": 2910 },
    { "label": "payment-svc",   "value": 1204 },
    { "label": "inventory-svc", "value": 987  },
    { "label": "user-svc",      "value": 543  },
    { "label": "other",         "value": 584  }
  ]
}
\`\`\`

**cart-svc** and **checkout-svc** together account for more than 65% of all errors. Both share a dependency on \`inventory-svc\` — that's likely the common root cause.`,

	timeseries: `Here is the request-rate trend for **checkout-svc** over the last 10 minutes:

\`\`\`ai-timeseries
{
  "title": "Request Rate — checkout-svc",
  "unit": "req/min",
  "columns": ["Time (UTC)", "Requests", "Errors", "Error %"],
  "rows": [
    ["14:50", 1240, 12,  "0.97%"],
    ["14:51", 1318, 14,  "1.06%"],
    ["14:52", 1290, 18,  "1.40%"],
    ["14:53", 1355, 31,  "2.29%"],
    ["14:54", 1401, 58,  "4.14%"],
    ["14:55", 1389, 112, "8.07%"],
    ["14:56", 1342, 198, "14.75%"],
    ["14:57", 1278, 176, "13.77%"],
    ["14:58", 1310, 143, "10.92%"],
    ["14:59", 1365, 89,  "6.52%"]
  ]
}
\`\`\`

The error rate started climbing at **14:53** — coinciding with a config push to the \`inventory-svc\` dependency.`,

	question: `Sure! To narrow down the investigation, I need a bit more context.

\`\`\`ai-question
{
  "question": "Which environment are you interested in?",
  "type": "radio",
  "options": [
    { "value": "production", "label": "Production" },
    { "value": "staging",    "label": "Staging" },
    { "value": "development","label": "Development" }
  ]
}
\`\`\``,

	multiselect: `Got it. Which log levels should I focus on?

\`\`\`ai-question
{
  "question": "Select the log levels to include:",
  "type": "checkbox",
  "options": ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"]
}
\`\`\``,

	confirm: `I found a potential anomaly in \`cart-svc\`. The error rate jumped from 0.8% to 12.1% in the last 5 minutes.

\`\`\`ai-confirm
{
  "message": "Would you like me to create an alert rule for this service so you're notified if it happens again?",
  "acceptLabel": "Yes, create alert",
  "rejectLabel": "No thanks",
  "acceptText": "Yes, please create an alert rule for cart-svc error rate > 5%.",
  "rejectText": "No, don't create an alert."
}
\`\`\``,

	actionRunQuery: `Sure! I'll update the log query to filter for ERROR-level logs from \`payment-svc\`.

\`\`\`ai-action
{
  "actionId": "logs.runQuery",
  "description": "Filter logs to ERROR level from payment-svc and re-run the query",
  "parameters": {
    "filters": [
      { "key": "severity_text", "op": "=", "value": "ERROR" },
      { "key": "service.name",  "op": "=", "value": "payment-svc" }
    ]
  }
}
\`\`\``,

	actionAddFilter: `I'll add a filter for \`ERROR\` severity to your current query.

\`\`\`ai-action
{
  "actionId": "logs.addFilter",
  "description": "Add a severity_text = ERROR filter to the current query",
  "parameters": {
    "key": "severity_text",
    "op": "=",
    "value": "ERROR"
  }
}
\`\`\``,

	actionChangeView: `I'll switch the Logs Explorer to the timeseries view so you can see the log volume over time.

\`\`\`ai-action
{
  "actionId": "logs.changeView",
  "description": "Switch to the timeseries panel view",
  "parameters": {
    "view": "timeseries"
  }
}
\`\`\``,

	actionSaveView: `I can save your current query as a named view. What should it be called?

\`\`\`ai-action
{
  "actionId": "logs.saveView",
  "description": "Save the current log query as \\"Error Logs — Payment\\"",
  "parameters": {
    "name": "Error Logs — Payment"
  }
}
\`\`\``,
};

// eslint-disable-next-line sonarjs/cognitive-complexity
function pickResponse(messages: { role: string; content: string }[]): string {
	const lastRaw =
		[...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

	// Strip the PAGE_CONTEXT block if present — match against the user's actual text
	const last = lastRaw
		.replace(/\[PAGE_CONTEXT\][\s\S]*?\[\/PAGE_CONTEXT\]\n?/g, '')
		.toLowerCase();

	// ── Page action triggers ──────────────────────────────────────────────────
	if (
		last.includes('save view') ||
		last.includes('save this view') ||
		last.includes('save query')
	) {
		return CANNED_RESPONSES.actionSaveView;
	}
	if (
		last.includes('change view') ||
		last.includes('switch to timeseries') ||
		last.includes('timeseries view')
	) {
		return CANNED_RESPONSES.actionChangeView;
	}
	if (
		last.includes('add filter') ||
		last.includes('filter for error') ||
		last.includes('show only error')
	) {
		return CANNED_RESPONSES.actionAddFilter;
	}
	if (
		last.includes('run query') ||
		last.includes('update query') ||
		last.includes('filter logs') ||
		last.includes('search logs') ||
		(last.includes('payment') && last.includes('error'))
	) {
		return CANNED_RESPONSES.actionRunQuery;
	}

	// ── Original triggers ─────────────────────────────────────────────────────
	if (
		last.includes('confirm') ||
		last.includes('alert') ||
		last.includes('anomal')
	) {
		return CANNED_RESPONSES.confirm;
	}
	if (
		last.includes('pie') ||
		last.includes('distribution') ||
		last.includes('share')
	) {
		return CANNED_RESPONSES.piechart;
	}
	if (
		last.includes('bar') ||
		last.includes('breakdown') ||
		last.includes('top service') ||
		last.includes('top 5') ||
		last.includes('top 8')
	) {
		return CANNED_RESPONSES.barchart;
	}
	if (
		last.includes('timeseries') ||
		last.includes('time series') ||
		last.includes('table') ||
		last.includes('request rate')
	) {
		return CANNED_RESPONSES.timeseries;
	}
	if (
		last.includes('graph') ||
		last.includes('linechart') ||
		last.includes('line chart') ||
		last.includes('latency') ||
		last.includes('slow') ||
		last.includes('p99') ||
		last.includes('over time') ||
		last.includes('trend')
	) {
		return CANNED_RESPONSES.latency;
	}
	if (
		last.includes('select') ||
		last.includes('level') ||
		last.includes('filter')
	) {
		return CANNED_RESPONSES.multiselect;
	}
	if (
		last.includes('ask') ||
		last.includes('which env') ||
		last.includes('environment') ||
		last.includes('question')
	) {
		return CANNED_RESPONSES.question;
	}
	if (last.includes('error') || last.includes('exception')) {
		return CANNED_RESPONSES.error;
	}
	if (last.includes('log')) {
		return CANNED_RESPONSES.logs;
	}
	return CANNED_RESPONSES.default;
}

import { SSEEvent } from '../../../api/ai/chat';

interface MockChatPayload {
	conversationId: string;
	messages: { role: 'user' | 'assistant'; content: string }[];
}

export async function* mockStreamChat(
	payload: MockChatPayload,
): AsyncGenerator<SSEEvent> {
	const text = pickResponse(payload.messages);
	const words = text.split(/(?<=\s)/);
	const messageId = `mock-${Date.now()}`;
	const executionId = `mock-exec-${Date.now()}`;

	for (let i = 0; i < words.length; i++) {
		// eslint-disable-next-line no-await-in-loop
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 15 + Math.random() * 30);
		});
		yield {
			type: 'message',
			executionId,
			messageId,
			delta: words[i],
			done: false,
			actions: null,
			eventId: i + 1,
		};
	}

	// Final message event with done: true
	yield {
		type: 'message',
		executionId,
		messageId,
		delta: '',
		done: true,
		actions: null,
		eventId: words.length + 1,
	};

	yield {
		type: 'done',
		executionId,
		tokenInput: 0,
		tokenOutput: words.length,
		latencyMs: 0,
		eventId: words.length + 2,
	};
}
