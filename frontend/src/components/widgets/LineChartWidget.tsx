import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatNumber } from '@/lib/utils';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';

interface Dataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
}

interface LineChartData {
  labels: string[];
  datasets: Dataset[];
  timestamp: string;
}

interface LineChartWidgetProps {
  config: WidgetConfig;
}

// MadHive color palette for multiple datasets
const COLORS = [
  { line: '#FF9BD3', area: 'url(#areaGradient1)' }, // Pink
  { line: '#B794F6', area: 'url(#areaGradient2)' }, // Purple
  { line: '#60D5E8', area: 'url(#areaGradient3)' }, // Cyan
  { line: '#FFB86C', area: 'url(#areaGradient4)' }, // Orange
  { line: '#A1EFD3', area: 'url(#areaGradient5)' }, // Teal
];

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="bg-madhive-charcoal border border-madhive-purple-medium/50 rounded-lg p-3 shadow-lg">
      <p className="text-madhive-chalk/80 text-tv-sm mb-2 font-medium">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.stroke || entry.color }}
            />
            <span className="text-tv-sm text-madhive-chalk/60">{entry.name}:</span>
            <span className="text-tv-sm text-madhive-chalk font-medium">
              {formatNumber(entry.value, 2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function LineChartWidget({ config }: LineChartWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);

  // Type assertion for LineChartData
  const lineChartData = data as LineChartData | undefined;

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-4 text-center w-full">
          <div className="h-64 bg-madhive-purple-medium/50 rounded mx-4" />
          <div className="h-4 w-48 bg-madhive-purple-medium/50 rounded mx-auto" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-error text-tv-base">Error loading data</p>
          <p className="text-madhive-chalk/60 text-tv-sm mt-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </Card>
    );
  }

  // Empty data state
  if (!lineChartData || !lineChartData.labels || lineChartData.labels.length === 0) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-madhive-chalk/60 text-tv-base">No data available</p>
        </div>
      </Card>
    );
  }

  // Transform data to Recharts format
  // From: { labels: ['A', 'B'], datasets: [{ label: 'X', data: [1, 2] }] }
  // To: [{ name: 'A', X: 1 }, { name: 'B', X: 2 }]
  const chartData =
    lineChartData?.labels.map((label, index) => {
      const dataPoint: Record<string, any> = { name: label };
      lineChartData.datasets.forEach((dataset) => {
        dataPoint[dataset.label] = dataset.data[index] ?? null;
      });
      return dataPoint;
    }) ?? [];

  // Get dataset keys for Line components
  const datasetKeys = lineChartData?.datasets.map((d) => d.label) ?? [];

  return (
    <Card variant="default" className="flex flex-col h-full overflow-hidden">
      {/* Title */}
      {config.title && (
        <div className="mb-4">
          <h3 className="text-tv-lg font-display text-madhive-chalk/80 truncate">
            {config.title}
          </h3>
        </div>
      )}

      {/* Chart container */}
      <div className="flex-1" style={{ minHeight: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            {/* Define gradients for area fills */}
            <defs>
              <linearGradient id="areaGradient1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF9BD3" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#FF9BD3" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="areaGradient2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B794F6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#B794F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="areaGradient3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60D5E8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#60D5E8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="areaGradient4" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFB86C" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#FFB86C" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="areaGradient5" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A1EFD3" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#A1EFD3" stopOpacity={0} />
              </linearGradient>
              {/* Line gradients (pink to purple) */}
              <linearGradient id="lineGradient1" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#FF9BD3" />
                <stop offset="100%" stopColor="#B794F6" />
              </linearGradient>
            </defs>

            {/* Grid with dashed purple lines */}
            <CartesianGrid
              strokeDasharray="5 5"
              stroke="rgba(139, 92, 246, 0.3)"
              vertical={false}
            />

            {/* X-Axis */}
            <XAxis
              dataKey="name"
              stroke="#E0E7F1"
              strokeOpacity={0.4}
              tick={{ fill: 'rgba(224, 231, 241, 0.6)', fontSize: 12 }}
              tickLine={{ stroke: 'rgba(139, 92, 246, 0.3)' }}
            />

            {/* Y-Axis */}
            <YAxis
              stroke="#E0E7F1"
              strokeOpacity={0.4}
              tick={{ fill: 'rgba(224, 231, 241, 0.6)', fontSize: 12 }}
              tickLine={{ stroke: 'rgba(139, 92, 246, 0.3)' }}
              tickFormatter={(value) => formatNumber(value, 0)}
            />

            {/* Custom tooltip */}
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#FF9BD3', strokeWidth: 1 }} />

            {/* Legend */}
            <Legend
              wrapperStyle={{
                paddingTop: '20px',
              }}
              iconType="line"
              formatter={(value) => (
                <span className="text-madhive-chalk/80 text-tv-sm">{value}</span>
              )}
            />

            {/* Render Area + Line for each dataset */}
            {datasetKeys.map((key, index) => {
              const colorConfig = COLORS[index % COLORS.length];
              const dataset = lineChartData?.datasets[index];

              // Use custom colors if provided
              const lineColor = dataset?.borderColor || colorConfig.line;
              const areaFill = dataset?.backgroundColor || colorConfig.area;

              return (
                <g key={key}>
                  {/* Area fill under the line */}
                  <Area
                    type="monotone"
                    dataKey={key}
                    stroke="none"
                    fill={areaFill}
                    fillOpacity={1}
                    isAnimationActive={true}
                    animationDuration={800}
                    animationEasing="ease-in-out"
                  />
                  {/* Line on top of area */}
                  <Line
                    type="monotone"
                    dataKey={key}
                    stroke={lineColor}
                    strokeWidth={2}
                    dot={{
                      r: 4,
                      fill: lineColor,
                      strokeWidth: 2,
                      stroke: '#1A1D29',
                    }}
                    activeDot={{
                      r: 6,
                      fill: lineColor,
                      strokeWidth: 2,
                      stroke: '#1A1D29',
                    }}
                    isAnimationActive={true}
                    animationDuration={800}
                    animationEasing="ease-in-out"
                  />
                </g>
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Timestamp footer */}
      {lineChartData?.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(lineChartData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
