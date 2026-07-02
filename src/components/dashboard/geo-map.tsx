'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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
}

// Simple Mercator-like projection for Nigeria bounds
function project(lat: number, lng: number, w: number, h: number) {
  const minLat = 4.0, maxLat = 14.0, minLng = 2.5, maxLng = 15.0;
  const x = ((lng - minLng) / (maxLng - minLng)) * w;
  const y = ((maxLat - lat) / (maxLat - minLat)) * h;
  return { x, y };
}

function getStatusColor(status: string) {
  switch (status) {
    case 'OPEN': return 'bg-emerald';
    case 'CLOSED': return 'bg-muted-foreground/40';
    case 'FLAGGED': return 'bg-rose';
    default: return 'bg-amber';
  }
}

function getTurnoutColor(turnout: number) {
  if (turnout >= 0.5) return 'rgba(16, 185, 129, 0.8)';
  if (turnout >= 0.3) return 'rgba(245, 158, 11, 0.8)';
  return 'rgba(244, 63, 94, 0.7)';
}

export function GeoMapView({ points }: GeoMapViewProps) {
  const { bounds, projected } = useMemo(() => {
    const w = 100, h = 100;
    const proj = points.map(p => {
      const { x, y } = project(p.lat, p.lng, w, h);
      return { ...p, px: x, py: y };
    });
    return { bounds: { w, h }, projected: proj };
  }, [points]);

  const selectedPoint = projected[0]; // For info panel
  const hoveredPoint = null;

  return (
    <div className="h-full flex flex-col">
      {/* Map controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold">Nigeria — Polling Unit Map</h3>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald" /> Open</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber" /> Pending</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose" /> Flagged</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" /> Closed</span>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {points.length} polling units shown
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative map-grid overflow-hidden">
        {/* Nigeria outline hint (simplified polygon) */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <polygon
            points="30,80 35,65 25,55 30,40 40,30 50,20 60,15 70,20 80,25 85,35 75,50 80,60 70,75 55,80 40,85"
            fill="none"
            stroke="oklch(0.35 0.01 260)"
            strokeWidth="0.3"
            strokeDasharray="1 0.5"
            opacity="0.5"
          />
        </svg>

        {/* Points */}
        <svg viewBox={`0 0 ${bounds.w} ${bounds.h}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          {projected.map((p, i) => (
            <g key={p.id}>
              {/* Pulse ring for flagged */}
              {p.status === 'FLAGGED' && (
                <circle cx={p.px} cy={p.py} r="1.5" fill="none" stroke="oklch(0.65 0.22 25)" strokeWidth="0.15" opacity="0.5">
                  <animate attributeName="r" values="0.5;2" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Main dot */}
              <motion.circle
                cx={p.px}
                cy={p.py}
                r={hoveredPoint === p.id ? 1.2 : 0.7}
                fill={getTurnoutColor(p.turnout)}
                stroke={getStatusColor(p.status)}
                strokeWidth="0.2"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.003, duration: 0.3 }}
                className="cursor-pointer"
              />
            </g>
          ))}
        </svg>

        {/* State labels */}
        {['Lagos', 'Abuja FCT', 'Kano', 'Rivers', 'Enugu', 'Borno'].map(state => {
          const statePoints = projected.filter(p => p.state === state);
          if (!statePoints.length) return null;
          const avgX = statePoints.reduce((s, p) => s + p.px, 0) / statePoints.length;
          const avgY = statePoints.reduce((s, p) => s + p.py, 0) / statePoints.length;
          return (
            <div
              key={state}
              className="absolute text-[9px] font-medium text-muted-foreground/50 pointer-events-none"
              style={{ left: `${avgX}%`, top: `${avgY}%`, transform: 'translate(-50%, -50%)' }}
            >
              {state}
            </div>
          );
        })}

        {/* Turnout heatmap legend */}
        <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2.5 space-y-1.5">
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
      </div>

      {/* Info bar */}
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