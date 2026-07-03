'use client';

import { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, Crosshair, MapPin } from 'lucide-react';

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

interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  label: string;
}

interface Props {
  points: MapPoint[];
  area: MapBounds;
  selectedId: string | null;
  onSelectPoint: (id: string | null) => void;
}

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

function BoundsController({ bounds }: { bounds: MapBounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      [[bounds.minLat, bounds.minLng], [bounds.maxLat, bounds.maxLng]],
      { padding: [20, 20], maxZoom: 12 },
    );
  }, [map, bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng]);
  return null;
}

function ClickAway({ onDeselect }: { onDeselect: () => void }) {
  useMapEvents({ click: () => onDeselect() });
  return null;
}

export function LeafletMapInner({ points, area, selectedId, onSelectPoint }: Props) {
  const mapCenter: [number, number] = useMemo(() => [
    (area.minLat + area.maxLat) / 2,
    (area.minLng + area.maxLng) / 2,
  ], [area.minLat, area.maxLat, area.minLng, area.maxLng]);

  // Fix Leaflet default icon
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
  }, []);

  return (
    <MapContainer
      center={mapCenter}
      zoom={6}
      className="absolute inset-0 w-full h-full z-0"
      zoomControl={false}
      attributionControl={false}
      style={{ background: '#09090b' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />
      <BoundsController bounds={area} />
      <ClickAway onDeselect={() => onSelectPoint(null)} />

      {points.map((p) => {
        const isSelected = selectedId === p.id;
        const isFlagged = p.status === 'FLAGGED';
        const radius = isSelected ? 9 : isFlagged ? 7 : 5;
        const fillOpacity = isSelected ? 0.95 : 0.75;
        const weight = isSelected ? 3 : 1.5;
        const color = getStatusColor(p.status);

        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={radius}
            pathOptions={{
              fillColor: getTurnoutColor(p.turnout),
              fillOpacity,
              color,
              weight,
              opacity: 1,
            }}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onSelectPoint(prev => prev === p.id ? null : p.id);
              },
            }}
          >
            <Popup>
              <div className="space-y-2 min-w-[180px]">
                <p className="font-semibold text-sm text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {p.state} / {p.lga}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <span className={p.turnout >= 0.5 ? 'text-emerald font-bold' : 'text-amber font-bold'}>
                    {Math.round(p.turnout * 100)}% turnout
                  </span>
                  <span className="text-muted-foreground">{p.registered.toLocaleString()} reg</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{p.votes.toLocaleString()} votes</span>
                  <span className={
                    p.status === 'OPEN' ? 'text-emerald' :
                    p.status === 'FLAGGED' ? 'text-rose' :
                    'text-muted-foreground'
                  }>
                    {p.status}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">Code: {p.code}</p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Overlay controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-[1000]">
        <Button
          variant="outline" size="icon"
          className="h-8 w-8 bg-card/90 backdrop-blur-sm border-border shadow-sm"
          onClick={(e) => { e.stopPropagation(); }}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline" size="icon"
          className="h-8 w-8 bg-card/90 backdrop-blur-sm border-border shadow-sm"
          onClick={(e) => { e.stopPropagation(); }}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="h-px bg-border" />
        <Button
          variant="outline" size="icon"
          className="h-8 w-8 bg-card/90 backdrop-blur-sm border-border shadow-sm"
          onClick={(e) => { e.stopPropagation(); }}
          title="Fit all"
          aria-label="Fit all markers"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="absolute top-3 left-3 z-[1000] pointer-events-none">
        <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Crosshair className="h-3 w-3" />
          {area.label} · OpenStreetMap
        </div>
      </div>
    </MapContainer>
  );
}