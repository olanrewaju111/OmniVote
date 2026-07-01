'use client';

import { Activity, Bell, Search, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useDashboardStore } from '@/store/dashboard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

interface HeaderProps {
  kpis?: {
    onlineAgents: number;
    totalAgents: number;
    unreadAlerts: number;
    securityAlerts: number;
  };
}

export function AppHeader({ kpis }: HeaderProps) {
  const { electionTier, setElectionTier, alertFilter, setAlertFilter, setSelectedTab, user, logout } = useDashboardStore();

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 gap-4 shrink-0 z-10">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search polling units, incidents, agents..."
          className="pl-9 h-9 bg-background border-border text-sm"
        />
      </div>

      {/* Election Tier Selector */}
      <Select value={electionTier} onValueChange={(v) => setElectionTier(v as 'LOCAL' | 'STATE' | 'PRESIDENTIAL')}>
        <SelectTrigger className="w-44 h-9 text-sm bg-background border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PRESIDENTIAL">Presidential</SelectItem>
          <SelectItem value="STATE">Governorship</SelectItem>
          <SelectItem value="LOCAL">Local Government</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 ml-auto">
        {/* System health — only for admin roles */}
        {user && (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') && (
          <div className="hidden md:flex items-center gap-2 px-3 h-9 rounded-md bg-background border border-border">
            <Activity className="h-3.5 w-3.5 text-emerald" />
            <span className="text-xs text-muted-foreground">All Systems</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
          </div>
        )}

        {/* AI Defense — hide for field agents */}
        {user && user.role !== 'FIELD_AGENT' && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 bg-background border-border text-sm"
            onClick={() => setSelectedTab('alerts')}
          >
            <Shield className="h-4 w-4 text-cyan" />
            <span className="hidden sm:inline">Defense</span>
            {kpis?.securityAlerts ? (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                {kpis.securityAlerts}
              </Badge>
            ) : null}
          </Button>
        )}

        {/* Notifications */}
        <Button
          variant="outline"
          size="sm"
          className="relative h-9 w-9 p-0 bg-background border-border"
          onClick={() => setSelectedTab('alerts')}
        >
          <Bell className="h-4 w-4" />
          {kpis?.unreadAlerts ? (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-[9px] font-bold flex items-center justify-center text-white">
              {kpis.unreadAlerts > 9 ? '9+' : kpis.unreadAlerts}
            </span>
          ) : null}
        </Button>

        <Separator orientation="vertical" className="h-8 bg-border" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 px-2 gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-emerald/20 text-emerald text-xs font-bold">
                  {user?.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '??'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-medium leading-tight">{user?.name || 'User'}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{user?.role?.replace(/_/g, ' ') || ''}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem><User className="mr-2 h-4 w-4" />Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={logout}>Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}