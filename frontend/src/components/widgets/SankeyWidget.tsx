import { useEffect, useRef, useState } from 'react';
import {
  sankey,
  sankeyLinkHorizontal,
  SankeyGraph,
  SankeyNode,
  SankeyLink,
} from 'd3-sankey';
import { Card } from '@/components/ui/Card';
import { useWidgetData } from '@/hooks/useApi';
import type { WidgetConfig } from '@/types/dashboard';

interface SankeyData {
  nodes: { id: string; label: string }[];
  links: { source: string; target: string; value: number }[];
  timestamp: string;
}

interface SankeyWidgetProps {
  config: WidgetConfig;
}

// Extended node type for D3 sankey
interface ExtendedSankeyNode extends SankeyNode<{}, {}> {
  id?: string;
  label?: string;
}

// Extended link type for D3 sankey
interface ExtendedSankeyLink extends SankeyLink<ExtendedSankeyNode, {}> {
  value: number;
}

export function SankeyWidget({ config }: SankeyWidgetProps) {
  const { data, isLoading, error } = useWidgetData(config.id);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);

  // Type assertion for SankeyData
  const sankeyData = data as SankeyData | undefined;

  useEffect(() => {
    if (!sankeyData || !svgRef.current) return;

    const width = 800;
    const height = 500;
    const nodeWidth = 15;
    const nodePadding = 10;

    // Create a map of node IDs to indices
    const nodeMap = new Map<string, number>();
    sankeyData.nodes.forEach((node, i) => {
      nodeMap.set(node.id, i);
    });

    // Convert node IDs in links to indices
    const graphData: SankeyGraph<ExtendedSankeyNode, ExtendedSankeyLink> = {
      nodes: sankeyData.nodes.map((node) => ({
        id: node.id,
        label: node.label,
      })) as ExtendedSankeyNode[],
      links: sankeyData.links.map((link) => ({
        source: nodeMap.get(link.source)!,
        target: nodeMap.get(link.target)!,
        value: link.value,
      })) as ExtendedSankeyLink[],
    };

    // Create sankey generator
    const sankeyGenerator = sankey<ExtendedSankeyNode, ExtendedSankeyLink>()
      .nodeWidth(nodeWidth)
      .nodePadding(nodePadding)
      .extent([
        [1, 1],
        [width - 1, height - 5],
      ]);

    // Generate the sankey layout
    const { nodes, links } = sankeyGenerator(graphData);

    // Clear previous content safely
    const svg = svgRef.current;
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Create SVG groups
    const svgElement = svg as unknown as SVGSVGElement;
    const ns = 'http://www.w3.org/2000/svg';

    // Draw links
    links.forEach((link, index) => {
      const path = document.createElementNS(ns, 'path');
      const linkPath = sankeyLinkHorizontal();
      path.setAttribute('d', linkPath(link as any) || '');
      path.setAttribute('stroke', '#FF9BD3');
      path.setAttribute('stroke-opacity', hoveredLink === index ? '0.7' : '0.4');
      path.setAttribute('stroke-width', String(Math.max(1, link.width || 1)));
      path.setAttribute('fill', 'none');
      path.setAttribute('class', 'transition-all duration-200 cursor-pointer');

      path.addEventListener('mouseenter', () => setHoveredLink(index));
      path.addEventListener('mouseleave', () => setHoveredLink(null));

      svgElement.appendChild(path);
    });

    // Draw nodes
    nodes.forEach((node) => {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(node.x0 || 0));
      rect.setAttribute('y', String(node.y0 || 0));
      rect.setAttribute('width', String((node.x1 || 0) - (node.x0 || 0)));
      rect.setAttribute('height', String((node.y1 || 0) - (node.y0 || 0)));
      rect.setAttribute('fill', hoveredNode === node.id ? '#FF9BD3' : '#8B5CF6');
      rect.setAttribute('stroke', '#fff');
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('class', 'transition-all duration-200 cursor-pointer');

      rect.addEventListener('mouseenter', () => setHoveredNode(node.id || null));
      rect.addEventListener('mouseleave', () => setHoveredNode(null));

      svgElement.appendChild(rect);

      // Add node labels
      const text = document.createElementNS(ns, 'text');
      const x = (node.x0 || 0) < width / 2 ? (node.x1 || 0) + 6 : (node.x0 || 0) - 6;
      const y = ((node.y1 || 0) + (node.y0 || 0)) / 2;
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(y));
      text.setAttribute('dy', '0.35em');
      text.setAttribute('text-anchor', (node.x0 || 0) < width / 2 ? 'start' : 'end');
      text.setAttribute('fill', '#E5E7EB');
      text.setAttribute('font-size', '12px');
      text.setAttribute('font-weight', '600');
      text.setAttribute('class', 'pointer-events-none');
      text.textContent = node.label || node.id || '';

      svgElement.appendChild(text);
    });
  }, [sankeyData, hoveredNode, hoveredLink]);

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

  if (!sankeyData || !sankeyData.nodes || !sankeyData.links) {
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

      {/* Sankey diagram */}
      <div className="flex-1 overflow-auto">
        <svg
          ref={svgRef}
          width={800}
          height={500}
          className="mx-auto"
          style={{ minWidth: '800px', minHeight: '500px' }}
        />

        {/* Hover info */}
        {(hoveredNode || hoveredLink !== null) && (
          <div className="mt-2 text-center">
            {hoveredNode && (
              <p className="text-tv-sm text-madhive-pink font-semibold">
                Node: {sankeyData.nodes.find((n) => n.id === hoveredNode)?.label}
              </p>
            )}
            {hoveredLink !== null && sankeyData.links[hoveredLink] && (
              <p className="text-tv-sm text-madhive-chalk/80">
                {sankeyData.links[hoveredLink].source} →{' '}
                {sankeyData.links[hoveredLink].target}:{' '}
                <span className="text-madhive-pink font-semibold">
                  {sankeyData.links[hoveredLink].value}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Timestamp footer */}
      {sankeyData.timestamp && (
        <div className="mt-4 pt-4 border-t border-madhive-purple-medium/30">
          <p className="text-tv-xs text-madhive-chalk/40 text-center">
            Updated: {new Date(sankeyData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Card>
  );
}
