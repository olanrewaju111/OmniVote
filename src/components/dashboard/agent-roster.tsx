'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Users, UserCheck, UserX, Shield, ShieldAlert, Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface AgentData {
  users: {
    id: string; email: string; name: string; role: string; isOnline: boolean; lastSeenAt: string | null;
  }[];
}

export function AgentRoster() {
  const { data, isLoading } = useQuery<AgentData>({
    queryKey: ['roster'],
    queryFn: () => fetch('/api/auth').then(r => r.json()).then(d => ({ users: d.users })),
  });

  const users = data?.users || [];
  const fieldAgents = users.filter(u => u.role === 'FIELD_AGENT');
  const online = fieldAgents.filter(u => u.isOnline).length;

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald" />
            Agent Roster
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage field agents and organization users</p>
        </div>
        <Button className="bg-emerald hover:bg-emerald/90 text-emerald-950 text-sm gap-2">
          <UserCheck className="h-4 w-4" />
          Add Agent
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card/40">
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-emerald" />
              <span className="text-[11px] text-muted-foreground">Total Agents</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{fieldAgents.length}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald/20 bg-emerald/5">
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-emerald" />
              <span className="text-[11px] text-muted-foreground">Online Now</span>
            </div>
            <p className="text-xl font-bold tabular-nums text-emerald">{online}</p>
          </CardContent>
        </Card>
        <Card className="border-amber/20 bg-amber/5">
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <UserX className="h-4 w-4 text-amber" />
              <span className="text-[11px] text-muted-foreground">Offline</span>
            </div>
            <p className="text-xl font-bold tabular-nums text-amber">{fieldAgents.length - online}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/40">
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-cyan" />
              <span className="text-[11px] text-muted-foreground">All Users</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{users.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Role distribution */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(roleCounts).map(([role, count]) => (
          <Badge
            key={role}
            variant="outline"
            className={cn(
              'text-[11px] h-6',
              role === 'SUPER_ADMIN' ? 'border-emerald/30 text-emerald' :
              role === 'TENANT_ADMIN' ? 'border-cyan/30 text-cyan' :
              role === 'ANALYST' ? 'border-amber/30 text-amber' :
              role === 'TRUST_SAFETY' ? 'border-rose/30 text-rose' :
              'border-border text-muted-foreground'
            )}
          >
            {role.replace(/_/g, ' ')}: {count}
          </Badge>
        ))}
      </div>

      {/* Agent table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Field Agents</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search agents..." className="pl-8 h-8 w-48 text-xs" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[11px] h-9">Agent</TableHead>
                  <TableHead className="text-[11px] h-9">Status</TableHead>
                  <TableHead className="text-[11px] h-9 hidden sm:table-cell">Email</TableHead>
                  <TableHead className="text-[11px] h-9 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldAgents.map(agent => (
                  <TableRow key={agent.id} className="border-border hover:bg-card/60">
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                            {agent.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className={cn(
                            'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-card',
                            agent.isOnline ? 'bg-emerald' : 'bg-muted-foreground/30'
                          )} />
                        </div>
                        <span className="text-xs font-medium">{agent.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] h-5',
                          agent.isOnline
                            ? 'border-emerald/30 text-emerald bg-emerald/10'
                            : 'border-border text-muted-foreground'
                        )}
                      >
                        {agent.isOnline ? 'Online' : 'Offline'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 text-[11px] text-muted-foreground hidden sm:table-cell">{agent.email}</TableCell>
                    <TableCell className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="Remote Wipe">
                          <Wrench className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="View Reports">
                          <ShieldAlert className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}