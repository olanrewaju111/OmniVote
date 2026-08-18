'use client';

import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const LooseMapContainer = MapContainer as unknown as React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>;
const LooseTileLayer = TileLayer as unknown as React.ComponentType<Record<string, unknown>>;
const LooseCircleMarker = CircleMarker as unknown as React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>;
const LooseMarker = Marker as unknown as React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>;

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, Maximize2, Crosshair, MapPin, ShieldAlert, AlertTriangle, Eye, Radio, Zap, Filter, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  /** Live incidents pushed via WebSocket */
  liveIncidents?: LiveIncident[];
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

function getIncidentSeverityColor(severity: string) {
  switch (severity) {
    case 'CRITICAL': return '#f43f5e';
    case 'HIGH': return '#f59e0b';
    case 'MEDIUM': return '#06b6d4';
    default: return '#10b981';
  }
}

function getIncidentTypeIcon(type: string) {
  switch (type) {
    case 'VIOLENCE': return '🚨';
    case 'BALLOT_STUFFING': return '⚠️';
    case 'DEEPFAKE_SUSPECT': return '🔍';
    case 'CIB_DETECTED': return '🤖';
    case 'GEO_ANOMALY': return '📍';
    case 'INTIMIDATION': return '🔥';
    default: return '📢';
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

function ZoomControls({ bounds }: { bounds: MapBounds }) {
  const map = useMap();
  return (
    <>
      <Button
        variant="outline" size="icon"
        className="h-10 w-10 md:h-8 md:w-8 bg-card/90 backdrop-blur-sm border-border shadow-sm"
        onClick={() => map.zoomIn()}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="outline" size="icon"
        className="h-10 w-10 md:h-8 md:w-8 bg-card/90 backdrop-blur-sm border-border shadow-sm"
        onClick={() => map.zoomOut()}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <div className="h-px bg-border" />
      <Button
        variant="outline" size="icon"
        className="h-10 w-10 md:h-8 md:w-8 bg-card/90 backdrop-blur-sm border-border shadow-sm"
        onClick={() => map.fitBounds(
          [[bounds.minLat, bounds.minLng], [bounds.maxLat, bounds.maxLng]],
          { padding: [20, 20], maxZoom: 12 },
        )}
        title="Fit all"
        aria-label="Fit all markers"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </>
  );
}

/** Pulsing incident markers on the map */
function IncidentMarker({ incident }: { incident: LiveIncident }) {
  if (!incident.gpsLat || !incident.gpsLng) return null;
  const color = getIncidentSeverityColor(incident.severity);
  const emoji = getIncidentTypeIcon(incident.type);
  const isCritical = incident.severity === 'CRITICAL';

  return (
    <LooseCircleMarker
      center={[incident.gpsLat, incident.gpsLng] as [number, number]}
      radius={isCritical ? 14 : 10}
      pathOptions={{
        fillColor: color,
        fillOpacity: 0.35,
        color,
        weight: 2,
        opacity: 0.8,
      }}
      interactive={true}
    >    
      <Popup>
        <div className="space-y-2 min-w-[200px]">
          <div className="flex items-center gap-2">
            <span className="text-lg">{emoji}</span>
            <div>
              <p className="font-semibold text-sm text-foreground">{incident.type.replace(/_/g, ' ')}</p>
              <Badge className={cn('text-[10px]', incident.severity === 'CRITICAL' ? 'bg-rose text-white' : 'bg-amber/15 text-amber')}>
                {incident.severity}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-foreground/80">{incident.description}</p>
          {incident.pollingUnit && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {incident.pollingUnit.state} / {incident.pollingUnit.lga}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">Status: {incident.status}</p>
        </div>
      </Popup>
    </LooseCircleMarker>
  );
}

/** Animated pulse ring for critical incidents */
function PulseRing({ incident }: { incident: LiveIncident }) {
  if (incident.severity !== 'CRITICAL' || !incident.gpsLat || !incident.gpsLng) return null;
  return (
    <LooseCircleMarker
      center={[incident.gpsLat, incident.gpsLng] as [number, number]}
      radius={20}
      pathOptions={{
        fillColor: '#f43f5e',
        fillOpacity: 0,
        color: '#f43f5e',
        weight: 1,
        opacity: 0.3,
        className: 'animate-ping' as any,
      }}
      interactive={false}
    />
  );
}

export function LeafletMapInner({ points, area, selectedId, onSelectPoint, liveIncidents }: Props) {
  const mapCenter: [number, number] = useMemo(() => [
    (area.minLat + area.maxLat) / 2,
    (area.minLng + area.maxLng) / 2,
  ], [area.minLat, area.maxLat, area.minLng, area.maxLng]);

  const [showIncidents, setShowIncidents] = useState(true);
  const incidentCount = liveIncidents?.length || 0;

  // Fix Leaflet default icon
  useEffect(() => {
    const iconProto = L.Icon.Default.prototype as Record<string, unknown>;
    delete iconProto._getIconUrl;
  }, []);

  return (
    <LooseMapContainer
      center={mapCenter}
      zoom={6}
      className="absolute inset-0 w-full h-full z-0"
      zoomControl={false}
      attributionControl={false}
      style={{ background: '#09090b' }}
    >
      <LooseTileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />
      <BoundsController bounds={area} />
      <ClickAway onDeselect={() => onSelectPoint(null)} />

      {/* Polling unit markers */}
      {points.map((p) => {
        const isSelected = selectedId === p.id;
        const isFlagged = p.status === 'FLAGGED';
        const radius = isSelected ? 9 : isFlagged ? 7 : 5;
        const fillOpacity = isSelected ? 0.95 : 0.75;
        const weight = isSelected ? 3 : 1.5;
        const color = getStatusColor(p.status);

        const markerEventHandlers = {
          click: (e: unknown) => {
            (e as { originalEvent?: { stopPropagation: () => void } }).originalEvent?.stopPropagation();
            onSelectPoint(selectedId === p.id ? null : p.id);
          },
        };

        return (
          <React.Fragment key={p.id}>
            <LooseCircleMarker
              center={[p.lat, p.lng] as [number, number]}
              radius={20}
              pathOptions={{ fillOpacity: 0, stroke: false, opacity: 0 }}
              eventHandlers={markerEventHandlers}
              interactive={true}
            />
            <LooseCircleMarker
              center={[p.lat, p.lng] as [number, number]}
              radius={radius}
              pathOptions={{
                fillColor: getTurnoutColor(p.turnout),
                fillOpacity,
                color,
                weight,
                opacity: 1,
              }}
              eventHandlers={markerEventHandlers}
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
            </LooseCircleMarker>
          </React.Fragment>
        );
      })}

      {/* Real-time incident markers */}
      {showIncidents && liveIncidents?.map((inc) => (
        <React.Fragment key={`inc-${inc.id}`}>
          <IncidentMarker incident={inc} />
          <PulseRing incident={inc} />
        </React.Fragment>
      ))}

      {/* Overlay controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-[1000]">
        <ZoomControls bounds={area} />
      </div>

      <div className="absolute top-3 left-3 z-[1000] pointer-events-none">
        <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Crosshair className="h-3 w-3" />
          {area.label} · OpenStreetMap
        </div>
      </div>

      {/* Live incidents layer toggle + count */}
      <div className="absolute bottom-3 left-3 z-[1000]">
        <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 flex items-center gap-3">
          <button
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors',
              showIncidents ? 'text-rose' : 'text-muted-foreground/50'
            )}
            onClick={() => setShowIncidents(!showIncidents)}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Incidents</span>
          </button>
          {incidentCount > 0 && (
            <Badge className="text-[10px] h-5 bg-rose/15 text-rose border-rose/30 gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose animate-pulse" />
              {incidentCount}
            </Badge>
          )}
          {showIncidents && incidentCount > 0 && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose" />Critical</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber" />High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan" />Medium</span>
            </div>
          )}
        </div>
      </div>
    </LooseMapContainer>
  );
}