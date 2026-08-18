'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { GitBranch, ArrowRight } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SankeyNode {
  id: string;
  label: string;
  color?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  label?: string;
}

export interface SankeyFlowProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  title?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
  onNodeHover?: (nodeId: string | null) => void;
}

// ─── Default Colors ──────────────────────────────────────────────────────────

const FLOW_COLORS = ['#008751', '#1E88E5', '#E53935', '#FDD835', '#8E24AA', '#FF6F00', '#00ACC1', '#43A047'];

// ─── Layout Engine ───────────────────────────────────────────────────────────

interface LayoutNode extends SankeyNode {
  x: number;
  y: number;
  height: number;
  column: number;
}

interface LayoutLink {
  source: LayoutNode;
  target: LayoutNode;
  value: number;
  label?: string;
  path: string;
  color: string;
  opacity: number;
}

function computeSankeyLayout(
  nodes: SankeyNode[],
  links: SankeyLink[],
  width: number,
  height: number,
  hoveredNode: string | null,
): { layoutNodes: LayoutNode[]; layoutLinks: LayoutLink[] } {
  if (nodes.length === 0 || links.length === 0) {
    return { layoutNodes: [], layoutLinks: [] };
  }

  const nodeMap = new Map(nodes.map((n, i) => ({ ...n, color: n.color || FLOW_COLORS[i % FLOW_COLORS.length] })));

  // Determine columns (topological ordering)
  const targets = new Set(links.map(l => l.target));
  const sources = new Set(links.map(l => l.source));
  const sourceNodes = nodes.filter(n => !targets.has(n.id));
  const sinkNodes = nodes.filter(n => !sources.has(n.id));
  const middleNodes = nodes.filter(n => targets.has(n.id) && sources.has(n.id));

  const columns: SankeyNode[][] = [sourceNodes, middleNodes.length > 0 ? middleNodes : [], sinkNodes].filter(c => c.length > 0);

  const PAD_X = 100;
  const PAD_Y = 30;
  const usableWidth = width - PAD_X * 2;
  const usableHeight = height - PAD_Y * 2;

  // Compute node sizes proportional to flow
  const nodeFlow = new Map<string, number>();
  links.forEach(l => {
    nodeFlow.set(l.source, (nodeFlow.get(l.source) || 0) + l.value);
    nodeFlow.set(l.target, (nodeFlow.get(l.target) || 0) + l.value);
  });
  const totalFlow = [...nodeFlow.values()].reduce((a, b) => a + b, 0) / 2;

  // Layout each column
  const layoutNodes: LayoutNode[] = [];
  const columnXPositions = columns.length <= 1
    ? [PAD_X]
    : columns.map((_, i) => PAD_X + (usableWidth * i) / (columns.length - 1));

  columns.forEach((colNodes, colIdx) => {
    const colTotal = colNodes.reduce((s, n) => s + (nodeFlow.get(n.id) || 0), 0);
    const scale = colTotal > 0 ? usableHeight / colTotal : 1;
    let yOffset = PAD_Y;

    colNodes.forEach(n => {
      const flow = nodeFlow.get(n.id) || 0;
      const h = Math.max(12, flow * scale);
      const node = nodeMap.get(n.id)!;
      layoutNodes.push({
        ...node,
        x: columnXPositions[colIdx],
        y: yOffset,
        height: h,
        column: colIdx,
      });
      yOffset += h + 8; // 8px gap between nodes
    });
  });

  const layoutNodeMap = new Map(layoutNodes.map(n => [n.id, n]));

  // Build links with SVG paths
  const layoutLinks: LayoutLink[] = links.map(l => {
    const source = layoutNodeMap.get(l.source);
    const target = layoutNodeMap.get(l.target);
    if (!source || !target) return null as any;

    const x0 = source.x + 120; // right edge of node rect
    const y0 = source.y + source.height / 2;
    const x1 = target.x; // left edge of target node rect
    const y1 = target.y + target.height / 2;
    const cx = (x0 + x1) / 2;

    const isHighlighted = hoveredNode === l.source || hoveredNode === l.target;
    const isDimmed = hoveredNode !== null && !isHighlighted;

    return {
      source,
      target,
      value: l.value,
      label: l.label,
      path: `M ${x0},${y0} C ${cx},${y0} ${cx},${y1} ${x1},${y1}`,
      color: source.color || '#888',
      opacity: isDimmed ? 0.08 : isHighlighted ? 0.55 : 0.25,
    };
  }).filter(Boolean);

  return { layoutNodes, layoutLinks };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SankeyFlow({
  nodes,
  links,
  title = 'Voter Flow',
  height = 360,
  valueFormatter,
  onNodeHover,
}: SankeyFlowProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });

  // Measure container
  React.useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      setDimensions({ width: Math.max(300, width), height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const { layoutNodes, layoutLinks } = useMemo(
    () => computeSankeyLayout(nodes, links, dimensions.width, dimensions.height, hoveredNode),
    [nodes, links, dimensions, hoveredNode],
  );

  const handleNodeHover = useCallback((id: string | null) => {
    setHoveredNode(id);
    onNodeHover?.(id);
  }, [onNodeHover]);

  const fmt = useCallback((v: number) => valueFormatter ? valueFormatter(v) : v.toLocaleString(), [valueFormatter]);

  // Total flow value for percentage calculation
  const totalSource = useMemo(() => {
    const sourceIds = new Set(links.map(l => l.source));
    return links.filter(l => sourceIds.has(l.source)).reduce((s, l) => s + l.value, 0);
  }, [links]);

  return (
    <Card className="border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-violet" />
          {title}
          <span className="text-[10px] font-normal text-muted-foreground">
            {nodes.length} nodes · {links.length} flows
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nodes.length === 0 || links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <GitBranch className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No flow data</p>
            <p className="text-xs mt-1 opacity-60">Connect nodes with links to visualize voter flow</p>
          </div>
        ) : (
          <div ref={svgRef}>
            <svg width="100%" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} className="overflow-visible">
              {/* Links */}
              {layoutLinks.map((link, i) => (
                <g key={`${link.source.id}-${link.target.id}-${i}`}>
                  <path
                    d={link.path}
                    fill="none"
                    stroke={link.color}
                    strokeWidth={Math.max(2, Math.min(20, (link.value / totalSource) * dimensions.height * 0.6))}
                    strokeOpacity={link.opacity}
                    className="transition-opacity duration-200"
                  />
                </g>
              ))}

              {/* Nodes */}
              {layoutNodes.map(node => {
                const isHovered = hoveredNode === node.id;
                const isConnected = hoveredNode === null ||
                  layoutLinks.some(l => (l.source.id === hoveredNode && l.target.id === node.id) ||
                    (l.target.id === hoveredNode && l.source.id === node.id));
                const nodeOpacity = hoveredNode === null ? 1 : isConnected ? 1 : 0.3;

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer transition-opacity duration-200"
                    style={{ opacity: nodeOpacity }}
                    onMouseEnter={() => handleNodeHover(node.id)}
                    onMouseLeave={() => handleNodeHover(null)}
                  >
                    {/* Node rectangle */}
                    <rect
                      x={node.x}
                      y={node.y}
                      width={120}
                      height={node.height}
                      rx={4}
                      fill={node.color}
                      fillOpacity={isHovered ? 0.9 : 0.7}
                      stroke={isHovered ? '#ffffff' : 'transparent'}
                      strokeWidth={2}
                    />
                    {/* Label */}
                    <text
                      x={node.x + 60}
                      y={node.y + node.height / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize={node.height > 30 ? 11 : 9}
                      fontWeight={600}
                      className="pointer-events-none select-none"
                    >
                      {node.label}
                    </text>
                    {/* Value on hover */}
                    {isHovered && node.height > 25 && (
                      <text
                        x={node.x + 60}
                        y={node.y + node.height / 2 + 12}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.7)"
                        fontSize={8}
                        className="pointer-events-none select-none"
                      >
                        {fmt(layoutLinks.filter(l => l.source.id === node.id).reduce((s, l) => s + l.value, 0))}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
