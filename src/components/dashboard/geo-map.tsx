'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, MapPin, Crosshair } from 'lucide-react';

// ---- Configurable Map Area ----
// Change these bounds to show a different region.
// Coordinates are in decimal degrees (WGS84).
// Examples:
//   Nigeria:     { minLat: 4.0, maxLat: 14.0, minLng: 2.5, maxLng: 15.0, label: 'Nigeria' }
//   Lagos:       { minLat: 6.3, maxLat: 6.7, minLng: 3.2, maxLng: 3.5, label: 'Lagos' }
//   Abuja FCT:   { minLat: 8.8, maxLat: 9.2, minLng: 7.2, maxLng: 7.7, label: 'Abuja FCT' }
//   Kano:        { minLat: 11.8, maxLat: 12.4, minLng: 8.3, maxLng: 8.9, label: 'Kano' }
//   Rivers:      { minLat: 4.5, maxLat: 5.2, minLng: 6.5, maxLng: 7.1, label: 'Rivers' }
//   Southeast:   { minLat: 4.8, maxLat: 7.0, minLng: 6.8, maxLng: 8.2, label: 'Southeast' }
//   Southwest:   { minLat: 6.0, maxLat: 9.0, minLng: 2.5, maxLng: 5.0, label: 'Southwest' }
//   Northwest:   { minLat: 10.0, maxLat: 14.0, minLng: 3.0, maxLng: 9.0, label: 'Northwest' }

interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  label: string;
}

const DEFAULT_MAP_BOUNDS: MapBounds = {
  minLat: 4.0,
  maxLat: 14.0,
  minLng: 2.5,
  maxLng: 15.0,
  label: 'Nigeria',
};

const NIGERIA_OUTLINE = '30,80 35,65 25,55 30,40 40,30 50,20 60,15 70,20 80,25 85,35 75,50 80,60 70,75 55,80 40,85';

// ---- Types ----
interface MapPoint {
  id: string;
  name: string;
  code: string;
  state: string;
  lga: string;
  lat: number;
  lng: number;
  registered: number;
  votes: number;
  turnout: number;
  status: string;
}

interface GeoMapViewProps {
  points: MapPoint[];
  bounds?: MapBounds;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---- Helpers ----
function project(lat: number, lng: number, w: number, h: number, area: MapBounds) {
  const x = ((lng - area.minLng) / (area.maxLng - area.minLng)) * w;
  const y = ((area.maxLat - lat) / (area.maxLat - area.minLat)) * h;
  return { x, y };
}

function getTurnoutColor(turnout: number) {
  if (turnout >= 0.5) return 'rgba(16, 185, 129, 0.8)';
  if (turnout >= 0.3) return 'rgba(245, 158, 11, 0.8)';
  return 'rgba(244, 63, 94, 0.7)';
}

function getStatusStroke(status: string) {
  switch (status) {
    case 'OPEN': return 'oklch(0.7 0.15 160)';
    case 'CLOSED': return 'oklch(0.5 0.01 260)';
    case 'FLAGGED': return 'oklch(0.65 0.22 25)';
    default: return 'oklch(0.75 0.15 85)';
  }
}

const FULL_VB: ViewBox = { x: 0, y: 0, w: 100, h: 100 };
const ZOOM_FACTOR = 1.3;
const ZOOM_MIN_VB = 5;   // viewBox width/height at max zoom
const ZOOM_MAX_VB = 100; // full view

// ---- Main Component ----
export function GeoMapView({ points, bounds: propBounds }: GeoMapViewProps) {
  const area = propBounds || DEFAULT_MAP_BOUNDS;

  // SVG viewBox state — controls zoom & pan
  const [vb, setVb] = useState<ViewBox>({ ...FULL_VB });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ mx: 0, my: 0, vbx: 0, vby: 0 });
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Project points into 0-100 SVG coordinate space
  const projected = useMemo(() => {
    const w = 100, h = 100;
    return points.map(p => {
      const { x, y } = project(p.lat, p.lng, w, h, area);
      return { ...p, px: x, py: y };
    });
  }, [points, area]);

  const selectedPoint = selectedId ? projected.find(p => p.id === selectedId) : null;
  const hoveredPoint = hoveredId ? projected.find(p => p.id === hoveredId) : null;

  // Current zoom level (1x = full view, higher = more zoomed)
  const zoomLevel = Math.round((ZOOM_MAX_VB / vb.w) * 100) / 100;

  // ---- Zoom helpers ----
  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    setVb(prev => {
      const newW = Math.min(Math.max(prev.w / factor, ZOOM_MIN_VB), ZOOM_MAX_VB);
      const newH = Math.min(Math.max(prev.h / factor, ZOOM_MIN_VB), ZOOM_MAX_VB);
      // Keep the point under cursor stable
      const ratioX = (cx - prev.x) / prev.w;
      const ratioY = (cy - prev.y) / prev.h;
      const newX = cx - ratioX * newW;
      const newY = cy - ratioY * newH;
      return { x: newX, y: newY, w: newW, h: newH };
    });
  }, []);

  const zoomIn = useCallback(() => {
    zoomAt(vb.x + vb.w / 2, vb.y + vb.h / 2, ZOOM_FACTOR);
  }, [vb, zoomAt]);

  const zoomOut = useCallback(() => {
    zoomAt(vb.x + vb.w / 2, vb.y + vb.h / 2, 1 / ZOOM_FACTOR);
  }, [vb, zoomAt]);

  const resetView = useCallback(() => {
    setVb({ ...FULL_VB });
  }, []);

  // ---- Wheel zoom (non-passive listener) ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      // Convert mouse position to SVG coordinates
      const rect = el.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 100;
      const my = ((e.clientY - rect.top) / rect.height) * 100;
      // Adjust mx/my for current viewBox
      const svgX = vb.x + (mx / 100) * vb.w;
      const svgY = vb.y + (my / 100) * vb.h;
      const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
      zoomAt(svgX, svgY, factor);
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [vb, zoomAt]);

  // ---- Pan ----
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Don't pan if clicking a map point
    if ((e.target as Element).closest('[data-map-point]')) return;
    if (e.button !== 0) return;

    setIsPanning(true);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPanStart({
      mx: e.clientX,
      my: e.clientY,
      vbx: vb.x,
      vby: vb.y,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [vb]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (hoveredId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    if (!isPanning) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dx = (e.clientX - panStart.mx) / rect.width * vb.w;
    const dy = (e.clientY - panStart.my) / rect.height * vb.h;

    setVb(prev => ({
      ...prev,
      x: panStart.vbx - dx,
      y: panStart.vby - dy,
    }));
  }, [isPanning, panStart, vb.w, vb.h, hoveredId]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Point interactions
  const handlePointClick = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.key === '0') resetView();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomIn, zoomOut, resetView]);

  // SVG viewBox string
  const vbStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

  // Dynamic dot radius based on zoom
  const dotRadius = Math.max(0.5, Math.min(1.2, vb.w / 80));

  return (
    <div className="h-full flex flex-col">
      {/* Map header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold">{area.label} — Polling Unit Map</h3>
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald" /> Open</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber" /> Pending</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose" /> Flagged</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" /> Closed</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {points.length} units
          </span>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] bg-card/60 border-border text-muted-foreground">
            {zoomLevel.toFixed(1)}x
          </span>
        </div>
      </div>

      {/* Map area */}
      <div
        ref={containerRef}
        className="flex-1 relative map-grid overflow-hidden select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        {/* Single SVG with viewBox for zoom/pan */}
        <svg
          ref={svgRef}
          viewBox={vbStr}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background grid lines */}
          {[20, 40, 60, 80].map(v => (
            <g key={v} opacity="0.06">
              <line x1={v} y1={vb.y - 5} x2={v} y2={vb.y + vb.h + 5} stroke="white" strokeWidth="0.2" />
              <line x1={vb.x - 5} y1={v} x2={vb.x + vb.w + 5} y2={v} stroke="white" strokeWidth="0.2" />
            </g>
          ))}

          {/* Nigeria outline */}
          <polygon
            points={NIGERIA_OUTLINE}
            fill="none"
            stroke="oklch(0.35 0.01 260)"
            strokeWidth="0.3"
            strokeDasharray="1 0.5"
            opacity="0.5"
          />

          {/* Polling unit dots */}
          {projected.map((p, i) => {
            const isHovered = hoveredId === p.id;
            const isSelected = selectedId === p.id;
            const r = (isHovered || isSelected) ? dotRadius * 2 : dotRadius;

            return (
              <g key={p.id} data-map-point="true">
                {/* Pulse ring for flagged */}
                {p.status === 'FLAGGED' && (
                  <circle
                    cx={p.px} cy={p.py} r={r * 2.5}
                    fill="none" stroke="oklch(0.65 0.22 25)" strokeWidth="0.15" opacity="0.5"
                  >
                    <animate attributeName="r" values={`${r};${r * 3}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={p.px} cy={p.py} r={r * 2}
                    fill="none" stroke="oklch(0.7 0.15 160)" strokeWidth="0.2" opacity="0.8"
                  />
                )}
                {/* Hover ring */}
                {isHovered && !isSelected && (
                  <circle
                    cx={p.px} cy={p.py} r={r * 1.6}
                    fill="none" stroke="oklch(0.7 0.1 250)" strokeWidth="0.15" opacity="0.5"
                  />
                )}
                {/* Main dot */}
                <circle
                  cx={p.px}
                  cy={p.py}
                  r={r}
                  fill={getTurnoutColor(p.turnout)}
                  stroke={getStatusStroke(p.status)}
                  strokeWidth="0.2"
                  className="cursor-pointer"
                  opacity={0}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => handlePointClick(p.id, e)}
                >
                  <animate
                    attributeName="opacity"
                    from="0"
                    to="1"
                    dur="0.3s"
                    begin={`${i * 0.003}s`}
                    fill="freeze"
                  />
                </circle>
              </g>
            );
          })}

          {/* State labels — only show when zoomed out enough */}
          {vb.w > 30 && ['Lagos', 'Abuja FCT', 'Kano', 'Rivers', 'Enugu', 'Borno'].map(state => {
            const statePoints = projected.filter(p => p.state === state);
            if (!statePoints.length) return null;
            const avgX = statePoints.reduce((s, p) => s + p.px, 0) / statePoints.length;
            const avgY = statePoints.reduce((s, p) => s + p.py, 0) / statePoints.length;
            const fontSize = Math.max(0.8, Math.min(1.2, vb.w / 80));
            return (
              <text
                key={state}
                x={avgX}
                y={avgY - 1.5}
                textAnchor="middle"
                fontSize={fontSize}
                fill="oklch(0.5 0.01 260)"
                opacity="0.5"
                style={{ pointerEvents: 'none' }}
              >
                {state}
              </text>
            );
          })}
        </svg>

        {/* --- Overlay UI (not affected by zoom/pan) --- */}

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-card/90 backdrop-blur-sm border-border shadow-sm"
            onClick={(e) => { e.stopPropagation(); zoomIn(); }}
            disabled={vb.w <= ZOOM_MIN_VB}
            title="Zoom in (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-card/90 backdrop-blur-sm border-border shadow-sm"
            onClick={(e) => { e.stopPropagation(); zoomOut(); }}
            disabled={vb.w >= ZOOM_MAX_VB}
            title="Zoom out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="h-px bg-border" />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-card/90 backdrop-blur-sm border-border shadow-sm"
            onClick={(e) => { e.stopPropagation(); resetView(); setSelectedId(null); }}
            title="Fit all (0)"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-card/90 backdrop-blur-sm border-border shadow-sm"
            onClick={(e) => { e.stopPropagation(); resetView(); }}
            title="Reset (Esc)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom level indicator */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Crosshair className="h-3 w-3" />
            {area.label} · {zoomLevel.toFixed(1)}x
          </div>
        </div>

        {/* Hover tooltip */}
        {(hoveredPoint || selectedPoint) && !isPanning && (
          <div
            className="absolute z-20 pointer-events-none bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 space-y-1 max-w-[200px]"
            style={{
              left: `${Math.min(tooltipPos.x + 16, (containerRef.current?.clientWidth || 400) - 220)}px`,
              top: `${tooltipPos.y - 10}px`,
            }}
          >
            <p className="text-xs font-medium truncate">{(hoveredPoint || selectedPoint)!.name}</p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{(hoveredPoint || selectedPoint)!.state}/{(hoveredPoint || selectedPoint)!.lga}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className={cn(
                'font-semibold',
                (hoveredPoint || selectedPoint)!.turnout >= 0.5 ? 'text-emerald' : 'text-amber'
              )}>
                {Math.round((hoveredPoint || selectedPoint)!.turnout * 100)}% turnout
              </span>
              <span className="text-muted-foreground">{(hoveredPoint || selectedPoint)!.registered.toLocaleString()} reg</span>
              <span className="text-muted-foreground">{(hoveredPoint || selectedPoint)!.votes.toLocaleString()} votes</span>
            </div>
          </div>
        )}

        {/* Turnout heatmap legend */}
        <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2.5 space-y-1.5 z-10 pointer-events-none">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Turnout Heat</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[0.15, 0.3, 0.45, 0.6].map(t => (
                <div key={t} className="w-4 h-2.5 rounded-sm" style={{ backgroundColor: getTurnoutColor(t) }} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">Low → High</span>
          </div>
        </div>

        {/* Help hint */}
        <div className="absolute bottom-3 left-3 text-[9px] text-muted-foreground/40 z-10 pointer-events-none">
          Scroll to zoom · Drag to pan · Click point to select
        </div>
      </div>

      {/* Info bar for selected point */}
      {selectedPoint && (
        <div className="px-4 py-2.5 border-t border-border bg-card/60 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-muted-foreground">Selected: </span>
              <span className="font-medium">{selectedPoint.name}</span>
              <span className="text-muted-foreground ml-2">{selectedPoint.code}</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-muted-foreground">
              <span>{selectedPoint.state} / {selectedPoint.lga}</span>
              <span>Turnout: <span className={selectedPoint.turnout >= 0.5 ? 'text-emerald' : 'text-amber'}>{Math.round(selectedPoint.turnout * 100)}%</span></span>
              <span>Registered: {selectedPoint.registered.toLocaleString()}</span>
              <span>Votes: {selectedPoint.votes.toLocaleString()}</span>
            </div>
          </div>
          <span className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-medium',
            selectedPoint.status === 'OPEN' ? 'bg-emerald/15 text-emerald' :
            selectedPoint.status === 'FLAGGED' ? 'bg-rose/15 text-rose' :
            'bg-muted text-muted-foreground'
          )}>
            {selectedPoint.status}
          </span>
        </div>
      )}
    </div>
  );
}