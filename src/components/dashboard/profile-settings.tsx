'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Building2, Shield, Loader2, Eye, EyeOff, Volume2, VolumeX, User, Bell, MessageSquare, AlertTriangle, BarChart3, Settings } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useDashboardStore, type UserRole } from '@/store/dashboard';
import { fetchJson } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-rose/15 text-rose border-rose/25',
  TENANT_ADMIN: 'bg-amber/15 text-amber border-amber/25',
  ANALYST: 'bg-cyan/15 text-cyan border-cyan/25',
  TRUST_SAFETY: 'bg-violet/15 text-violet border-violet/25',
  FIELD_AGENT: 'bg-emerald/15 text-emerald border-emerald/25',
};

interface NotificationPrefs {
  criticalAlerts: boolean;
  newIncidents: boolean;
  chatMessages: boolean;
  pvtUpdates: boolean;
}

function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') {
    return { criticalAlerts: true, newIncidents: true, chatMessages: true, pvtUpdates: true };
  }
  try {
    const raw = localStorage.getItem('omnivote-notif-prefs');
    if (raw) return JSON.parse(raw) as NotificationPrefs;
  } catch { /* ignore */ }
  return { criticalAlerts: true, newIncidents: true, chatMessages: true, pvtUpdates: true };
}

function saveNotificationPrefs(prefs: NotificationPrefs) {
  localStorage.setItem('omnivote-notif-prefs', JSON.stringify(prefs));
}

const fadeTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

export function ProfileSettingsDialog({ open, onOpenChange }: ProfileSettingsDialogProps) {
  const user = useDashboardStore((s) => s.user);
  const login = useDashboardStore((s) => s.login);

  // Profile tab state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Security tab state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Preferences tab state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(loadNotificationPrefs);

  // Sync editable fields when dialog opens or user changes
  useEffect(() => {
    if (open && user) {
      setEditName(user.name);
      setEditPhone(''); // phone not in store; will be fetched if needed
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setNotifPrefs(loadNotificationPrefs());
      setSoundEnabled(localStorage.getItem('omnivote-sound-enabled') !== 'false');
    }
  }, [open, user]);

  // Profile save mutation
  const saveProfile = useMutation({
    mutationFn: async (data: { name: string; phone?: string }) => {
      return fetchJson('/api/agents', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'UPDATE_PROFILE',
          userId: user?.id,
          ...data,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      // Update local store
      if (user && editName !== user.name) {
        login({ ...user, name: editName });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update profile');
    },
  });

  // Password change mutation
  const changePassword = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return fetchJson('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to change password');
    },
  });

  const handleNotifToggle = (key: keyof NotificationPrefs) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    saveNotificationPrefs(updated);
  };

  const handleSoundToggle = (checked: boolean) => {
    setSoundEnabled(checked);
    localStorage.setItem('omnivote-sound-enabled', String(checked));
  };

  const handlePasswordSubmit = () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast.error('All password fields are required');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPw.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    changePassword.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

  if (!user) return null;

  const roleBadgeClass = ROLE_BADGE_COLORS[user.role] || 'bg-muted text-muted-foreground border-border';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass-strong">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4.5 w-4.5 text-emerald" />
            Settings
          </DialogTitle>
          <DialogDescription>Manage your profile, security, and preferences.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1 gap-1.5 text-xs">
              <User className="h-3.5 w-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-1 gap-1.5 text-xs">
              <Shield className="h-3.5 w-3.5" />
              Security
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex-1 gap-1.5 text-xs">
              <Bell className="h-3.5 w-3.5" />
              Preferences
            </TabsTrigger>
          </TabsList>

          {/* ─── Profile Tab ─── */}
          <AnimatePresence mode="wait">
            <TabsContent value="profile" forceMount className={cn('hidden', 'data-[state=active]:block')}>
              <motion.div {...fadeTransition} key="profile">
                <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-4">
                  {/* Read-only info */}
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-emerald/15 text-emerald flex items-center justify-center text-lg font-bold ring-2 ring-emerald/20">
                      {user.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{user.name}</p>
                      <Badge variant="outline" className={cn('mt-1 text-[10px]', roleBadgeClass)}>
                        {user.role.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>

                  <Separator className="bg-border/60" />

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{user.tenantName}</p>
                        <p className="text-[11px] text-muted-foreground">Tenant</p>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border/60" />

                  {/* Editable fields */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-name" className="text-xs font-medium text-muted-foreground/80">
                        Full Name
                      </Label>
                      <Input
                        id="settings-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-9 bg-background/60 border-border/60 text-sm focus-visible:border-emerald/40"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-phone" className="text-xs font-medium text-muted-foreground/80">
                        Phone Number
                      </Label>
                      <Input
                        id="settings-phone"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="h-9 bg-background/60 border-border/60 text-sm focus-visible:border-emerald/40"
                        placeholder="e.g. +2348012345678"
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full bg-emerald hover:bg-emerald/90 text-emerald-950 h-9 text-sm"
                    disabled={saveProfile.isPending || !editName.trim()}
                    onClick={() => saveProfile.mutate({ name: editName.trim(), phone: editPhone.trim() || undefined })}
                  >
                    {saveProfile.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : 'Save Changes'}
                  </Button>
                </div>
              </motion.div>
            </TabsContent>

            {/* ─── Security Tab ─── */}
            <TabsContent value="security" forceMount className={cn('hidden', 'data-[state=active]:block')}>
              <motion.div {...fadeTransition} key="security">
                <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-5">
                  {/* Password Change */}
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4 text-cyan" />
                      Change Password
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Update your account password.</p>
                  </div>

                  <div className="space-y-3">
                    {/* Current Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-current-pw" className="text-xs font-medium text-muted-foreground/80">
                        Current Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="settings-current-pw"
                          type={showCurrentPw ? 'text' : 'password'}
                          value={currentPw}
                          onChange={(e) => setCurrentPw(e.target.value)}
                          className="pr-10 h-9 bg-background/60 border-border/60 text-sm focus-visible:border-emerald/40"
                          placeholder="Enter current password"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"
                          aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                        >
                          {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-new-pw" className="text-xs font-medium text-muted-foreground/80">
                        New Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="settings-new-pw"
                          type={showNewPw ? 'text' : 'password'}
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          className="pr-10 h-9 bg-background/60 border-border/60 text-sm focus-visible:border-emerald/40"
                          placeholder="Enter new password"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"
                          aria-label={showNewPw ? 'Hide password' : 'Show password'}
                        >
                          {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-confirm-pw" className="text-xs font-medium text-muted-foreground/80">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="settings-confirm-pw"
                          type={showConfirmPw ? 'text' : 'password'}
                          value={confirmPw}
                          onChange={(e) => setConfirmPw(e.target.value)}
                          className="pr-10 h-9 bg-background/60 border-border/60 text-sm focus-visible:border-emerald/40"
                          placeholder="Confirm new password"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"
                          aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPw && newPw && confirmPw !== newPw && (
                        <p className="text-[10px] text-rose">Passwords do not match</p>
                      )}
                    </div>

                    <Button
                      className="w-full bg-emerald hover:bg-emerald/90 text-emerald-950 h-9 text-sm"
                      disabled={changePassword.isPending || !currentPw || !newPw || !confirmPw}
                      onClick={handlePasswordSubmit}
                    >
                      {changePassword.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : 'Update Password'}
                    </Button>
                  </div>

                  <Separator className="bg-border/60" />

                  {/* Notification Sounds Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {soundEnabled ? (
                        <Volume2 className="h-4 w-4 text-emerald" />
                      ) : (
                        <VolumeX className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">Notification Sounds</p>
                        <p className="text-[11px] text-muted-foreground">Play audio for alerts and messages</p>
                      </div>
                    </div>
                    <Switch checked={soundEnabled} onCheckedChange={handleSoundToggle} />
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* ─── Preferences Tab ─── */}
            <TabsContent value="preferences" forceMount className={cn('hidden', 'data-[state=active]:block')}>
              <motion.div {...fadeTransition} key="preferences">
                <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-5">
                  {/* Theme */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Theme</p>
                      <p className="text-[11px] text-muted-foreground">Choose your preferred appearance</p>
                    </div>
                    <ThemeToggle />
                  </div>

                  <Separator className="bg-border/60" />

                  {/* Notification Preferences */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Bell className="h-4 w-4 text-cyan" />
                        Notification Preferences
                      </h3>
                      <p className="text-[11px] text-muted-foreground">Choose which notifications you receive.</p>
                    </div>

                    <div className="space-y-3">
                      {/* Critical Alerts */}
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <Checkbox
                          checked={notifPrefs.criticalAlerts}
                          onCheckedChange={() => handleNotifToggle('criticalAlerts')}
                          className="data-[state=checked]:bg-rose data-[state=checked]:border-rose"
                        />
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground group-hover:text-rose transition-colors" />
                          <span className="text-sm">Critical alerts</span>
                        </div>
                      </label>

                      {/* New Incidents */}
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <Checkbox
                          checked={notifPrefs.newIncidents}
                          onCheckedChange={() => handleNotifToggle('newIncidents')}
                          className="data-[state=checked]:bg-amber data-[state=checked]:border-amber"
                        />
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground group-hover:text-amber transition-colors" />
                          <span className="text-sm">New incidents</span>
                        </div>
                      </label>

                      {/* Chat Messages */}
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <Checkbox
                          checked={notifPrefs.chatMessages}
                          onCheckedChange={() => handleNotifToggle('chatMessages')}
                          className="data-[state=checked]:bg-cyan data-[state=checked]:border-cyan"
                        />
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground group-hover:text-cyan transition-colors" />
                          <span className="text-sm">Chat messages</span>
                        </div>
                      </label>

                      {/* PVT Updates */}
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <Checkbox
                          checked={notifPrefs.pvtUpdates}
                          onCheckedChange={() => handleNotifToggle('pvtUpdates')}
                          className="data-[state=checked]:bg-emerald data-[state=checked]:border-emerald"
                        />
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-emerald transition-colors" />
                          <span className="text-sm">PVT updates</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
