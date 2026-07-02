'use client';

import { cn } from '@/lib/utils';
import { useDashboardStore, ROLE_TABS, type ViewTab, type UserRole } from '@/store/dashboard';
import {
  LayoutDashboard, BarChart3, Map, Radio, ShieldAlert, Brain, Image as ImageIcon,
  ChevronLeft, ChevronRight, Activity, Zap, Users, Send, FileText,
  Server, Building2, LogOut, MessageSquareWarning, Globe, Megaphone, CalendarDays,
  Shield, MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const ALL_NAV: { id: ViewTab; label: string; icon: React.ReactNode; roles: UserRole[] }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] },
  { id: 'situation', label: 'Situation Room', icon: <BarChart3 className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] },
  { id: 'map', label: 'Geo Map', icon: <Map className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] },
  { id: 'feed', label: 'Live Feed', icon: <Radio className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY', 'FIELD_AGENT'] },
  { id: 'alerts', label: 'Alert Triage', icon: <ShieldAlert className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
  { id: 'osint', label: 'OSINT Monitor', icon: <Globe className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
  { id: 'ai', label: 'AI Engine', icon: <Brain className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
  { id: 'media', label: 'Media Vault', icon: <ImageIcon className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
  { id: 'mobilization', label: 'Mobilization', icon: <Megaphone className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
  { id: 'campaigns', label: 'Campaign Monitor', icon: <CalendarDays className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
  { id: 'security', label: 'Security Center', icon: <Shield className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'TRUST_SAFETY'] },
  { id: 'field-safety', label: 'Field Safety', icon: <MapPin className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
  { id: 'agents', label: 'Agent Roster', icon: <Users className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
  { id: 'engagement', label: 'Agent Engagement', icon: <MessageSquareWarning className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
  { id: 'system', label: 'System Health', icon: <Server className="h-5 w-5" />, roles: ['SUPER_ADMIN'] },
  { id: 'tenants', label: 'Settings', icon: <Building2 className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
  { id: 'submit', label: 'Submit Report', icon: <Send className="h-5 w-5" />, roles: ['FIELD_AGENT'] },
  { id: 'my-reports', label: 'Reports', icon: <FileText className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY', 'FIELD_AGENT'] },
];

export function AppSidebar() {
  const {
    activeTab, setSelectedTab, sidebarCollapsed, toggleSidebar, user, logout, unreadAlerts,
  } = useDashboardStore();

  if (!user) return null;

  const allowedTabs = ROLE_TABS[user.role] || [];
  const navItems = ALL_NAV.filter(item => allowedTabs.includes(item.id));

  const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2);

  return (
    <aside className={cn(
      'flex flex-col h-screen border-r border-border bg-sidebar transition-all duration-300 relative z-20',
      sidebarCollapsed ? 'w-16' : 'w-56'
    )}>
      {/* Logo area */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-emerald flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-emerald-950" />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-sidebar-foreground tracking-wide">OmniVote</h1>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Monitor</p>
          </div>
        )}
      </div>

      {/* Live indicator */}
      <div className="px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-dot" />
          {!sidebarCollapsed && <span className="text-xs text-emerald font-medium">ELECTION LIVE</span>}
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedTab(item.id)}
                  className={cn(
                    'w-full justify-start gap-3 h-10 text-sm font-medium transition-colors',
                    activeTab === item.id
                      ? 'bg-emerald/15 text-emerald hover:bg-emerald/20 hover:text-emerald'
                      : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                    sidebarCollapsed && 'justify-center px-0'
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!sidebarCollapsed && item.label}
                  {item.id === 'alerts' && !sidebarCollapsed && unreadAlerts > 0 && (
                    <Badge variant="destructive" className="ml-auto text-[10px] h-5 min-w-5 px-1.5">
                      {unreadAlerts > 99 ? '99+' : unreadAlerts}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              {sidebarCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User info + logout */}
      {!sidebarCollapsed && (
        <div className="px-3 py-3 shrink-0 space-y-2">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-emerald/20 text-emerald text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{user.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-start gap-2 h-8 text-xs text-sidebar-foreground/50 hover:text-rose"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      )}

      {/* Collapse button */}
      <div className="p-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}