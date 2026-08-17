'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useDashboardStore, ROLE_TABS, type ViewTab, type UserRole } from '@/store/dashboard';
import {
  LayoutDashboard, BarChart3, Map, Radio, ShieldAlert, Brain, Image as ImageIcon,
  ChevronLeft, ChevronRight, Activity, Zap, Users, Send, FileText,
  Server, Building2, LogOut, MessageSquareWarning, Globe, Megaphone, CalendarDays,
  Shield, MapPin, Eye, Flame, Menu, Settings, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

// ── Navigation sections for visual grouping ──
interface NavItem {
  id: ViewTab;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
  keywords?: string[];
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'core',
    label: 'Command',
    items: [
      { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] },
      { id: 'situation', label: 'Situation Room', icon: <BarChart3 className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] },
      { id: 'map', label: 'Geo Map', icon: <Map className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] },
      { id: 'feed', label: 'Live Feed', icon: <Radio className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY', 'FIELD_AGENT'] },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { id: 'alerts', label: 'Alert Triage', icon: <ShieldAlert className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
      { id: 'osint', label: 'OSINT Monitor', icon: <Globe className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
      { id: 'ai', label: 'AI Engine', icon: <Brain className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
      { id: 'media', label: 'Media Vault', icon: <ImageIcon className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'mobilization', label: 'Mobilization', icon: <Megaphone className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
      { id: 'campaigns', label: 'Campaign Monitor', icon: <CalendarDays className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
      { id: 'security', label: 'Security Center', icon: <Shield className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'TRUST_SAFETY'] },
      { id: 'field-safety', label: 'Field Safety', icon: <MapPin className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    items: [
      { id: 'pvt', label: 'PVT / Quick Count', icon: <BarChart3 className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] },
      { id: 'evidence', label: 'Evidence Dossier', icon: <FileText className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
      { id: 'flashpoint', label: 'Flashpoint & Wargame', icon: <Flame className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] },
      { id: 'honeypot', label: 'Honeypot / PWD', icon: <Eye className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'TRUST_SAFETY'] },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    items: [
      { id: 'agents', label: 'Agent Roster', icon: <Users className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
      { id: 'engagement', label: 'Agent Engagement', icon: <MessageSquareWarning className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
      { id: 'audit-logs', label: 'Audit Logs', icon: <FileText className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { id: 'system', label: 'System Health', icon: <Server className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN'] },
      { id: 'tenants', label: 'Settings', icon: <Settings className="h-4.5 w-4.5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
    ],
  },
];

// Field agent items (flat, no sections)
const FIELD_AGENT_ITEMS: NavItem[] = [
  { id: 'submit', label: 'Submit Report', icon: <Send className="h-4.5 w-4.5" />, roles: ['FIELD_AGENT'] },
  { id: 'my-reports', label: 'My Reports', icon: <FileText className="h-4.5 w-4.5" />, roles: ['FIELD_AGENT'] },
  { id: 'feed', label: 'Live Feed', icon: <Radio className="h-4.5 w-4.5" />, roles: ['FIELD_AGENT'] },
];

// Shared React state for controlling the mobile Sheet
let setMobileSheetOpen: React.Dispatch<React.SetStateAction<boolean>> | null = null;

export function AppSidebar() {
  const isMobile = useIsMobile();
  const {
    activeTab, setSelectedTab, sidebarCollapsed, toggleSidebar, user, logout, unreadAlerts,
  } = useDashboardStore();

  const [mobileOpen, setMobileOpenState] = useState(false);

  // Share setter for MobileMenuTrigger
  setMobileSheetOpen = setMobileOpenState;

  if (!user) return null;

  const allowedTabs = ROLE_TABS[user.role] || [];

  const handleTabSelect = (tabId: ViewTab) => {
    setSelectedTab(tabId);
    if (isMobile) setMobileOpenState(false);
  };

  const handleLogout = () => {
    logout();
    if (isMobile) setMobileOpenState(false);
  };

  const navContent = renderNavContent({
    allowedTabs,
    activeTab,
    sidebarCollapsed,
    user,
    unreadAlerts,
    onTabSelect: handleTabSelect,
    onLogout: handleLogout,
    onToggleSidebar: toggleSidebar,
    isMobile,
    onClose: () => setMobileOpenState(false),
  });

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpenState}>
        <SheetContent side="left" className="w-72 p-0 overflow-y-auto glass-strong">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          {navContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className={cn(
      'flex flex-col h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-out relative z-20',
      sidebarCollapsed ? 'w-[60px]' : 'w-[220px]'
    )} aria-label="Main navigation sidebar">
      {navContent}
    </aside>
  );
}

// ── Hamburger trigger exported for the header ──
export function MobileMenuTrigger() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden h-9 w-9"
      onClick={() => setMobileSheetOpen?.(true)}
      aria-label="Open navigation menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}

// ── Reusable inner content ──
function renderNavContent({
  allowedTabs,
  activeTab,
  sidebarCollapsed,
  user,
  unreadAlerts,
  onTabSelect,
  onLogout,
  onToggleSidebar,
  isMobile = false,
  onClose,
}: {
  allowedTabs: string[];
  activeTab: ViewTab;
  sidebarCollapsed: boolean;
  user: { name: string; role: string };
  unreadAlerts: number;
  onTabSelect: (id: ViewTab) => void;
  onLogout: () => void;
  onToggleSidebar: () => void;
  isMobile?: boolean;
  onClose?: () => void;
}) {
  const collapsed = isMobile ? false : sidebarCollapsed;
  const isFieldAgent = user.role === 'FIELD_AGENT';
  const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2);

  // Filter sections/items based on role
  const filteredSections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => allowedTabs.includes(item.id)),
    }))
    .filter(section => section.items.length > 0);

  const filteredFieldItems = FIELD_AGENT_ITEMS.filter(item => allowedTabs.includes(item.id));

  return (
    <>
      {/* ── Logo area ── */}
      <div className={cn(
        'flex items-center gap-3 border-b border-sidebar-border shrink-0 transition-all duration-300',
        collapsed ? 'px-3 h-14 justify-center' : 'px-4 h-16'
      )}>
        <div className="w-8 h-8 rounded-lg bg-emerald flex items-center justify-center shrink-0 shadow-sm shadow-emerald/20">
          <Zap className="h-5 w-5 text-emerald-950" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden animate-slide-up">
            <h1 className="text-sm font-bold text-sidebar-foreground tracking-wide">OmniVote</h1>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Monitor</p>
          </div>
        )}
      </div>

      {/* ── Live indicator ── */}
      <div className={cn(
        'shrink-0 transition-all duration-300',
        collapsed ? 'px-2 py-2.5 flex justify-center' : 'px-4 py-3'
      )}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-dot" />
          {!collapsed && <span className="text-[11px] text-emerald font-medium tracking-wide">ELECTION LIVE</span>}
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* ── Navigation items ── */}
      <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden', isMobile ? 'py-4' : 'py-2')} aria-label="Dashboard navigation">
        <TooltipProvider delayDuration={0}>
          {isFieldAgent ? (
            // Flat list for field agents
            <div className={cn('space-y-1', isMobile ? 'px-3 py-4' : 'px-2')}>
              {filteredFieldItems.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  activeTab={activeTab}
                  collapsed={collapsed}
                  unreadAlerts={item.id === 'alerts' ? unreadAlerts : 0}
                  onSelect={onTabSelect}
                  isMobile={isMobile}
                />
              ))}
            </div>
          ) : (
            // Grouped sections for admin/analyst roles
            <div className="space-y-0.5">
              {filteredSections.map((section) => (
                <div key={section.id} className="mb-1">
                  {/* Section label */}
                  {!collapsed && (
                    <p className="px-4 py-1.5 text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest">
                      {section.label}
                    </p>
                  )}
                  {collapsed && <div className="my-1 mx-3 border-t border-sidebar-border/50" />}
                  <div className={cn('space-y-0.5', isMobile ? 'px-3' : 'px-2')}>
                    {section.items.map((item) => (
                      <NavButton
                        key={item.id}
                        item={item}
                        activeTab={activeTab}
                        collapsed={collapsed}
                        unreadAlerts={item.id === 'alerts' ? unreadAlerts : 0}
                        onSelect={onTabSelect}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* My Reports at the bottom of nav (for non-field-agent roles) */}
              {allowedTabs.includes('my-reports') && (
                <>
                  <div className="my-1 mx-3 border-t border-sidebar-border/50" />
                  <div className={cn('space-y-0.5', isMobile ? 'px-3' : 'px-2')}>
                    <NavButton
                      item={{ id: 'my-reports' as ViewTab, label: 'My Reports', icon: <FileText className="h-4.5 w-4.5" /> }}
                      activeTab={activeTab}
                      collapsed={collapsed}
                      unreadAlerts={0}
                      onSelect={onTabSelect}
                      isMobile={isMobile}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </TooltipProvider>
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* ── User info + logout ── */}
      {collapsed && !isMobile ? (
        <div className="shrink-0 space-y-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="px-2 py-3 flex justify-center">
                <Avatar className="h-8 w-8 ring-1 ring-sidebar-border cursor-default">
                  <AvatarFallback className="bg-emerald/15 text-emerald text-xs font-bold">{initials}</AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="flex flex-col items-start gap-0.5">
              <p className="font-medium text-xs">{user.name}</p>
              <p className="text-[10px] text-muted-foreground">{user.role.replace(/_/g, ' ')}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onLogout}
                className="w-full flex justify-center py-1.5 text-sidebar-foreground/30 hover:text-rose transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <div className="px-3 py-3 shrink-0 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 ring-1 ring-sidebar-border">
              <AvatarFallback className="bg-emerald/15 text-emerald text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-sidebar-foreground truncate leading-tight">{user.name}</p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate mt-0.5">{user.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
          {isMobile && onClose && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="w-full justify-center gap-2 min-h-[44px] text-xs"
              aria-label="Close navigation menu"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Close Menu
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="w-full justify-start gap-2 h-8 text-xs text-sidebar-foreground/40 hover:text-rose hover:bg-rose/5 transition-colors"
            aria-label="Sign out of OmniVote"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign Out
          </Button>
        </div>
      )}

      {/* ── Collapse button — only on desktop ── */}
      {!isMobile && (
        <div className="p-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="w-full justify-center text-sidebar-foreground/30 hover:text-sidebar-foreground/70 h-8 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </>
  );
}

// ── Individual nav button with tooltip support ──
function NavButton({
  item,
  activeTab,
  collapsed,
  unreadAlerts,
  onSelect,
  isMobile = false,
}: {
  item: { id: ViewTab; label: string; icon: React.ReactNode };
  activeTab: ViewTab;
  collapsed: boolean;
  unreadAlerts: number;
  onSelect: (id: ViewTab) => void;
  isMobile?: boolean;
}) {
  const isActive = activeTab === item.id;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          onClick={() => onSelect(item.id)}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-all duration-150 outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring',
            isMobile ? 'px-3 min-h-[44px]' : (collapsed ? 'justify-center px-0 h-9' : 'px-3 h-9'),
            isActive
              ? 'bg-emerald/12 text-emerald sidebar-active-bar'
              : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/85 hover:bg-sidebar-accent/60'
          )}
          aria-current={isActive ? 'page' as const : undefined}
        >
          <span className="shrink-0" aria-hidden="true">{item.icon}</span>
          {!collapsed && (
            <span className="flex-1 text-left truncate">{item.label}</span>
          )}
          {!collapsed && item.id === 'alerts' && unreadAlerts > 0 && (
            <Badge variant="destructive" className="text-[9px] h-4.5 min-w-[18px] px-1.5 flex items-center justify-center">
              {unreadAlerts > 99 ? '99+' : unreadAlerts}
            </Badge>
          )}
        </motion.button>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right" className="flex items-center gap-2">
          {item.label}
          {item.id === 'alerts' && unreadAlerts > 0 && (
            <Badge variant="destructive" className="text-[9px] h-4 min-w-4 px-1">{unreadAlerts > 99 ? '99+' : unreadAlerts}</Badge>
          )}
        </TooltipContent>
      )}
    </Tooltip>
  );
}
