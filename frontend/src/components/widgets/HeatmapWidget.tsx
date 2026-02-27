import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';

interface HeatmapData {
  rows: string[];
  cols: string[];
  values: number[][];  // 2D array: values[row][col]
  colorScale?: { min: string; max: string };
  timestamp: string;
}

interface HeatmapWidgetProps {
  config: WidgetConfig;
}

export function HeatmapWidget({ config }: HeatmapWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // Type assertion for HeatmapData
  const heatmapData = data as HeatmapData | undefined;

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-4 text-center">
          <div className="h-64 w-full bg-madhive-purple-medium/50 rounded" />
          <div className="h-4 w-32 bg-madhive-purple-medium/50 rounded mx-auto" />
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

  if (!heatmapData || !heatmapData.rows || !heatmapData.cols || !heatmapData.values) {
    return (
      <Card className="flex items-center justify-center h-full">
        <p className="text-madhive-chalk/60 text-tv-base">No data available</p>
      </Card>
    );
  }

  // Calculate min and max values for color scaling
  const allValues = heatmapData.values.flat();
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const range = maxValue - minValue || 1; // Avoid division by zero

  // Color interpolation function (purple to pink)
  const getColor = (value: number): string => {
    const normalized = (value - minValue) / range;

    if (heatmapData.colorScale) {
      // Use custom color scale if provided
      return interpolateColor(
        heatmapData.colorScale.min,
        heatmapData.colorScale.max,
        normalized
      );
    }

    // Default: purple (#8B5CF6) to pink (#FF9BD3)
    const purple = { r: 139, g: 92, b: 246 };
    const pink = { r: 255, g: 155, b: 211 };

    const r = Math.round(purple.r + (pink.r - purple.r) * normalized);
    const g = Math.round(purple.g + (pink.g - purple.g) * normalized);
    const b = Math.round(purple.b + (pink.b - purple.b) * normalized);

    return `rgb(${r}, ${g}, ${b})`;
  };

  // Simple color interpolation
  const interpolateColor = (color1: string, color2: string, factor: number): string => {
    // This is a simplified version; for production, use a proper color library
    return factor < 0.5 ? color1 : color2;
  };

  const cellWidth = 60;
  const cellHeight = 40;
  const labelWidth = 100;
  const labelHeight = 30;

  const svgWidth = labelWidth + heatmapData.cols.length * cellWidth + 20;
  const svgHeight = labelHeight + heatmapData.rows.length * cellHeight + 20;

  return (
    <Card variant="gradient" className="flex flex-col h-full overflow-hidden">
      {/* Title */}
      {config.title && (
        <div className="mb-4">
          <h3 className="text-tv-lg font-display text-madhive-chalk/80 truncate">
            {config.title}
          </h3>
        </div>
      )}

      {/* Heatmap */}
      <div className="flex-1 overflow-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="mx-auto"
          style={{ minWidth: svgWidth, minHeight: svgHeight }}
        >
          {/* Column labels */}
          {heatmapData.cols.map((col, colIndex) => (
            <text
              key={`col-label-${colIndex}`}
              x={labelWidth + colIndex * cellWidth + cellWidth / 2}
              y={labelHeight - 5}
              textAnchor="middle"
              className="text-tv-xs fill-madhive-chalk/60"
              style={{ fontSize: '12px' }}
            >
              {col}
            </text>
          ))}

          {/* Row labels and cells */}
          {heatmapData.rows.map((row, rowIndex) => (
            <g key={`row-${rowIndex}`}>
              {/* Row label */}
              <text
                x={labelWidth - 10}
                y={labelHeight + rowIndex * cellHeight + cellHeight / 2 + 5}
                textAnchor="end"
                className="text-tv-xs fill-madhive-chalk/60"
                style={{ fontSize: '12px' }}
              >
                {row}
              </text>

              {/* Cells */}
              {heatmapData.cols.map((_, colIndex) => {
                const value = heatmapData.values[rowIndex]?.[colIndex] ?? 0;
                const isHovered =
                  hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex;

                return (
                  <g key={`cell-${rowIndex}-${colIndex}`}>
                    <rect
                      x={labelWidth + colIndex * cellWidth}
                      y={labelHeight + rowIndex * cellHeight}
                      width={cellWidth - 2}
                      height={cellHeight - 2}
                      fill={getColor(value)}
                      stroke={isHovered ? '#FF9BD3' : 'transparent'}
                      strokeWidth={isHovered ? 2 : 0}
                      className="transition-all duration-200 cursor-pointer"
                      onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{ opacity: isHovered ? 1 : 0.9 }}
                    />
                    <text
                      x={labelWidth + colIndex * cellWidth + cellWidth / 2}
                      y={labelHeight + rowIndex * cellHeight + cellHeight / 2 + 5}
                      textAnchor="middle"
                      className="text-tv-xs fill-white pointer-events-none"
                      style={{ fontSize: '11px', fontWeight: 600 }}
                    >
                      {value.toFixed(1)}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredCell && (
          <div className="mt-2 text-center">
            <p className="text-tv-sm text-madhive-chalk/80">
              {heatmapData.rows[hoveredCell.row]} × {heatmapData.cols[hoveredCell.col]}:{' '}
              <span className="text-madhive-pink font-semibold">
                {heatmapData.values[hoveredCell.row][hoveredCell.col].toFixed(2)}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Timestamp footer */}
      {heatmapData.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(heatmapData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
