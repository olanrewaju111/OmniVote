'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDashboardStore } from '@/store/dashboard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, Users, UserCheck, UserX, Shield, ShieldAlert, Wrench,
  Loader2, FileText, Trash2, Eye, ToggleLeft, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AgentUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  _count?: { incidents: number; auditLogs: number };
}

interface ReportsSlideOver {
  agent: AgentUser | null;
  open: boolean;
}

export function AgentRoster() {
  const queryClient = useQueryClient();
  const { tenantId } = useDashboardStore();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [addOpen, setAddOpen] = useState(false);
  const [reportsPanel, setReportsPanel] = useState<ReportsSlideOver>({ agent: null, open: false });
  const [confirmAction, setConfirmAction] = useState<{ type: string; agent: AgentUser | null }>({ type: '', agent: null });

  // Add agent form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('FIELD_AGENT');

  // Fetch agents from proper API
  const { data, isLoading, refetch } = useQuery<{ users: AgentUser[] }>({
    queryKey: ['agents', search, roleFilter, tenantId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (tenantId) params.set('tenantId', tenantId);
      return fetch(`/api/agents?${params}`).then(r => r.json());
    },
  });

  // Add agent mutation
  const addMutation = useMutation({
    mutationFn: (body: { name: string; email: string; role: string }) =>
      fetch(`/api/agents?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success(`Agent "${data.user.name}" added successfully`);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setAddOpen(false);
      setNewName(''); setNewEmail(''); setNewRole('FIELD_AGENT');
    },
    onError: () => toast.error('Failed to add agent'),
  });

  // Action mutation (toggle online, remote wipe, change role, delete)
  const actionMutation = useMutation({
    mutationFn: (body: { userId: string; action: string; newRole?: string }) =>
      fetch(`/api/agents?tenantId=${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: (data, variables) => {
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (variables.action === 'DELETE') {
        toast.success(data.message || 'Agent removed');
      } else if (variables.action === 'REMOTE_WIPE') {
        toast.success(`Remote wipe sent to ${confirmAction.agent?.name}. Device data cleared.`);
      } else if (variables.action === 'CHANGE_ROLE') {
        toast.success(`Role changed to ${variables.newRole?.replace(/_/g, ' ')}`);
      } else {
        toast.success('Status updated');
      }
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setConfirmAction({ type: '', agent: null });
    },
    onError: () => toast.error('Action failed'),
  });

  const users = data?.users || [];
  const fieldAgents = users.filter(u => u.role === 'FIELD_AGENT');
  const online = fieldAgents.filter(u => u.isOnline).length;

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  // Search with debounce via the query key
  const handleSearch = useCallback(() => {
    setSearch(searchInput);
  }, [searchInput]);

  // Handle confirm action
  const handleConfirmAction = () => {
    if (!confirmAction.agent) return;
    if (confirmAction.type === 'DELETE') {
      actionMutation.mutate({ userId: confirmAction.agent.id, action: 'DELETE' });
    } else if (confirmAction.type === 'REMOTE_WIPE') {
      actionMutation.mutate({ userId: confirmAction.agent.id, action: 'REMOTE_WIPE' });
    } else if (confirmAction.type === 'CHANGE_ROLE') {
      actionMutation.mutate({ userId: confirmAction.agent.id, action: 'CHANGE_ROLE', newRole: 'ANALYST' });
    }
  };

  // Handle add agent
  const handleAddAgent = () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (!newEmail.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }
    addMutation.mutate({ name: newName.trim(), email: newEmail.trim(), role: newRole });
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald" />
            Agent Roster
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage field agents and organization users</p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-emerald hover:bg-emerald/90 text-emerald-950 text-sm gap-2"
        >
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

      {/* Role filter + distribution badges */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(roleCounts).map(([role, count]) => (
            <button
              key={role}
              onClick={() => setRoleFilter(roleFilter === role ? 'ALL' : role)}
              className="cursor-pointer"
            >
              <Badge
                variant="outline"
                className={cn(
                  'text-[11px] h-6 transition-colors',
                  roleFilter === role ? 'bg-foreground/10' : '',
                  role === 'SUPER_ADMIN' ? 'border-emerald/30 text-emerald' :
                  role === 'TENANT_ADMIN' ? 'border-cyan/30 text-cyan' :
                  role === 'ANALYST' ? 'border-amber/30 text-amber' :
                  role === 'TRUST_SAFETY' ? 'border-rose/30 text-rose' :
                  'border-border text-muted-foreground'
                )}
              >
                {role.replace(/_/g, ' ')}: {count}
              </Badge>
            </button>
          ))}
        </div>
        {roleFilter !== 'ALL' && (
          <button onClick={() => setRoleFilter('ALL')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="h-3 w-3" /> Clear filter
          </button>
        )}
      </div>

      {/* Agent table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">
              {roleFilter === 'ALL' ? 'All Users' : roleFilter.replace(/_/g, ' ')}
              <span className="text-muted-foreground font-normal ml-2">({users.length})</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8 h-8 w-48 text-xs"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSearch}>
                Search
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="max-h-[480px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-emerald" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No users found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] h-9">User</TableHead>
                    <TableHead className="text-[11px] h-9">Role</TableHead>
                    <TableHead className="text-[11px] h-9">Status</TableHead>
                    <TableHead className="text-[11px] h-9 hidden sm:table-cell">Email</TableHead>
                    <TableHead className="text-[11px] h-9 hidden md:table-cell">Reports</TableHead>
                    <TableHead className="text-[11px] h-9 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {users.map(agent => (
                      <motion.tr
                        key={agent.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="border-border hover:bg-card/60 transition-colors"
                      >
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
                            <div className="min-w-0">
                              <span className="text-xs font-medium block truncate max-w-[140px]">{agent.name}</span>
                              {agent.lastSeenAt && (
                                <span className="text-[10px] text-muted-foreground/60">
                                  Last: {new Date(agent.lastSeenAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] h-5',
                              agent.role === 'SUPER_ADMIN' ? 'border-emerald/30 text-emerald' :
                              agent.role === 'TENANT_ADMIN' ? 'border-cyan/30 text-cyan' :
                              agent.role === 'ANALYST' ? 'border-amber/30 text-amber' :
                              agent.role === 'TRUST_SAFETY' ? 'border-rose/30 text-rose' :
                              'border-border text-muted-foreground'
                            )}
                          >
                            {agent.role.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <button
                            onClick={() => actionMutation.mutate({ userId: agent.id, action: 'TOGGLE_ONLINE' })}
                            className="cursor-pointer"
                            disabled={actionMutation.isPending}
                          >
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] h-5 transition-colors cursor-pointer',
                                agent.isOnline
                                  ? 'border-emerald/30 text-emerald bg-emerald/10 hover:bg-emerald/20'
                                  : 'border-border text-muted-foreground hover:bg-card'
                              )}
                            >
                              <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', agent.isOnline ? 'bg-emerald' : 'bg-muted-foreground/40')} />
                              {agent.isOnline ? 'Online' : 'Offline'}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="py-2.5 text-[11px] text-muted-foreground hidden sm:table-cell truncate max-w-[180px]">{agent.email}</TableCell>
                        <TableCell className="py-2.5 hidden md:table-cell">
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {agent._count?.incidents ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="View Reports"
                              onClick={() => setReportsPanel({ agent, open: true })}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-amber"
                              title="Remote Wipe Device"
                              onClick={() => setConfirmAction({ type: 'REMOTE_WIPE', agent })}
                              disabled={actionMutation.isPending}
                            >
                              <Wrench className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose"
                              title="Remove Agent"
                              onClick={() => setConfirmAction({ type: 'DELETE', agent })}
                              disabled={actionMutation.isPending || agent.role === 'SUPER_ADMIN'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== ADD AGENT DIALOG ===== */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald" />
              Add New Agent
            </DialogTitle>
            <DialogDescription>
              Create a new user account. They will be able to login from the main screen using their email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Full Name</label>
              <Input
                placeholder="e.g. Adebayo Johnson"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Email Address</label>
              <Input
                placeholder="e.g. agent@nigeriaelectionwatch.org"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIELD_AGENT">Field Agent</SelectItem>
                  <SelectItem value="ANALYST">Analyst</SelectItem>
                  <SelectItem value="TRUST_SAFETY">Trust &amp; Safety</SelectItem>
                  <SelectItem value="TENANT_ADMIN">Tenant Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleAddAgent}
              disabled={addMutation.isPending || !newName.trim() || !newEmail.trim()}
              className="bg-emerald hover:bg-emerald/90 text-emerald-950"
            >
              {addMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Adding...</>
              ) : (
                <><UserCheck className="h-4 w-4 mr-1.5" /> Add Agent</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== CONFIRM ACTION DIALOG ===== */}
      <AlertDialog open={!!confirmAction.type} onOpenChange={(open) => !open && setConfirmAction({ type: '', agent: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(
              confirmAction.type === 'DELETE' ? 'text-rose' : 'text-amber'
            )}>
              {confirmAction.type === 'DELETE' ? 'Remove Agent' :
               confirmAction.type === 'REMOTE_WIPE' ? 'Remote Wipe Device' :
               'Confirm Action'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction.type === 'DELETE' && (
                <>Are you sure you want to permanently remove <strong>{confirmAction.agent?.name}</strong>? This will delete their account and all associated audit logs. This action cannot be undone.</>
              )}
              {confirmAction.type === 'REMOTE_WIPE' && (
                <>Send a remote wipe command to <strong>{confirmAction.agent?.name}</strong>&apos;s device? This will clear all cached data, credentials, and session tokens on the device. The agent will be set to offline.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={actionMutation.isPending}
              className={cn(
                confirmAction.type === 'DELETE'
                  ? 'bg-rose hover:bg-rose/90 text-white'
                  : 'bg-amber hover:bg-amber/90 text-amber-950'
              )}
            >
              {actionMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Processing...</>
              ) : confirmAction.type === 'DELETE' ? (
                <><Trash2 className="h-4 w-4 mr-1.5" /> Remove Permanently</>
              ) : (
                <><Wrench className="h-4 w-4 mr-1.5" /> Send Remote Wipe</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== REPORTS SLIDE PANEL ===== */}
      <Dialog open={reportsPanel.open} onOpenChange={(open) => setReportsPanel({ ...reportsPanel, open })}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber" />
              Reports by {reportsPanel.agent?.name}
            </DialogTitle>
            <DialogDescription>
              Viewing all incident reports submitted by this agent
            </DialogDescription>
          </DialogHeader>
          <AgentReportsPanel agentId={reportsPanel.agent?.id || ''} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component: fetches and displays reports for a specific agent
function AgentReportsPanel({ agentId }: { agentId: string }) {
  const { data, isLoading } = useQuery<{ incidents: Array<{
    id: string; type: string; severity: string; status: string;
    description: string; submittedAt: string;
    pollingUnit: { name: string; state: string; lga: string } | null;
  }>; total: number }>({
    queryKey: ['agent-reports', agentId],
    queryFn: () => fetch(`/api/incidents?reporterId=${agentId}&limit=50`).then(r => r.json()),
    enabled: !!agentId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-emerald" />
      </div>
    );
  }

  const incidents = data?.incidents || [];

  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No reports submitted yet</p>
      </div>
    );
  }

  const severityColors: Record<string, string> = {
    LOW: 'border-emerald/30 text-emerald bg-emerald/10',
    MEDIUM: 'border-amber/30 text-amber bg-amber/10',
    HIGH: 'border-orange/30 text-orange bg-orange/10',
    CRITICAL: 'border-rose/30 text-rose bg-rose/10',
  };

  const statusColors: Record<string, string> = {
    PENDING: 'text-muted-foreground',
    REVIEWED: 'text-cyan',
    ESCALATED: 'text-amber',
    DISMISSED: 'text-muted-foreground/50',
    QUARANTINED: 'text-rose',
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
      <p className="text-xs text-muted-foreground mb-2">{data?.total || 0} total reports</p>
      {incidents.map(inc => (
        <div key={inc.id} className="rounded-lg border border-border bg-card/40 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('text-[10px] h-5', severityColors[inc.severity] || '')}>
                {inc.severity}
              </Badge>
              <Badge variant="outline" className="text-[10px] h-5 border-border text-muted-foreground">
                {inc.type.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-[10px] font-medium', statusColors[inc.status] || '')}>
                {inc.status}
              </span>
            </div>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">{inc.description}</p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            {inc.pollingUnit && (
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                {inc.pollingUnit.name}, {inc.pollingUnit.state}
              </span>
            )}
            <span>{new Date(inc.submittedAt).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}