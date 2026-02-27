import { useEffect, useRef, useState } from 'react';
import { hierarchy, treemap, HierarchyRectangularNode } from 'd3-hierarchy';
import { scaleLinear } from 'd3-scale';
import { Card } from '@/components/ui/Card';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';

interface TreemapData {
  name: string;
  children: {
    name: string;
    value: number;
    children?: { name: string; value: number }[];
  }[];
  timestamp: string;
}

interface TreemapWidgetProps {
  config: WidgetConfig;
}

interface TreeNode {
  name: string;
  value?: number;
  children?: TreeNode[];
}

// Type for nodes after treemap layout has been applied
type TreemapNode = HierarchyRectangularNode<TreeNode>;

export function TreemapWidget({ config }: TreemapWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Type assertion for TreemapData
  const treemapData = data as TreemapData | undefined;

  useEffect(() => {
    if (!treemapData || !svgRef.current) return;

    const width = 800;
    const height = 500;

    // Create hierarchy
    const root = hierarchy<TreeNode>(treemapData)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    const treemapLayout = treemap<TreeNode>()
      .size([width, height])
      .padding(1)
      .round(true);

    const treemapRoot = treemapLayout(root) as TreemapNode;

    // Calculate color scale based on depth and value
    const leaves = treemapRoot.leaves() as TreemapNode[];
    const maxValue = Math.max(...leaves.map((d) => d.value || 0));
    const minValue = Math.min(...leaves.map((d) => d.value || 0));

    const colorScale = scaleLinear<string>()
      .domain([minValue, maxValue])
      .range(['#8B5CF6', '#FF9BD3']); // Purple to pink

    // Clear previous content safely
    const svg = svgRef.current;
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const svgElement = svg as unknown as SVGSVGElement;
    const ns = 'http://www.w3.org/2000/svg';

    // Create a group for all treemap cells
    const group = document.createElementNS(ns, 'g');
    svgElement.appendChild(group);

    // Draw treemap cells
    leaves.forEach((node: TreemapNode) => {
      const cell = document.createElementNS(ns, 'g');
      cell.setAttribute('class', 'treemap-cell');

      // Create rectangle
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(node.x0 || 0));
      rect.setAttribute('y', String(node.y0 || 0));
      rect.setAttribute('width', String((node.x1 || 0) - (node.x0 || 0)));
      rect.setAttribute('height', String((node.y1 || 0) - (node.y0 || 0)));
      rect.setAttribute('fill', colorScale(node.value || 0));
      rect.setAttribute('stroke', '#fff');
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('class', 'transition-all duration-200 cursor-pointer');

      if (hoveredNode === node.data.name) {
        rect.setAttribute('opacity', '1');
        rect.setAttribute('stroke', '#FFD700');
        rect.setAttribute('stroke-width', '3');
      } else {
        rect.setAttribute('opacity', '0.9');
      }

      rect.addEventListener('mouseenter', () => setHoveredNode(node.data.name));
      rect.addEventListener('mouseleave', () => setHoveredNode(null));

      cell.appendChild(rect);

      // Add text label if there's enough space
      const cellWidth = (node.x1 || 0) - (node.x0 || 0);
      const cellHeight = (node.y1 || 0) - (node.y0 || 0);

      if (cellWidth > 60 && cellHeight > 30) {
        // Add name label
        const nameText = document.createElementNS(ns, 'text');
        nameText.setAttribute('x', String((node.x0 || 0) + cellWidth / 2));
        nameText.setAttribute('y', String((node.y0 || 0) + cellHeight / 2 - 8));
        nameText.setAttribute('text-anchor', 'middle');
        nameText.setAttribute('fill', '#fff');
        nameText.setAttribute('font-size', '12px');
        nameText.setAttribute('font-weight', '600');
        nameText.setAttribute('class', 'pointer-events-none');
        nameText.textContent = node.data.name;
        cell.appendChild(nameText);

        // Add value label
        const valueText = document.createElementNS(ns, 'text');
        valueText.setAttribute('x', String((node.x0 || 0) + cellWidth / 2));
        valueText.setAttribute('y', String((node.y0 || 0) + cellHeight / 2 + 10));
        valueText.setAttribute('text-anchor', 'middle');
        valueText.setAttribute('fill', '#fff');
        valueText.setAttribute('font-size', '14px');
        valueText.setAttribute('font-weight', 'bold');
        valueText.setAttribute('class', 'pointer-events-none');
        valueText.textContent = String(node.value || 0);
        cell.appendChild(valueText);
      } else if (cellWidth > 40 && cellHeight > 20) {
        // Only show value if space is limited
        const valueText = document.createElementNS(ns, 'text');
        valueText.setAttribute('x', String((node.x0 || 0) + cellWidth / 2));
        valueText.setAttribute('y', String((node.y0 || 0) + cellHeight / 2 + 5));
        valueText.setAttribute('text-anchor', 'middle');
        valueText.setAttribute('fill', '#fff');
        valueText.setAttribute('font-size', '11px');
        valueText.setAttribute('font-weight', '600');
        valueText.setAttribute('class', 'pointer-events-none');
        valueText.textContent = String(node.value || 0);
        cell.appendChild(valueText);
      }

      group.appendChild(cell);
    });
  }, [treemapData, hoveredNode]);

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-4 text-center">
          <div className="h-96 w-full bg-madhive-purple-medium/50 rounded" />
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

  if (!treemapData || !treemapData.children) {
    return (
      <Card className="flex items-center justify-center h-full">
        <p className="text-madhive-chalk/60 text-tv-base">No data available</p>
      </Card>
    );
  }

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

      {/* Treemap */}
      <div className="flex-1 overflow-auto">
        <svg
          ref={svgRef}
          width={800}
          height={500}
          className="mx-auto"
          style={{ minWidth: '800px', minHeight: '500px' }}
        />

        {/* Hover info */}
        {hoveredNode && (
          <div className="mt-2 text-center">
            <p className="text-tv-sm text-madhive-pink font-semibold">
              {hoveredNode}
            </p>
          </div>
        )}
      </div>

      {/* Color legend */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded" style={{ backgroundColor: '#8B5CF6' }} />
          <span className="text-tv-xs text-madhive-chalk/60">Lower values</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded" style={{ backgroundColor: '#FF9BD3' }} />
          <span className="text-tv-xs text-madhive-chalk/60">Higher values</span>
        </div>
      </div>

      {/* Timestamp footer */}
      {treemapData.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(treemapData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
