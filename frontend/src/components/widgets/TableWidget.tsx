import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatNumber } from '@/lib/utils';
import { useWidgetData } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import type { WidgetConfig } from '@/types/dashboard';

interface TableHeader {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'percentage' | 'status';
  sortable?: boolean;
}

interface TableData {
  headers: TableHeader[];
  rows: Record<string, any>[];
  compact?: boolean;
  timestamp: string;
}

interface TableWidgetProps {
  config: WidgetConfig;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export function TableWidget({ config }: TableWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Type assertion for TableData
  const tableData = data as TableData | undefined;

  // Handle column sorting
  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;

    setSortConfig((prev) => {
      if (prev?.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key, direction: 'asc' };
    });
  };

  // Sort rows based on current sort configuration
  const sortedRows = useMemo(() => {
    if (!tableData?.rows || !sortConfig) return tableData?.rows ?? [];

    return [...tableData.rows].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Compare values
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tableData?.rows, sortConfig]);

  // Format cell value based on type
  const formatCellValue = (value: any, type?: string): React.ReactNode => {
    if (value == null) return '—';

    switch (type) {
      case 'number':
        return typeof value === 'number' ? formatNumber(value) : value;

      case 'currency':
        return typeof value === 'number'
          ? `$${formatNumber(value, 2)}`
          : value;

      case 'percentage':
        return typeof value === 'number'
          ? `${value.toFixed(1)}%`
          : `${value}%`;

      case 'status':
        // Status should be an object with text and variant
        if (typeof value === 'object' && value.text) {
          return (
            <Badge variant={value.variant || 'default'}>
              {value.text}
            </Badge>
          );
        }
        // Fallback for string status values
        return <Badge variant="default">{value}</Badge>;

      case 'text':
      default:
        return value;
    }
  };

  // Get sort indicator icon
  const getSortIcon = (header: TableHeader) => {
    if (!header.sortable) return null;

    if (sortConfig?.key === header.key) {
      return sortConfig.direction === 'asc' ? (
        <ArrowUp className="w-4 h-4 ml-1 inline" />
      ) : (
        <ArrowDown className="w-4 h-4 ml-1 inline" />
      );
    }

    return <ArrowUpDown className="w-4 h-4 ml-1 inline opacity-40" />;
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-10 bg-madhive-purple-medium/50 rounded w-full" />
          <div className="h-16 bg-madhive-purple-medium/30 rounded w-full" />
          <div className="h-16 bg-madhive-purple-medium/30 rounded w-full" />
          <div className="h-16 bg-madhive-purple-medium/30 rounded w-full" />
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

  // Determine if compact mode is enabled
  const isCompact = config.config?.compact ?? tableData?.compact ?? false;

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

      {/* Table wrapper with scrolling */}
      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto max-h-full">
          <table className="w-full border-collapse">
            {/* Sticky header */}
            <thead className="sticky top-0 z-10">
              <tr>
                {tableData?.headers.map((header) => (
                  <th
                    key={header.key}
                    onClick={() => handleSort(header.key, header.sortable)}
                    className={cn(
                      'bg-madhive-purple-deep text-madhive-chalk text-left font-bold text-tv-sm border-b border-madhive-purple-medium',
                      isCompact ? 'px-3 py-2' : 'px-4 py-3',
                      header.sortable && 'cursor-pointer hover:bg-madhive-purple-dark transition-colors'
                    )}
                  >
                    <div className="flex items-center">
                      {header.label}
                      {getSortIcon(header)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table body with zebra striping and hover effects */}
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableData?.headers.length ?? 1}
                    className="text-center text-madhive-chalk/60 py-8"
                  >
                    No data available
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={cn(
                      'border-b border-madhive-purple-medium/30 transition-colors',
                      'hover:bg-madhive-purple-deep',
                      rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-madhive-purple-medium/20'
                    )}
                  >
                    {tableData?.headers.map((header) => (
                      <td
                        key={`${rowIndex}-${header.key}`}
                        className={cn(
                          'text-madhive-chalk/80 text-tv-sm',
                          isCompact ? 'px-3 py-1.5' : 'px-4 py-3'
                        )}
                      >
                        {formatCellValue(row[header.key], header.type)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timestamp footer */}
      {tableData?.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40">
            Updated: {new Date(tableData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
