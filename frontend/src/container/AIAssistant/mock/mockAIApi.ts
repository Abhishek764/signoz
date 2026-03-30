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
};

// eslint-disable-next-line sonarjs/cognitive-complexity
function pickResponse(messages: { role: string; content: string }[]): string {
	const last =
		[...messages]
			.reverse()
			.find((m) => m.role === 'user')
			?.content.toLowerCase() ?? '';

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

interface MockPayload {
	messages: { role: string; content: string }[];
}

export function mockAIStream(payload: MockPayload): Response {
	const text = pickResponse(payload.messages);
	const words = text.split(/(?<=\s)/);

	const stream = new ReadableStream<Uint8Array>({
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		async start(controller) {
			const encoder = new TextEncoder();
			for (let i = 0; i < words.length; i++) {
				// eslint-disable-next-line no-await-in-loop
				await new Promise<void>((resolve) => {
					setTimeout(resolve, 15 + Math.random() * 30);
				});
				controller.enqueue(encoder.encode(words[i]));
			}
			controller.close();
		},
	});

	return new Response(stream, {
		status: 200,
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
}
