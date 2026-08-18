'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, Maximize2, MapPin, Crosshair, Zap } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard';

// ---- Configurable Map Area ----
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

interface LiveIncident {
  id: string;
  type: string;
  severity: string;
  description: string;
  gpsLat: number | null;
  gpsLng: number | null;
  status: string;
  submittedAt: string;
  pollingUnit?: { state: string; lga: string } | null;
}

interface GeoMapViewProps {
  points: MapPoint[];
  bounds?: MapBounds;
  /** Live incidents pushed via WebSocket */
  liveIncidents?: LiveIncident[];
}

// ---- Helpers ----
function getTurnoutColor(turnout: number) {
  if (turnout >= 0.5) return '#10b981';
  if (turnout >= 0.3) return '#f59e0b';
  return '#f43f5e';
}

function getStatusColor(status: string) {
  switch (status) {
    case 'OPEN': return '#10b981';
    case 'CLOSED': return '#71717a';
    case 'FLAGGED': return '#ef4444';
    default: return '#f59e0b';
  }
}

// ---- Map header + info bar (non-Leaflet, always renders) ----
function MapHeader({ area, pointCount, selectedPoint, onDeselect, liveIncidentCount }: {
  area: MapBounds;
  pointCount: number;
  selectedPoint: MapPoint | null;
  onDeselect: () => void;
  liveIncidentCount: number;
}) {
  const { wsConnected, wsTransport } = useDashboardStore();
  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{area.label} — Polling Unit Map</h3>
            {wsConnected && wsTransport === 'ws' && (
              <Badge className="text-[10px] h-5 bg-emerald/15 text-emerald border-emerald/30 gap-1">
                <Zap className="h-2.5 w-2.5" />LIVE
              </Badge>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald" /> Open</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber" /> Pending</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose" /> Flagged</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" /> Closed</span>
            {liveIncidentCount > 0 && (
              <span className="flex items-center gap-1.5 text-rose"><span className="w-2.5 h-2.5 rounded-full bg-rose animate-pulse" /> {liveIncidentCount} incidents</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">{pointCount} units</span>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] bg-card/60 border-border text-muted-foreground gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
            Live
          </span>
        </div>
      </div>
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
          <button onClick={onDeselect} className="text-muted-foreground hover:text-foreground text-[10px] underline">Deselect</button>
        </div>
      )}
    </>
  );
}

// ---- Dynamically loaded Leaflet map (SSR-safe) ----
const LeafletMapInner = dynamic(() => import('./geo-map-inner').then(m => ({ default: m.LeafletMapInner })), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground animate-pulse">Loading map...</div>
    </div>
  ),
});

// ---- Main Component ----
export function GeoMapView({ points, bounds: propBounds, liveIncidents }: GeoMapViewProps) {
  const area = propBounds || DEFAULT_MAP_BOUNDS;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPoint = selectedId ? points.find(p => p.id === selectedId) : null;

  return (
    <div className="h-full flex flex-col">
      <MapHeader
        area={area}
        pointCount={points.length}
        selectedPoint={selectedPoint ?? null}
        onDeselect={() => setSelectedId(null)}
        liveIncidentCount={liveIncidents?.filter(i => i.gpsLat && i.gpsLng)?.length || 0}
      />
      <div className="flex-1 relative overflow-hidden">
        <LeafletMapInner
          points={points}
          area={area}
          selectedId={selectedId}
          onSelectPoint={setSelectedId}
          liveIncidents={liveIncidents}
        />
        {/* Turnout heatmap legend */}
        <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2.5 space-y-1.5 z-[1000] pointer-events-none">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Turnout Heat</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[0.15, 0.3, 0.45, 0.6].map(t => (
                <div key={t} className="w-4 h-2.5 rounded-sm" style={{ backgroundColor: getTurnoutColor(t) }} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">Low to High</span>
          </div>
        </div>
        <div className="absolute bottom-3 left-3 text-[9px] text-muted-foreground/40 z-[999] pointer-events-none">
          Scroll to zoom · Drag to pan · Click marker for details
        </div>
      </div>
    </div>
  );
}