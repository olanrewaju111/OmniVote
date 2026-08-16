'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { useDashboardStore, ROLE_TABS, type ViewTab } from '@/store/dashboard';
import {
  LayoutDashboard, BarChart3, Map, Radio, ShieldAlert, Brain, Image as ImageIcon,
  Activity, Zap, Users, Send, FileText, Server, Building2, Globe, Megaphone, CalendarDays,
  Shield, MapPin, Eye, Flame, Search, ArrowRight, LogOut, Settings,
  Moon, Sun, Monitor, PanelLeftClose, PanelLeft, Pause, Play,
} from 'lucide-react';

const ALL_NAV: { id: ViewTab; label: string; icon: React.ReactNode; keywords: string[] }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, keywords: ['home', 'dashboard', 'summary', 'kpis'] },
  { id: 'situation', label: 'Situation Room', icon: <BarChart3 className="h-4 w-4" />, keywords: ['hierarchy', 'drill', 'results', 'national', 'state', 'lga'] },
  { id: 'map', label: 'Geo Map', icon: <Map className="h-4 w-4" />, keywords: ['geography', 'location', 'polling', 'spatial'] },
  { id: 'feed', label: 'Live Feed', icon: <Radio className="h-4 w-4" />, keywords: ['incidents', 'reports', 'stream', 'realtime'] },
  { id: 'alerts', label: 'Alert Triage', icon: <ShieldAlert className="h-4 w-4" />, keywords: ['warnings', 'notifications', 'triage', 'defense'] },
  { id: 'osint', label: 'OSINT Monitor', icon: <Globe className="h-4 w-4" />, keywords: ['social', 'media', 'intelligence', 'monitoring'] },
  { id: 'ai', label: 'AI Engine', icon: <Brain className="h-4 w-4" />, keywords: ['machine learning', 'deepfake', 'analysis', 'models'] },
  { id: 'media', label: 'Media Vault', icon: <ImageIcon className="h-4 w-4" />, keywords: ['photos', 'videos', 'images', 'gallery', 'evidence'] },
  { id: 'mobilization', label: 'Mobilization', icon: <Megaphone className="h-4 w-4" />, keywords: ['voters', 'campaign', 'outreach', 'engagement'] },
  { id: 'campaigns', label: 'Campaign Monitor', icon: <CalendarDays className="h-4 w-4" />, keywords: ['campaigns', 'events', 'rallies', 'schedule'] },
  { id: 'security', label: 'Security Center', icon: <Shield className="h-4 w-4" />, keywords: ['defense', 'cyber', 'threats', 'protection'] },
  { id: 'field-safety', label: 'Field Safety', icon: <MapPin className="h-4 w-4" />, keywords: ['safety', 'agents', 'sos', 'emergency', 'welfare'] },
  { id: 'pvt', label: 'PVT / Quick Count', icon: <BarChart3 className="h-4 w-4" />, keywords: ['parallel', 'vote', 'tabulation', 'count', 'results'] },
  { id: 'evidence', label: 'Evidence Dossier', icon: <FileText className="h-4 w-4" />, keywords: ['evidence', 'legal', 'documentation', 'proof'] },
  { id: 'flashpoint', label: 'Flashpoint & Wargame', icon: <Flame className="h-4 w-4" />, keywords: ['flashpoint', 'wargame', 'simulation', 'conflict', 'prediction'] },
  { id: 'honeypot', label: 'Honeypot / PWD', icon: <Eye className="h-4 w-4" />, keywords: ['honeypot', 'pwd', 'biometrics', 'decoy', 'entrapment'] },
  { id: 'agents', label: 'Agent Roster', icon: <Users className="h-4 w-4" />, keywords: ['field agents', 'observers', 'monitors', 'personnel'] },
  { id: 'engagement', label: 'Agent Engagement', icon: <Activity className="h-4 w-4" />, keywords: ['engagement', 'activity', 'performance', 'communication'] },
  { id: 'audit-logs', label: 'Audit Logs', icon: <FileText className="h-4 w-4" />, keywords: ['audit', 'logs', 'history', 'trail', 'compliance'] },
  { id: 'system', label: 'System Health', icon: <Server className="h-4 w-4" />, keywords: ['system', 'health', 'status', 'infrastructure', 'uptime'] },
  { id: 'tenants', label: 'Settings', icon: <Settings className="h-4 w-4" />, keywords: ['settings', 'config', 'tenant', 'organization', 'admin'] },
  { id: 'submit', label: 'Submit Report', icon: <Send className="h-4 w-4" />, keywords: ['submit', 'new', 'create', 'report', 'incident'] },
  { id: 'my-reports', label: 'My Reports', icon: <FileText className="h-4 w-4" />, keywords: ['my', 'reports', 'submissions', 'history'] },
];

// Persisted recent tabs (max 5)
const STORAGE_KEY = 'omnivote-recent-tabs';

function getRecentTabs(): ViewTab[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function addRecentTab(tabId: ViewTab) {
  try {
    const recent = getRecentTabs().filter(t => t !== tabId);
    recent.unshift(tabId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, 5)));
  } catch { /* storage unavailable */ }
}

function getThemeIcon() {
  if (typeof document === 'undefined') return <Monitor className="h-4 w-4" />;
  const isDark = document.documentElement.classList.contains('dark');
  const isLight = document.documentElement.classList.contains('light');
  if (isDark) return <Moon className="h-4 w-4" />;
  if (isLight) return <Sun className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

function getThemeLabel() {
  if (typeof document === 'undefined') return 'Cycle theme';
  const isDark = document.documentElement.classList.contains('dark');
  const isLight = document.documentElement.classList.contains('light');
  if (isDark) return 'Switch to light mode';
  if (isLight) return 'Switch to system theme';
  return 'Switch to dark mode';
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { user, activeTab, setSelectedTab, logout, toggleSidebar, toggleLiveFeed, liveFeedPaused, sidebarCollapsed } = useDashboardStore();
  const [recentTabs, setRecentTabs] = useState<ViewTab[]>([]);

  // Load recent tabs when palette opens
  useEffect(() => {
    if (open) setRecentTabs(getRecentTabs());
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSelect = useCallback((tabId: string) => {
    setSelectedTab(tabId as ViewTab);
    addRecentTab(tabId as ViewTab);
    setOpen(false);
  }, [setSelectedTab]);

  const handleLogout = useCallback(() => {
    logout();
    setOpen(false);
  }, [logout]);

  const handleThemeToggle = useCallback(() => {
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');
    const isLight = root.classList.contains('light');
    if (isDark) {
      root.classList.remove('dark');
      root.classList.add('light');
      try { localStorage.setItem('theme', 'light'); } catch { /* */ }
    } else if (isLight) {
      root.classList.remove('light');
      try { localStorage.removeItem('theme'); } catch { /* */ }
    } else {
      root.classList.add('dark');
      try { localStorage.setItem('theme', 'dark'); } catch { /* */ }
    }
    setOpen(false);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
    setOpen(false);
  }, [toggleSidebar]);

  const handleToggleLiveFeed = useCallback(() => {
    toggleLiveFeed();
    setOpen(false);
  }, [toggleLiveFeed]);

  if (!user) return null;

  const allowedTabs = ROLE_TABS[user.role] || [];
  const navItems = ALL_NAV.filter(item => allowedTabs.includes(item.id));

  // Build recent items from persisted storage
  const recentItems = recentTabs
    .filter(tabId => allowedTabs.includes(tabId) && tabId !== activeTab)
    .slice(0, 4)
    .map(tabId => ALL_NAV.find(n => n.id === tabId))
    .filter(Boolean) as typeof navItems;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search dashboards, actions, settings..." />
      <CommandList>
        <CommandEmpty>
          <div className="py-6 text-center">
            <Search className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No results found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try searching for a dashboard or action</p>
          </div>
        </CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => { setSelectedTab('submit'); setOpen(false); }} className="gap-3">
            <Send className="h-4 w-4 text-emerald" />
            <span>Submit new report</span>
            <span className="ml-auto text-[10px] text-muted-foreground/50 hidden sm:inline">quick action</span>
          </CommandItem>
          <CommandItem onSelect={() => { setSelectedTab('alerts'); setOpen(false); }} className="gap-3">
            <ShieldAlert className="h-4 w-4 text-amber" />
            <span>View critical alerts</span>
          </CommandItem>
          <CommandItem onSelect={handleToggleLiveFeed} className="gap-3">
            {liveFeedPaused ? <Play className="h-4 w-4 text-cyan" /> : <Pause className="h-4 w-4 text-cyan" />}
            <span>{liveFeedPaused ? 'Resume live feed' : 'Pause live feed'}</span>
            <span className="ml-auto text-[10px] text-muted-foreground/50 hidden sm:inline">⌘.</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Recently Visited (persisted) */}
        {recentItems.length > 0 && (
          <CommandGroup heading="Recent">
            {recentItems.map((item) => (
              <CommandItem
                key={`recent-${item.id}`}
                onSelect={() => handleSelect(item.id)}
                className="gap-3"
              >
                <span className="text-muted-foreground">{item.icon}</span>
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* All Navigation */}
        <CommandGroup heading="Navigation">
          {navItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.keywords.join(' ')}`}
              onSelect={() => handleSelect(item.id)}
              className="gap-3"
            >
              <span className="text-muted-foreground">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.id === activeTab && (
                <span className="text-[10px] text-emerald flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  active
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Settings & Actions */}
        <CommandGroup heading="Settings">
          <CommandItem onSelect={handleThemeToggle} className="gap-3">
            {getThemeIcon()}
            <span>{getThemeLabel()}</span>
            <span className="ml-auto text-[10px] text-muted-foreground/50 hidden sm:inline">⌘T</span>
          </CommandItem>
          <CommandItem onSelect={handleToggleSidebar} className="gap-3">
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            <span>{sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
            <span className="ml-auto text-[10px] text-muted-foreground/50 hidden sm:inline">⌘B</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Account */}
        <CommandGroup heading="Account">
          <CommandItem onSelect={handleLogout} className="gap-3 text-rose focus:text-rose">
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
            <span className="ml-auto text-[10px] text-muted-foreground/50 hidden sm:inline">{user.name}</span>
          </CommandItem>
        </CommandGroup>

        {/* Footer hint */}
        <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground/50">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="h-4 px-1 rounded bg-muted text-[9px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="h-4 px-1 rounded bg-muted text-[9px]">↵</kbd>
              select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="h-4 px-1 rounded bg-muted text-[9px]">esc</kbd>
            close
          </span>
        </div>
      </CommandList>
    </CommandDialog>
  );
}
