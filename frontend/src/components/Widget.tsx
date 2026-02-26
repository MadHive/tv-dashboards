import type { Widget as WidgetType } from '@lib/api';
import BigNumberWidget from './widgets/BigNumberWidget';
import StatCardWidget from './widgets/StatCardWidget';
import GaugeWidget from './widgets/GaugeWidget';
import LineChartWidget from './widgets/LineChartWidget';
import BarChartWidget from './widgets/BarChartWidget';
import TableWidget from './widgets/TableWidget';
import ListWidget from './widgets/ListWidget';
import MapWidget from './widgets/MapWidget';

interface WidgetProps {
  widget: WidgetType;
}

/**
 * Base Widget component - routes to specific widget type implementations
 */
export default function Widget({ widget }: WidgetProps) {
  // Route to specific widget type
  switch (widget.type) {
    case 'big-number':
      return <BigNumberWidget widget={widget} />;

    case 'stat-card':
      return <StatCardWidget widget={widget} />;

    case 'gauge':
      return <GaugeWidget widget={widget} />;

    case 'line-chart':
      return <LineChartWidget widget={widget} />;

    case 'bar-chart':
      return <BarChartWidget widget={widget} />;

    case 'table':
      return <TableWidget widget={widget} />;

    case 'list':
      return <ListWidget widget={widget} />;

    case 'map':
      return <MapWidget widget={widget} />;

    // Fallback for unimplemented widget types
    default:
      return (
        <div
          data-widget-id={widget.id}
          style={{
            gridColumn: `span ${widget.position.colSpan}`,
            gridRow: `span ${widget.position.rowSpan}`,
          }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col"
        >
          <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            <div className="text-center">
              <div className="text-yellow-500 text-2xl mb-2">⚙️</div>
              <div className="text-xs">Widget type "{widget.type}" not implemented</div>
              <div className="text-xs text-slate-600 mt-1">Source: {widget.source}</div>
            </div>
          </div>
        </div>
      );
  }
}
