'use client';

import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/* Bypass missing leaflet type declarations (no @types/leaflet, leaflet v1.9.4 has no .d.ts).
   react-leaflet props that originate from leaflet types (MapOptions, CircleMarkerOptions)
   are invisible without proper leaflet types. */
const LooseMapContainer = MapContainer as unknown as React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>;
const LooseCircleMarker = CircleMarker as unknown as React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>;

interface GeofenceZone {
  id: string;
  name: string;
  state: string;
  lga: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  pollingUnitIds: string[];
  assignedAgentIds: string[];
  isActive: boolean;
  checkInIntervalMin: number;
  maxMissedCheckIns: number;
  createdAt: string;
}

interface CheckIn {
  id: string;
  agentId: string;
  geofenceZoneId: string;
  status: 'CHECKED_IN' | 'CHECKED_OUT' | 'SOS_TRIGGERED' | 'EXPIRED';
  latitude: number;
  longitude: number;
  isInsideZone: boolean;
  batteryLevel: number | null;
  networkType: string | null;
  accuracyMeters: number | null;
  notes: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  agentName: string;
  zoneName: string;
}

interface DeadMansSwitch {
  id: string;
  agentId: string;
  geofenceZoneId: string;
  isActive: boolean;
  checkInDeadline: string;
  lastCheckInAt: string | null;
  missedCheckIns: number;
  escalationLevel: number;
  autoSOSTriggered: boolean;
  resolvedAt: string | null;
  agentName: string;
  zoneName: string | null;
  isOverdue: boolean;
}

interface AgentSafety {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  isLocked: boolean;
  biometricRiskScore: number | null;
  deviceTrustScore: number | null;
  hasActiveSwitch: boolean;
  switchEscalation: number;
  isOverdue: boolean;
  lastCheckInAt: string | null;
  lastCheckInStatus: string | null;
}

interface GeofenceData {
  zones: GeofenceZone[];
  checkIns: CheckIn[];
  switches: DeadMansSwitch[];
  agentSafety: AgentSafety[];
}

function FitBoundsOnLoad({ zones }: { zones: GeofenceZone[] }) {
  const map = useMap();
  useEffect(() => {
    const active = zones.filter(z => z.isActive && z.centerLat && z.centerLng);
    if (active.length === 0) return;
    const lats = active.map(z => z.centerLat);
    const lngs = active.map(z => z.centerLng);
    const bounds: [number, number][] = [
      [Math.min(...lats) - 0.02, Math.min(...lngs) - 0.02],
      [Math.max(...lats) + 0.02, Math.max(...lngs) + 0.02],
    ];
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 11 });
  }, [map, zones]);
  return null;
}

export function AgentMiniMap({ data }: { data: GeofenceData }) {
  const activeZones = useMemo(() => data.zones.filter(z => z.isActive), [data.zones]);

  const zoneStatus = useMemo(() => {
    const m: Record<string, { color: string; label: string }> = {};
    for (const zone of activeZones) {
      const hasSOS = data.checkIns.some(c => c.geofenceZoneId === zone.id && c.status === 'SOS_TRIGGERED');
      const switchData = data.switches.find(s => s.geofenceZoneId === zone.id && s.isActive);
      const isOverdue = switchData?.isOverdue ?? false;
      const hasAgentOnline = data.agentSafety.some(a => zone.assignedAgentIds.includes(a.id) && a.isOnline);

      if (hasSOS || switchData?.autoSOSTriggered) {
        m[zone.id] = { color: '#f43f5e', label: 'SOS' };
      } else if (isOverdue) {
        m[zone.id] = { color: '#f59e0b', label: 'Overdue' };
      } else if (hasAgentOnline) {
        m[zone.id] = { color: '#10b981', label: 'Checked In' };
      } else {
        m[zone.id] = { color: '#71717a', label: 'Offline' };
      }
    }
    return m;
  }, [activeZones, data.checkIns, data.switches, data.agentSafety]);

  const center: [number, number] = useMemo(() => {
    if (activeZones.length === 0) return [9.0, 8.0];
    const lats = activeZones.map(z => z.centerLat).filter(Boolean);
    const lngs = activeZones.map(z => z.centerLng).filter(Boolean);
    if (lats.length === 0) return [9.0, 8.0];
    return [
      lats.reduce((a, b) => a + b, 0) / lats.length,
      lngs.reduce((a, b) => a + b, 0) / lngs.length,
    ];
  }, [activeZones]);

  if (activeZones.length === 0) {
    return (
      <div className="h-[250px] md:h-56 flex items-center justify-center text-xs text-muted-foreground">
        No active zones to display
      </div>
    );
  }

  return (
    <LooseMapContainer
      center={center}
      zoom={8}
      className="w-full h-[250px] md:h-56"
      zoomControl={false}
      attributionControl={false}
      style={{ background: '#09090b' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FitBoundsOnLoad zones={activeZones} />
      {activeZones.map(zone => {
        const status = zoneStatus[zone.id];
        if (!status || !zone.centerLat || !zone.centerLng) return null;
        const isSOS = status.label === 'SOS';
        return (
          <LooseCircleMarker
            key={zone.id}
            center={[zone.centerLat, zone.centerLng] as [number, number]}
            radius={isSOS ? 10 : 7}
            pathOptions={{
              fillColor: status.color,
              fillOpacity: 0.8,
              color: status.color,
              weight: 2,
              opacity: 1,
            }}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <p className="font-semibold">{zone.name}</p>
                <p className="text-muted-foreground">{zone.state} / {zone.lga}</p>
                <p className="font-medium" style={{ color: status.color }}>{status.label}</p>
                <p className="text-muted-foreground">Agents: {zone.assignedAgentIds.length}</p>
              </div>
            </Popup>
          </LooseCircleMarker>
        );
      })}
    </LooseMapContainer>
  );
}