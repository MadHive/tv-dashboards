import { useState, useEffect, useRef } from 'react';
import { fetchWidgetData } from '@lib/api';
import type { Widget } from '@lib/api';
import * as d3 from 'd3-selection';
import { hierarchy, treemap, treemapBinary } from 'd3-hierarchy';
import { scaleLinear } from 'd3-scale';

interface TreemapWidgetProps {
  widget: Widget;
  refreshInterval?: number;
}

interface TreemapChild {
  name: string;
  value: number;
  children?: TreemapChild[];
}

interface TreemapData {
  name: string;
  children: TreemapChild[];
  timestamp: string;
}

export default function TreemapWidget({
  widget,
  refreshInterval = 10000,
}: TreemapWidgetProps) {
  const [data, setData] = useState<TreemapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      setError(null);
      const result = await fetchWidgetData(widget.id);
      setData(result);
      setLoading(false);
    } catch (err) {
      console.error(`Failed to load data for widget ${widget.id}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [widget.id, refreshInterval]);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Create hierarchy
    const root = hierarchy(data)
      .sum((d: any) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    treemap()
      .size([width, height])
      .padding(2)
      .tile(treemapBinary)
      (root as any);

    // Color scale based on value
    const maxValue = Math.max(...root.leaves().map((d: any) => d.value || 0));
    const colorScale = scaleLinear<string>()
      .domain([0, maxValue / 2, maxValue])
      .range(['#3D1F5C', '#FF9BD3', '#FFD4EC']);

    // Draw rectangles
    const leaf = svg.selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

    leaf.append('rect')
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('fill', (d: any) => colorScale(d.value || 0))
      .attr('opacity', 0.8)
      .attr('stroke', '#1A0F2E')
      .attr('stroke-width', 2)
      .on('mouseenter', function() {
        d3.select(this).attr('opacity', 1);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 0.8);
      })
      .append('title')
      .text((d: any) => `${d.data.name}\n${d.value}`);

    // Add labels (only if rectangle is large enough)
    leaf.append('text')
      .attr('x', 4)
      .attr('y', 16)
      .attr('fill', '#F4DFFF')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text((d: any) => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        // Only show text if rectangle is large enough
        return (width > 50 && height > 30) ? d.data.name : '';
      });

    leaf.append('text')
      .attr('x', 4)
      .attr('y', 32)
      .attr('fill', '#F4DFFF')
      .attr('font-size', '10px')
      .attr('opacity', 0.8)
      .text((d: any) => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        return (width > 50 && height > 45) ? `${d.value}` : '';
      });

  }, [data]);

  if (loading) {
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
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-widget-id={widget.id}
        style={{
          gridColumn: `span ${widget.position.colSpan}`,
          gridRow: `span ${widget.position.rowSpan}`,
        }}
        className="bg-slate-800 border border-red-900 rounded-lg p-4 flex flex-col"
      >
        <h3 className="text-sm font-medium text-slate-400 mb-2">{widget.title}</h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="text-red-400 text-sm">Error loading treemap</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div
      data-widget-id={widget.id}
      style={{
        gridColumn: `span ${widget.position.colSpan}`,
        gridRow: `span ${widget.position.rowSpan}`,
      }}
      className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col hover:border-slate-600 transition-colors"
    >
      <h3 className="text-sm font-medium text-slate-400 mb-3">{widget.title}</h3>

      <div ref={containerRef} className="flex-1 min-h-0">
        <svg ref={svgRef} width="100%" height="100%" />
      </div>
    </div>
  );
}
