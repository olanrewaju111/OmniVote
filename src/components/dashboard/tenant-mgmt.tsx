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
  Building2, Users, Settings, Shield, Vote, Loader2, MapPin, Save,
  RotateCcw, Plus, Trash2, UserPlus, Mail, ChevronRight, Globe,
  Eye, UserCheck, Radio, AlertTriangle, Pencil, AlertCircle,
  Send, Copy, Check as CheckIcon, Link,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { fetchJson } from '@/lib/api';
import { useDashboardStore, type UserRole } from '@/store/dashboard';

// ---- Shared types & constants ----
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
  minLat: number; maxLat: number; minLng: number; maxLng: number; label: string;
}

const VALID_ROLES: UserRole[] = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY', 'FIELD_AGENT'];

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'border-emerald/30 text-emerald bg-emerald/10',
  TENANT_ADMIN: 'border-cyan/30 text-cyan bg-cyan/10',
  ANALYST: 'border-amber/30 text-amber bg-amber/10',
  TRUST_SAFETY: 'border-rose/30 text-rose bg-rose/10',
  FIELD_AGENT: 'border-border text-muted-foreground bg-card',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  SUPER_ADMIN: <Shield className="h-3.5 w-3.5" />,
  TENANT_ADMIN: <Users className="h-3.5 w-3.5" />,
  ANALYST: <Eye className="h-3.5 w-3.5" />,
  TRUST_SAFETY: <UserCheck className="h-3.5 w-3.5" />,
  FIELD_AGENT: <Radio className="h-3.5 w-3.5" />,
};

// ---- Main Component ----
export function TenantManagement() {
  const { user, tenantId } = useDashboardStore();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const isAdmin = isSuperAdmin || isTenantAdmin;

  // ===================== SUPER_ADMIN: Platform Tenants =====================
  const { data: allTenants, isLoading: tenantsLoading, isError: tenantsIsError } = useQuery({
    queryKey: ['all-tenants'],
    queryFn: async () => {
      const d = await fetchJson<{ tenants?: TenantItem[] }>('/api/tenants');
      return d.tenants || [];
    },
    enabled: isSuperAdmin,
  });

  // ===================== TENANT_ADMIN: Own tenant settings =====================
  const { data: settings, isLoading: settingsLoading, isError: settingsIsError } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: async () => {
      return fetchJson<{
        mapBounds?: MapBoundsData; id?: string; name?: string; slug?: string; primaryColor?: string;
      }>(`/api/tenant-settings?tenantId=${tenantId}`);
    },
    enabled: !!tenantId && isAdmin,
  });

  // ===================== Common: Tenant Users =====================
  const { data: tenantUsersData, isLoading: usersLoading, isError: usersIsError } = useQuery({
    queryKey: ['tenant-users', tenantId],
    queryFn: async () => {
      const d = await fetchJson<{ users?: { id: string; email: string; name: string; role: string; phone?: string; isOnline: boolean; lastSeenAt?: string; createdAt: string }[] }>(`/api/tenants/users?tenantId=${tenantId}`);
      return d.users || [];
    },
    enabled: !!tenantId && isAdmin,
  });

  const currentBounds: MapBoundsData | null = settings?.mapBounds || null;
  const tenantUsers = tenantUsersData || [];

  // ===================== State =====================
  // Map config dialog
  const [mapConfigOpen, setMapConfigOpen] = useState(false);
  const [mapLabel, setMapLabel] = useState('');
  const [minLat, setMinLat] = useState('');
  const [maxLat, setMaxLat] = useState('');
  const [minLng, setMinLng] = useState('');
  const [maxLng, setMaxLng] = useState('');

  // Create tenant dialog
  const [createTenantOpen, setCreateTenantOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantSlug, setNewTenantSlug] = useState('');
  const [newTenantColor, setNewTenantColor] = useState('#10b981');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Add user dialog
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('FIELD_AGENT');

  // Invite user dialog
  const [inviteUserOpen, setInviteUserOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('FIELD_AGENT');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);

  // User role change dialog
  const [roleChangeOpen, setRoleChangeOpen] = useState(false);
  const [roleChangeUser, setRoleChangeUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [newRole, setNewRole] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'tenant' | 'user'; item: { id: string; name: string } } | null>(null);

  // Active sub-tab for SUPER_ADMIN
  const [subTab, setSubTab] = useState<'tenants' | 'my-tenant' | 'map'>('tenants');

  // ===================== Effects =====================
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

  // Auto-derive slug from tenant name
  useEffect(() => {
    if (createTenantOpen && newTenantName && !newTenantSlug) {
      setNewTenantSlug(newTenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''));
    }
  }, [createTenantOpen, newTenantName, newTenantSlug]);

  // ===================== Mutations =====================
  // Save map bounds
  const saveMapMutation = useMutation({
    mutationFn: async (bounds: MapBoundsData) => {
      return fetchJson(`/api/tenant-settings?tenantId=${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapBounds: bounds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setMapConfigOpen(false);
      toast.success('Map area saved. The map will update automatically.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save map configuration'),
  });

  // Create tenant
  const createTenantMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; primaryColor: string; adminName: string; adminEmail: string }) =>
      fetchJson<{ tenant?: { name: string }; admin?: { email: string } }>('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
      setCreateTenantOpen(false);
      setNewTenantName(''); setNewTenantSlug(''); setNewTenantColor('#10b981');
      setNewAdminName(''); setNewAdminEmail('');
      toast.success(`Tenant "${data.tenant?.name}" created. Admin: ${data.admin?.email}`);
    },
    onError: (err) => toast.error(err?.message || 'Failed to create tenant'),
  });

  // Delete tenant
  const deleteTenantMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/tenants?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
      setDeleteConfirm(null);
      toast.success('Tenant deleted successfully');
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete tenant'),
  });

  // Toggle tenant active
  const toggleTenantMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetchJson('/api/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
      toast.success('Tenant status updated');
    },
    onError: (err) => toast.error(err?.message || 'Failed to update tenant'),
  });

  // Add user
  const addUserMutation = useMutation({
    mutationFn: (data: { tenantId: string; name: string; email: string; role: string }) =>
      fetchJson('/api/tenants/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      setAddUserOpen(false);
      setNewUserName(''); setNewUserEmail(''); setNewUserRole('FIELD_AGENT');
      toast.success('User added successfully');
    },
    onError: (err) => toast.error(err?.message || 'Failed to add user'),
  });

  // Invite user
  const inviteUserMutation = useMutation({
    mutationFn: (data: { email: string; name: string; role: string; tenantId: string }) =>
      fetchJson<{ success?: boolean; message?: string; inviteToken?: string }>('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      setInviteToken(data.inviteToken || 'Generated successfully');
      toast.success(`Invitation sent to ${inviteEmail}`);
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
    },
    onError: (err) => toast.error(err?.message || 'Failed to send invitation'),
  });

  // Change user role
  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      fetchJson('/api/tenants/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      setRoleChangeOpen(false);
      setRoleChangeUser(null);
      toast.success('User role updated');
    },
    onError: (err) => toast.error(err?.message || 'Failed to update role'),
  });

  // Remove user
  const deleteUserMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/tenants/users?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      setDeleteConfirm(null);
      toast.success('User removed');
    },
    onError: (err) => toast.error(err?.message || 'Failed to remove user'),
  });

  // ===================== Handlers =====================
  const handleSaveMap = () => {
    const minLatN = parseFloat(minLat);
    const maxLatN = parseFloat(maxLat);
    const minLngN = parseFloat(minLng);
    const maxLngN = parseFloat(maxLng);
    if ([minLatN, maxLatN, minLngN, maxLngN].some(isNaN)) { toast.error('All coordinates must be valid numbers'); return; }
    if (minLatN >= maxLatN || minLngN >= maxLngN) { toast.error('minLat must be < maxLat, and minLng must be < maxLng'); return; }
    saveMapMutation.mutate({ minLat: minLatN, maxLat: maxLatN, minLng: minLngN, maxLng: maxLngN, label: mapLabel || 'Custom Area' });
  };

  const handlePreset = (preset: typeof REGION_PRESETS[number]) => {
    setMapLabel(preset.label);
    setMinLat(String(preset.minLat));
    setMaxLat(String(preset.maxLat));
    setMinLng(String(preset.minLng));
    setMaxLng(String(preset.maxLng));
  };

  const handleResetMap = () => {
    saveMapMutation.mutate({ minLat: 4.0, maxLat: 14.0, minLng: 2.5, maxLng: 15.0, label: 'Nigeria' });
  };

  const handleCreateTenant = () => {
    if (!newTenantName || !newTenantSlug || !newAdminName || !newAdminEmail) {
      toast.error('All fields are required'); return;
    }
    createTenantMutation.mutate({
      name: newTenantName, slug: newTenantSlug, primaryColor: newTenantColor,
      adminName: newAdminName, adminEmail: newAdminEmail,
    });
  };

  const handleAddUser = () => {
    if (!newUserName || !newUserEmail || !newUserRole) { toast.error('All fields are required'); return; }
    addUserMutation.mutate({ tenantId: tenantId!, name: newUserName, email: newUserEmail, role: newUserRole });
  };

  const handleRoleChange = () => {
    if (!roleChangeUser || !newRole) return;
    changeRoleMutation.mutate({ id: roleChangeUser.id, role: newRole });
  };

  // ===================== Restricted access =====================
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

  const isLoading = isSuperAdmin ? tenantsLoading : settingsLoading;
  const hasError = isSuperAdmin ? tenantsIsError : settingsIsError;

  // ===================== Render =====================
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald" />
              {isSuperAdmin ? 'Platform Management' : 'Organization Settings'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isSuperAdmin
                ? 'Create and manage tenant organizations, their users, and configurations'
                : 'Manage your organization settings, users, and map configuration'}
            </p>
          </div>
          {isSuperAdmin && (
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-emerald hover:bg-emerald/90 text-emerald-950 h-8"
              onClick={() => setCreateTenantOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" /> New Tenant
            </Button>
          )}
        </div>

        {/* Sub-tabs for SUPER_ADMIN */}
        {isSuperAdmin && (
          <div className="flex items-center gap-1 mt-3 bg-muted/30 rounded-lg p-0.5 w-fit">
            {([
              { id: 'tenants' as const, label: 'All Tenants', icon: <Globe className="h-3.5 w-3.5" /> },
              { id: 'my-tenant' as const, label: 'My Organization', icon: <Building2 className="h-3.5 w-3.5" /> },
              { id: 'map' as const, label: 'Map Config', icon: <MapPin className="h-3.5 w-3.5" /> },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  subTab === tab.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 space-y-4 min-h-0">

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasError ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center p-6">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-sm text-muted-foreground">Failed to load data. Please try again.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : isSuperAdmin ? (
          /* ========== SUPER_ADMIN VIEWS ========== */
          <>
            {subTab === 'tenants' && (
              <SuperAdminTenantsView
                tenants={allTenants || []}
                onToggle={(id, isActive) => toggleTenantMutation.mutate({ id, isActive })}
                onDelete={(item) => setDeleteConfirm({ type: 'tenant', item })}
                onManageUsers={() => setSubTab('my-tenant')}
              />
            )}
            {subTab === 'my-tenant' && (
              <TenantUsersView
                settings={settings}
                tenantUsers={tenantUsers}
                userRole={user?.role || ''}
                onOpenUserDialog={() => setAddUserOpen(true)}
                onOpenInviteDialog={() => setInviteUserOpen(true)}
                onRoleChange={(u) => { setRoleChangeUser(u); setNewRole(u.role); setRoleChangeOpen(true); }}
                onDeleteUser={(u) => setDeleteConfirm({ type: 'user', item: { id: u.id, name: u.name } })}
                onOpenMapConfig={() => { setSubTab('map'); setTimeout(() => setMapConfigOpen(true), 100); }}
              />
            )}
            {subTab === 'map' && (
              <MapConfigSection
                currentBounds={currentBounds}
                onConfigure={() => setMapConfigOpen(true)}
              />
            )}
          </>
        ) : (
          /* ========== TENANT_ADMIN VIEW ========== */
          <>
            <TenantUsersView
              settings={settings}
              tenantUsers={tenantUsers}
              userRole={user?.role || ''}
              onOpenUserDialog={() => setAddUserOpen(true)}
              onOpenInviteDialog={() => setInviteUserOpen(true)}
              onRoleChange={(u) => { setRoleChangeUser(u); setNewRole(u.role); setRoleChangeOpen(true); }}
              onDeleteUser={(u) => setDeleteConfirm({ type: 'user', item: { id: u.id, name: u.name } })}
              onOpenMapConfig={() => setMapConfigOpen(true)}
            />
            <MapConfigSection
              currentBounds={currentBounds}
              onConfigure={() => setMapConfigOpen(true)}
            />
            <InfoNotices />
          </>
        )}
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
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Area Label</label>
              <Input placeholder="e.g. Lagos, Southeast, Kano Central" value={mapLabel} onChange={(e) => setMapLabel(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Quick Preset</label>
              <Select onValueChange={(v) => { const preset = REGION_PRESETS.find(p => p.label === v); if (preset) handlePreset(preset); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a region preset..." /></SelectTrigger>
                <SelectContent>
                  {REGION_PRESETS.map(p => (
                    <SelectItem key={p.label} value={p.label} className="text-xs">
                      {p.label}
                      <span className="text-muted-foreground ml-2">({p.minLat}, {p.maxLat}, {p.minLng}, {p.maxLng})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              disabled={saveMapMutation.isPending || !minLat || !maxLat || !minLng || !maxLng}
              className="bg-cyan hover:bg-cyan/90 text-cyan-950 gap-1.5 text-xs"
            >
              {saveMapMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save Map Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== CREATE TENANT DIALOG ===== */}
      <Dialog open={createTenantOpen} onOpenChange={setCreateTenantOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald" />
              Create New Tenant
            </DialogTitle>
            <DialogDescription>
              Create a new tenant organization. A Super Admin account will be created automatically. The new admin can log in from the main login screen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Organization Name</label>
              <Input placeholder="e.g. Ekiti State Election Monitor" value={newTenantName} onChange={(e) => { setNewTenantName(e.target.value); setNewTenantSlug(''); }} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">URL Slug</label>
              <Input placeholder="e.g. ekiti-state" value={newTenantSlug} onChange={(e) => setNewTenantSlug(e.target.value)} className="h-9 text-sm" />
              <p className="text-[10px] text-muted-foreground">Auto-generated from name. Must be unique.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Brand Color</label>
              <div className="flex items-center gap-2">
                <Input type="color" value={newTenantColor} onChange={(e) => setNewTenantColor(e.target.value)} className="h-9 w-12 p-1 cursor-pointer" />
                <Input value={newTenantColor} onChange={(e) => setNewTenantColor(e.target.value)} className="h-9 text-sm flex-1" />
              </div>
            </div>
            <div className="h-px bg-border" />
            <p className="text-xs font-medium text-muted-foreground">Tenant Super Admin</p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Admin Full Name</label>
              <Input placeholder="e.g. Adebayo Johnson" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Admin Email</label>
              <Input type="email" placeholder="e.g. admin@ekiti.omnivote.ng" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} className="h-9 text-sm" />
              <p className="text-[10px] text-muted-foreground">This email must be unique across all tenants. The admin will use this to log in.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateTenantOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateTenant}
              disabled={createTenantMutation.isPending || !newTenantName || !newTenantSlug || !newAdminName || !newAdminEmail}
              className="bg-emerald hover:bg-emerald/90 text-emerald-950 gap-1.5 text-xs"
            >
              {createTenantMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Create Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ADD USER DIALOG ===== */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald" />
              Add User
            </DialogTitle>
            <DialogDescription>
              Create a new user account in your organization. They can log in from the main screen using their email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Full Name</label>
              <Input placeholder="e.g. Adebayo Johnson" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email Address</label>
              <Input type="email" placeholder="e.g. agent@omnivote.ng" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALID_ROLES.map(r => (
                    <SelectItem key={r} value={r} className="text-xs">{r.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddUser}
              disabled={addUserMutation.isPending || !newUserName || !newUserEmail}
              className="bg-emerald hover:bg-emerald/90 text-emerald-950 gap-1.5 text-xs"
            >
              {addUserMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== INVITE USER DIALOG ===== */}
      <Dialog open={inviteUserOpen} onOpenChange={(open) => { setInviteUserOpen(open); if (!open) { setInviteToken(''); setInviteName(''); setInviteEmail(''); setInviteRole('FIELD_AGENT'); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-violet" />
              Invite User
            </DialogTitle>
            <DialogDescription>
              Send an invitation link. The user will set their own password.
            </DialogDescription>
          </DialogHeader>
          {!inviteToken ? (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                  <Input placeholder="e.g. Adebayo Johnson" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Email Address</label>
                  <Input type="email" placeholder="e.g. agent@omnivote.ng" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Role</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VALID_ROLES.filter(r => r !== 'SUPER_ADMIN').map(r => (
                        <SelectItem key={r} value={r} className="text-xs">{r.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setInviteUserOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => inviteUserMutation.mutate({ email: inviteEmail, name: inviteName, role: inviteRole, tenantId })}
                  disabled={inviteUserMutation.isPending || !inviteName || !inviteEmail}
                  className="bg-violet hover:bg-violet/90 text-white gap-1.5 text-xs"
                >
                  {inviteUserMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Send Invite
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-2 space-y-4">
              <div className="flex items-center gap-2 text-emerald">
                <CheckIcon className="h-5 w-5" />
                <p className="text-sm font-medium">Invitation created!</p>
              </div>
              <p className="text-[11px] text-muted-foreground">Share this link with the user to complete registration:</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Invite Token</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-background/80 border border-border/60 px-3 py-2 text-[11px] font-mono text-violet select-all break-all">
                    {inviteToken}
                  </code>
                  <Button
                    variant="outline" size="sm"
                    className="shrink-0 h-9 w-9 p-0"
                    onClick={() => { navigator.clipboard.writeText(inviteToken); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000); }}
                    aria-label="Copy token"
                  >
                    {inviteCopied ? <CheckIcon className="h-3.5 w-3.5 text-emerald" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteUserOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== ROLE CHANGE DIALOG ===== */}
      <Dialog open={roleChangeOpen} onOpenChange={setRoleChangeOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-amber" />
              Change User Role
            </DialogTitle>
            <DialogDescription>
              Change role for <span className="font-medium text-foreground">{roleChangeUser?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Current Role</label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('text-[10px]', ROLE_BADGE[roleChangeUser?.role || ''])}>
                  {roleChangeUser?.role?.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">New Role</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALID_ROLES.map(r => (
                    <SelectItem key={r} value={r} className="text-xs">{r.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRoleChangeOpen(false)}>Cancel</Button>
            <Button
              onClick={handleRoleChange}
              disabled={changeRoleMutation.isPending || newRole === roleChangeUser?.role}
              className="bg-amber hover:bg-amber/90 text-amber-950 gap-1.5 text-xs"
            >
              {changeRoleMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CONFIRMATION DIALOG ===== */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose">
              <AlertTriangle className="h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>              {deleteConfirm?.type === 'tenant'
                ? <>Are you sure you want to delete tenant <span className="font-medium text-foreground">&quot;{deleteConfirm.item.name}&quot;</span>? This will permanently remove all data including elections, incidents, and users.</>
                : deleteConfirm?.type === 'user'
                  ? <>Are you sure you want to remove user <span className="font-medium text-foreground">&quot;{deleteConfirm.item.name}&quot;</span>?</>
                  : null
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!deleteConfirm) return;
                if (deleteConfirm.type === 'tenant') deleteTenantMutation.mutate(deleteConfirm.item.id);
                else deleteUserMutation.mutate(deleteConfirm.item.id);
              }}
              disabled={deleteConfirm?.type === 'tenant' ? deleteTenantMutation.isPending : deleteUserMutation.isPending}
              className="gap-1.5 text-xs"
            >
              {deleteConfirm?.type === 'tenant'
                ? (deleteTenantMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3" /> Delete Tenant</>)
                : (deleteUserMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3" /> Remove User</>)
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

interface TenantItem {
  id: string; name: string; slug: string; primaryColor: string;
  isActive: boolean; createdAt: string; mapBounds: MapBoundsData | null;
  _count: { users: number; elections: number; incidents: number };
}

function SuperAdminTenantsView({
  tenants,
  onToggle,
  onDelete,
  onManageUsers,
}: {
  tenants: TenantItem[];
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (t: { id: string; name: string }) => void;
  onManageUsers: () => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tenants.map(t => (
          <Card key={t.id} className={cn('border-border bg-card/40 transition-opacity', !t.isActive && 'opacity-50')}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                    style={{ backgroundColor: t.primaryColor }}
                  >
                    {t.name.split(' ').map(w => w[0]).join('').substring(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.slug}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] h-5 shrink-0 cursor-pointer transition-colors',
                    t.isActive ? 'border-emerald/30 text-emerald bg-emerald/10' : 'border-rose/30 text-rose bg-rose/10',
                  )}
                  onClick={() => onToggle(t.id, !t.isActive)}
                  title={t.isActive ? 'Click to deactivate' : 'Click to activate'}
                >
                  {t.isActive ? 'ACTIVE' : 'DISABLED'}
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-background/50 border border-border px-1.5 py-1.5">
                  <p className="text-sm font-bold">{t._count.users}</p>
                  <p className="text-[9px] text-muted-foreground">Users</p>
                </div>
                <div className="rounded-md bg-background/50 border border-border px-1.5 py-1.5">
                  <p className="text-sm font-bold">{t._count.elections}</p>
                  <p className="text-[9px] text-muted-foreground">Elections</p>
                </div>
                <div className="rounded-md bg-background/50 border border-border px-1.5 py-1.5">
                  <p className="text-sm font-bold">{t._count.incidents}</p>
                  <p className="text-[9px] text-muted-foreground">Incidents</p>
                </div>
              </div>

              {/* Map area badge */}
              {t.mapBounds && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <MapPin className="h-3 w-3 text-cyan" />
                  <span>Map: {t.mapBounds.label}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5 pt-1">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1" onClick={onManageUsers}>
                  <Users className="h-3 w-3" /> Users
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-rose"
                  title="Delete tenant"
                  aria-label={`Delete tenant ${t.name}`}
                  onClick={() => onDelete({ id: t.id, name: t.name })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {tenants.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No tenants yet. Create your first tenant organization.</p>
          </div>
        )}
      </div>

      {/* Info notices */}
      <InfoNotices />
    </>
  );
}

function TenantUsersView({
  settings,
  tenantUsers,
  userRole,
  onOpenUserDialog,
  onOpenInviteDialog,
  onRoleChange,
  onDeleteUser,
  onOpenMapConfig,
}: {
  settings: { id?: string; name?: string; slug?: string; primaryColor?: string } | undefined;
  tenantUsers: { id: string; email: string; name: string; role: string; phone?: string; isOnline: boolean; lastSeenAt?: string; createdAt: string }[];
  userRole: string;
  onOpenUserDialog: () => void;
  onOpenInviteDialog: () => void;
  onRoleChange: (u: { id: string; name: string; role: string }) => void;
  onDeleteUser: (u: { id: string; name: string }) => void;
  onOpenMapConfig: () => void;
}) {
  const canManageUsers = userRole === 'SUPER_ADMIN' || userRole === 'TENANT_ADMIN';
  return (
    <>
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
            <Badge variant="outline" className={cn('border-emerald/30 text-emerald text-[10px] h-5', ROLE_BADGE[userRole])}>
              {userRole.replace(/_/g, ' ')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Users */}
      <Card className="border-border bg-card/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan" />
              <h3 className="text-sm font-semibold">Users ({tenantUsers.length})</h3>
            </div>
            {canManageUsers && (
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onOpenMapConfig}>
                  <MapPin className="h-3 w-3" /> Map Area
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onOpenUserDialog}>
                  <UserPlus className="h-3 w-3" /> Add User
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 text-violet border-violet/30 hover:bg-violet/10" onClick={onOpenInviteDialog}>
                  <Send className="h-3 w-3" /> Invite
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            {tenantUsers.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-background/30 hover:bg-background/60 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                  {u.name.split(' ').map(w => w[0]).join('').substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium truncate">{u.name}</p>
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', u.isOnline ? 'bg-emerald' : 'bg-muted-foreground/30')} />
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="h-2.5 w-2.5 shrink-0" /> {u.email}
                  </p>
                </div>
                <Badge variant="outline" className={cn('text-[9px] h-5 shrink-0 gap-1', ROLE_BADGE[u.role])}>
                  {ROLE_ICONS[u.role]} {u.role.replace(/_/g, ' ')}
                </Badge>
                {canManageUsers && u.role !== 'SUPER_ADMIN' && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      className="p-1.5 rounded-md text-muted-foreground hover:text-amber hover:bg-amber/10 transition-colors"
                      onClick={() => onRoleChange({ id: u.id, name: u.name, role: u.role })}
                      title="Change role"
                      aria-label={`Change role for ${u.name}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      className="p-1.5 rounded-md text-muted-foreground hover:text-rose hover:bg-rose/10 transition-colors"
                      onClick={() => onDeleteUser({ id: u.id, name: u.name })}
                      title="Remove user"
                      aria-label={`Remove user ${u.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {tenantUsers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No users in this organization yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function MapConfigSection({
  currentBounds,
  onConfigure,
}: {
  currentBounds: MapBoundsData | null;
  onConfigure: () => void;
}) {
  return (
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
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onConfigure}>
              <Settings className="h-3 w-3" /> Configure
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
          Changes apply immediately to all users in the organization.
        </div>
      </CardContent>
    </Card>
  );
}

function InfoNotices() {
  return (
    <>
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
    </>
  );
}