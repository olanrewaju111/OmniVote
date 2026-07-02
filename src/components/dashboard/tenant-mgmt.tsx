'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Building2, Users, Activity, Plus, Settings, Shield, Vote,
  Loader2, MapPin, Save, RotateCcw,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useDashboardStore } from '@/store/dashboard';
import type { ElectionTier } from '@/store/dashboard';

const TIER_BADGE: Record<ElectionTier, string> = {
  PRESIDENTIAL: 'border-violet/30 text-violet bg-violet/10',
  STATE: 'border-amber/30 text-amber bg-amber/10',
  LOCAL: 'border-cyan/30 text-cyan bg-cyan/10',
};

const TIER_LABEL: Record<ElectionTier, string> = {
  PRESIDENTIAL: 'Presidential',
  STATE: 'Governorship',
  LOCAL: 'Local Gov',
};

// Preset regions for quick selection
const REGION_PRESETS = [
  { label: 'Nigeria (full)', minLat: 4.0, maxLat: 14.0, minLng: 2.5, maxLng: 15.0 },
  { label: 'Lagos', minLat: 6.3, maxLat: 6.7, minLng: 3.2, maxLng: 3.5 },
  { label: 'Abuja FCT', minLat: 8.8, maxLat: 9.2, minLng: 7.2, maxLng: 7.7 },
  { label: 'Kano', minLat: 11.8, maxLat: 12.4, minLng: 8.3, maxLng: 8.9 },
  { label: 'Rivers', minLat: 4.5, maxLat: 5.2, minLng: 6.5, maxLng: 7.1 },
  { label: 'Southeast', minLat: 4.8, maxLat: 7.0, minLng: 6.8, maxLng: 8.2 },
  { label: 'Southwest', minLat: 6.0, maxLat: 9.0, minLng: 2.5, maxLng: 5.0 },
  { label: 'Northwest', minLat: 10.0, maxLat: 14.0, minLng: 3.0, maxLng: 9.0 },
  { label: 'North-Central', minLat: 7.0, maxLat: 10.5, minLng: 3.0, maxLng: 9.5 },
  { label: 'South-South', minLat: 4.3, maxLat: 6.5, minLng: 5.0, maxLng: 8.5 },
  { label: 'Northeast', minLat: 8.0, maxLat: 14.0, minLng: 10.0, maxLng: 15.0 },
];

interface MapBoundsData {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  label: string;
}

export function TenantManagement() {
  const { user, tenantId } = useDashboardStore();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN';

  // Fetch current tenant settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: () => fetch(`/api/tenant-settings?tenantId=${tenantId}`).then(r => r.json()),
    enabled: !!tenantId && isAdmin,
  });

  const currentBounds: MapBoundsData | null = settings?.mapBounds || null;

  // Map config dialog
  const [mapConfigOpen, setMapConfigOpen] = useState(false);
  const [mapLabel, setMapLabel] = useState('');
  const [minLat, setMinLat] = useState('');
  const [maxLat, setMaxLat] = useState('');
  const [minLng, setMinLng] = useState('');
  const [maxLng, setMaxLng] = useState('');

  // Populate form when dialog opens
  useEffect(() => {
    if (mapConfigOpen && currentBounds) {
      setMapLabel(currentBounds.label || '');
      setMinLat(String(currentBounds.minLat));
      setMaxLat(String(currentBounds.maxLat));
      setMinLng(String(currentBounds.minLng));
      setMaxLng(String(currentBounds.maxLng));
    } else if (mapConfigOpen) {
      setMapLabel('');
      setMinLat(''); setMaxLat(''); setMinLng(''); setMaxLng('');
    }
  }, [mapConfigOpen, currentBounds]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (bounds: MapBoundsData) =>
      fetch('/api/tenant-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapBounds: bounds }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setMapConfigOpen(false);
      toast.success('Map area configuration saved. Refresh the map tab to see changes.');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to save map configuration');
    },
  });

  const handleSaveMap = () => {
    const minLatN = parseFloat(minLat);
    const maxLatN = parseFloat(maxLat);
    const minLngN = parseFloat(minLng);
    const maxLngN = parseFloat(maxLng);

    if ([minLatN, maxLatN, minLngN, maxLngN].some(isNaN)) {
      toast.error('All coordinates must be valid numbers');
      return;
    }
    if (minLatN >= maxLatN || minLngN >= maxLngN) {
      toast.error('minLat must be < maxLat, and minLng must be < maxLng');
      return;
    }

    saveMutation.mutate({
      minLat: minLatN,
      maxLat: maxLatN,
      minLng: minLngN,
      maxLng: maxLngN,
      label: mapLabel || 'Custom Area',
    });
  };

  const handlePreset = (preset: typeof REGION_PRESETS[number]) => {
    setMapLabel(preset.label);
    setMinLat(String(preset.minLat));
    setMaxLat(String(preset.maxLat));
    setMinLng(String(preset.minLng));
    setMaxLng(String(preset.maxLng));
  };

  const handleResetMap = () => {
    saveMutation.mutate({ minLat: 4.0, maxLat: 14.0, minLng: 2.5, maxLng: 15.0, label: 'Nigeria' });
  };

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Access restricted to Super Admin and Tenant Admin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald" />
            Organization Settings
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.role === 'SUPER_ADMIN' ? 'Super Admin — Manage your organization configuration' : 'Tenant Admin — Organization settings'}
          </p>
        </div>
      </div>

      {/* Current tenant info */}
      <Card className="border-border bg-card/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: settings?.primaryColor || '#10b981' }}
            >
              {(settings?.name || 'O').split(' ').map(w => w[0]).join('').substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{settings?.name || 'Loading...'}</p>
              <p className="text-[11px] text-muted-foreground">{settings?.slug || ''}</p>
            </div>
            <Badge variant="outline" className="border-emerald/30 text-emerald text-[10px] h-5">
              {user?.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Map Area Configuration */}
      <Card className="border-border bg-card/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-cyan" />
              <h3 className="text-sm font-semibold">Map Area Configuration</h3>
            </div>
            <div className="flex items-center gap-2">
              {currentBounds && (
                <Badge variant="outline" className="text-[10px] h-5 border-cyan/30 text-cyan">
                  {currentBounds.label}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setMapConfigOpen(true)}
              >
                <Settings className="h-3 w-3" />
                Configure
              </Button>
            </div>
          </div>

          {currentBounds ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-lg border border-border bg-background/50 px-2 py-2">
                <p className="text-[10px] text-muted-foreground">South (minLat)</p>
                <p className="text-sm font-bold tabular-nums">{currentBounds.minLat}</p>
              </div>
              <div className="rounded-lg border border-border bg-background/50 px-2 py-2">
                <p className="text-[10px] text-muted-foreground">North (maxLat)</p>
                <p className="text-sm font-bold tabular-nums">{currentBounds.maxLat}</p>
              </div>
              <div className="rounded-lg border border-border bg-background/50 px-2 py-2">
                <p className="text-[10px] text-muted-foreground">West (minLng)</p>
                <p className="text-sm font-bold tabular-nums">{currentBounds.minLng}</p>
              </div>
              <div className="rounded-lg border border-border bg-background/50 px-2 py-2">
                <p className="text-[10px] text-muted-foreground">East (maxLng)</p>
                <p className="text-sm font-bold tabular-nums">{currentBounds.maxLng}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No custom map area configured. Using default Nigeria bounds. Click Configure to set a custom area.
            </p>
          )}

          <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-2.5 text-[11px] text-cyan/80">
            The map area defines the geographic bounding box shown on the Geo Map. Configure this to focus on your
            organization&apos;s monitoring region. Polling units outside this area will not be visible on the map.
            Users can still zoom and pan within the configured bounds.
          </div>
        </CardContent>
      </Card>

      {/* Info notices */}
      <div className="rounded-lg border border-violet/20 bg-violet/5 p-3 flex items-start gap-2.5">
        <Vote className="h-4 w-4 text-violet shrink-0 mt-0.5" />
        <div className="text-[11px] text-violet/80">
          <p className="font-medium text-violet mb-0.5">Single Election Type Per Tenant</p>
          Each tenant organization is scoped to exactly one election type. This ensures data isolation, role permissions, and monitoring configurations are election-specific.
        </div>
      </div>

      <div className="rounded-lg border border-emerald/20 bg-emerald/5 p-3 flex items-start gap-2.5">
        <Shield className="h-4 w-4 text-emerald shrink-0 mt-0.5" />
        <div className="text-[11px] text-emerald/80">
          <p className="font-medium text-emerald mb-0.5">Zero-Trust Tenant Architecture</p>
          Complete logical data isolation with row-level security. Cross-tenant data leakage is prevented.
        </div>
      </div>

      {/* ===== MAP CONFIG DIALOG ===== */}
      <Dialog open={mapConfigOpen} onOpenChange={setMapConfigOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-cyan" />
              Configure Map Area
            </DialogTitle>
            <DialogDescription>
              Set the geographic bounding box for the Polling Unit Map. Use a preset or enter custom WGS84 coordinates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Label */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Area Label</label>
              <Input
                placeholder="e.g. Lagos, Southeast, Kano Central"
                value={mapLabel}
                onChange={(e) => setMapLabel(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Preset quick-select */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Quick Preset</label>
              <Select onValueChange={(v) => {
                const preset = REGION_PRESETS.find(p => p.label === v);
                if (preset) handlePreset(preset);
              }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select a region preset..." />
                </SelectTrigger>
                <SelectContent>
                  {REGION_PRESETS.map(p => (
                    <SelectItem key={p.label} value={p.label} className="text-xs">
                      {p.label}
                      <span className="text-muted-foreground ml-2">
                        ({p.minLat}, {p.maxLat}, {p.minLng}, {p.maxLng})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Coordinate inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">South (minLat)</label>
                <Input type="number" step="0.1" placeholder="4.0" value={minLat} onChange={(e) => setMinLat(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">North (maxLat)</label>
                <Input type="number" step="0.1" placeholder="14.0" value={maxLat} onChange={(e) => setMaxLat(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">West (minLng)</label>
                <Input type="number" step="0.1" placeholder="2.5" value={minLng} onChange={(e) => setMinLng(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">East (maxLng)</label>
                <Input type="number" step="0.1" placeholder="15.0" value={maxLng} onChange={(e) => setMaxLng(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            <div className="rounded-lg border border-amber/20 bg-amber/5 p-2.5 text-[11px] text-amber/80">
              Coordinates are in WGS84 decimal degrees. To find coordinates for your area, right-click on Google Maps and copy the latitude/longitude values. minLat must be less than maxLat; minLng must be less than maxLng.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleResetMap} className="gap-1.5 text-xs">
              <RotateCcw className="h-3 w-3" /> Reset to Nigeria
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setMapConfigOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveMap}
              disabled={saveMutation.isPending || !minLat || !maxLat || !minLng || !maxLng}
              className="bg-cyan hover:bg-cyan/90 text-cyan-950 gap-1.5 text-xs"
            >
              {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save Map Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}