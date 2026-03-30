/**
 * AI response block system.
 *
 * Import this module once (e.g. in MessageBubble / StreamingMessage) to
 * register all built-in block types.  External modules can extend the registry
 * at any time:
 *
 *   import { BlockRegistry } from 'container/AIAssistant/components/blocks';
 *   BlockRegistry.register('my-panel', MyPanelComponent);
 */

// Side-effect: ensure Chart.js components are registered before any chart renders
import './chartSetup';

import BarChartBlock from './BarChartBlock';
import { BlockRegistry } from './BlockRegistry';
import ConfirmBlock from './ConfirmBlock';
import InteractiveQuestion from './InteractiveQuestion';
import LineChartBlock from './LineChartBlock';
import PieChartBlock from './PieChartBlock';
import TimeseriesBlock from './TimeseriesBlock';

// ─── Register built-in block types ───────────────────────────────────────────

BlockRegistry.register('question', InteractiveQuestion);
BlockRegistry.register('confirm', ConfirmBlock);
BlockRegistry.register('timeseries', TimeseriesBlock);
BlockRegistry.register('barchart', BarChartBlock);
BlockRegistry.register('piechart', PieChartBlock);
// ai-linechart and ai-graph are aliases for the same component
BlockRegistry.register('linechart', LineChartBlock);
BlockRegistry.register('graph', LineChartBlock);

// ─── Public exports ───────────────────────────────────────────────────────────

export { BlockRegistry } from './BlockRegistry';
export { default as RichCodeBlock } from './RichCodeBlock';
