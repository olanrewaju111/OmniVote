'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDashboardStore } from '@/store/dashboard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Search, ChevronLeft, ChevronRight, RefreshCw, Filter, ScrollText } from 'lucide-react';
import { ExportButton } from '@/components/dashboard/export-button';

interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  userTenantId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  LOGOUT: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  INCIDENT_REPORTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  INCIDENT_UPDATED: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  INCIDENT_DISMISSED: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  DATA_EXPORTED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ELECTION_CREATED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  ELECTION_UPDATED: 'bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200',
  ELECTION_DELETED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  USER_CREATED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  USER_UPDATED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-800 dark:text-cyan-200',
  AGENT_ASSIGNED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  AGENT_CHECKIN: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  ALERT_CREATED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  SECURITY_EVENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  TENANT_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
  ANALYST: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  TRUST_SAFETY: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
  FIELD_AGENT: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
};

const COMMON_ACTIONS = [
  'ALL_ACTIONS',
  'LOGIN', 'LOGOUT',
  'INCIDENT_REPORTED', 'INCIDENT_UPDATED', 'INCIDENT_DISMISSED',
  'DATA_EXPORTED',
  'ELECTION_CREATED', 'ELECTION_UPDATED', 'ELECTION_DELETED',
  'USER_CREATED', 'USER_UPDATED',
  'AGENT_ASSIGNED', 'AGENT_CHECKIN',
  'ALERT_CREATED', 'SECURITY_EVENT',
];

export function AuditLogViewer() {
  const { tenantId } = useDashboardStore();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL_ACTIONS');
  const [entityTypeFilter, setEntityTypeFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedMeta, setExpandedMeta] = useState<string | null>(null);
  const pageSize = 50;

  const fetchLogs = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tenantId,
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (actionFilter !== 'ALL_ACTIONS') params.set('action', actionFilter);
      if (entityTypeFilter !== 'ALL') params.set('entityType', entityTypeFilter);

      const res = await fetch(`/api/audit-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, actionFilter, entityTypeFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = searchQuery
    ? logs.filter(l =>
        l.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.entityType || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.entityId || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs;

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <ScrollText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Audit Trail</h2>
            <p className="text-sm text-muted-foreground">
              {total} log entries across all system activity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-1" />
            Filters
          </Button>
          <ExportButton exportType="audit-logs" />
          <Button variant="outline" size="sm" onClick={() => { setPage(0); fetchLogs(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3">
              <div className="w-48">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Action</label>
                <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMON_ACTIONS.map(a => (
                      <SelectItem key={a} value={a}>
                        {a === 'ALL_ACTIONS' ? 'All Actions' : a.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Entity Type</label>
                <Select value={entityTypeFilter} onValueChange={(v) => { setEntityTypeFilter(v); setPage(0); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Entities</SelectItem>
                    <SelectItem value="Incident">Incident</SelectItem>
                    <SelectItem value="Election">Election</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                    <SelectItem value="Alert">Alert</SelectItem>
                    <SelectItem value="AgentCheckin">Agent Check-in</SelectItem>
                    <SelectItem value="Export">Export</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by user, action, entity..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Timestamp</TableHead>
                  <TableHead className="w-[130px]">User</TableHead>
                  <TableHead className="w-[100px]">Role</TableHead>
                  <TableHead className="w-[170px]">Action</TableHead>
                  <TableHead className="w-[100px]">Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-[120px]">IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>No audit log entries found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedMeta(expandedMeta === log.id ? null : log.id)}>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString('en-NG', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{log.userName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[log.userRole] || ''}`}>
                          {log.userRole.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ACTION_COLORS[log.action] || ''}`}>
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.entityType ? (
                          <span>
                            {log.entityType}
                            {log.entityId && (
                              <span className="text-muted-foreground font-mono text-[10px] block truncate max-w-[80px]">
                                {log.entityId.substring(0, 8)}...
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <div>
                            {expandedMeta === log.id ? (
                              <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            ) : (
                              <span className="truncate block">
                                {Object.entries(log.metadata)
                                  .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                                  .join(' | ')
                                  .substring(0, 80)}...
                              </span>
                            )}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {log.ipAddress || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">Page {page + 1} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}