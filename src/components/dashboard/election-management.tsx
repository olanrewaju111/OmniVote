'use client';

import { useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Plus, Pencil, Trash2, Calendar, MapPin, Users, Vote,
  X, ChevronDown, Search, Filter, Eye,
} from 'lucide-react';
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { fetchJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/store/dashboard';
import { useIsMobile } from '@/hooks/use-mobile';

// ---- Types ----
interface ElectionItem {
  id: string;
  tenantId: string;
  title: string;
  tier: 'LOCAL' | 'STATE' | 'PRESIDENTIAL';
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
  date: string;
  pollingUnitCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ElectionsResponse {
  elections: ElectionItem[];
}

interface DashboardResponse {
  election: {
    totalPollingUnits: number;
    openUnits: number;
    closedUnits: number;
    flaggedUnits: number;
    totalRegistered: number;
    totalVotes: number;
    avgTurnout: number;
  };
  pollingUnits: unknown[];
}

interface ResultsResponse {
  results: unknown[];
}

type TierFilter = 'ALL' | 'LOCAL' | 'STATE' | 'PRESIDENTIAL';
type StatusFilter = 'ALL' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED';

// ---- Zod Schema ----
const electionFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  tier: z.string().min(1, 'Select a tier'),
  date: z.string().min(1, 'Date is required'),
  status: z.string().min(1, 'Select a status'),
});

type ElectionFormValues = z.infer<typeof electionFormSchema>;

// ---- Constants ----
const TIER_BADGE: Record<string, string> = {
  LOCAL: 'border-cyan/30 text-cyan bg-cyan/10',
  STATE: 'border-amber/30 text-amber bg-amber/10',
  PRESIDENTIAL: 'border-emerald/30 text-emerald bg-emerald/10',
};

const STATUS_BADGE: Record<string, string> = {
  UPCOMING: 'border-border text-muted-foreground bg-muted/40',
  ACTIVE: 'border-emerald/30 text-emerald bg-emerald/10',
  COMPLETED: 'border-sky/30 text-sky bg-sky/10',
};

const TIER_OPTIONS: { value: TierFilter; label: string }[] = [
  { value: 'ALL', label: 'All Tiers' },
  { value: 'LOCAL', label: 'Local' },
  { value: 'STATE', label: 'State' },
  { value: 'PRESIDENTIAL', label: 'Presidential' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
];

const TIER_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: 'LOCAL', label: 'Local Government' },
  { value: 'STATE', label: 'Governorship' },
  { value: 'PRESIDENTIAL', label: 'Presidential' },
];

const STATUS_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
];

// ---- Helpers ----
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ---- Main Component ----
export function ElectionManagement() {
  const { tenantId, setSelectedTab } = useDashboardStore();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // ---- Local state ----
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingElection, setEditingElection] = useState<ElectionItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingElection, setDeletingElection] = useState<ElectionItem | null>(null);

  // Form (react-hook-form + zod)
  const {
    register: formRegister,
    handleSubmit: handleFormSubmit,
    formState: { errors: formErrors },
    control: formControl,
    reset: resetForm,
    setValue: setFormValue,
  } = useForm<ElectionFormValues>({
    resolver: zodResolver(electionFormSchema),
    defaultValues: {
      title: '',
      tier: '',
      date: '',
      status: '',
    },
  });

  // ---- Data fetching ----
  const { data: electionsData, isLoading } = useQuery({
    queryKey: ['elections', tenantId],
    queryFn: async () => {
      return fetchJson<ElectionsResponse>(`/api/elections?tenantId=${tenantId}`);
    },
    refetchInterval: 30000,
    enabled: !!tenantId,
  });

  const elections = electionsData?.elections || [];

  // Dashboard data for polling unit count and results
  const { data: dashData } = useQuery({
    queryKey: ['dashboard-pu-count', tenantId],
    queryFn: async () => {
      return fetchJson<DashboardResponse>(`/api/dashboard?tenantId=${tenantId}`);
    },
    refetchInterval: 30000,
    enabled: !!tenantId,
  });

  const pollingUnitCount = dashData?.election?.totalPollingUnits ?? 0;
  const resultsCount = dashData?.election?.totalVotes ?? 0;

  // ---- Filtering ----
  const filteredElections = useMemo(() => {
    return elections.filter((e) => {
      const matchesSearch = !search ||
        e.title.toLowerCase().includes(search.toLowerCase());
      const matchesTier = tierFilter === 'ALL' || e.tier === tierFilter;
      const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
      return matchesSearch && matchesTier && matchesStatus;
    });
  }, [elections, search, tierFilter, statusFilter]);

  // ---- Mutations ----
  const createMutation = useMutation({
    mutationFn: async (data: { title: string; tier: string; date: string; status: string }) => {
      return fetchJson('/api/elections?tenantId=' + tenantId, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Election created successfully');
      closeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create election');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title?: string; tier?: string; date?: string; status?: string } }) => {
      return fetchJson(`/api/elections/${id}?tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Election updated successfully');
      closeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update election');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return fetchJson(`/api/elections/${id}?tenantId=${tenantId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Election deleted successfully');
      setDeleteConfirmOpen(false);
      setDeletingElection(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete election');
    },
  });

  // ---- Dialog helpers ----
  const openCreateDialog = useCallback(() => {
    setEditingElection(null);
    resetForm({ title: '', tier: '', date: '', status: '' });
    setDialogOpen(true);
  }, [resetForm]);

  const openEditDialog = useCallback((election: ElectionItem) => {
    setEditingElection(election);
    // Format date for input[type=date] = YYYY-MM-DD
    let formattedDate = '';
    try {
      formattedDate = new Date(election.date).toISOString().split('T')[0];
    } catch {
      // keep empty
    }
    resetForm({
      title: election.title,
      tier: election.tier,
      date: formattedDate,
      status: election.status,
    });
    setDialogOpen(true);
  }, [resetForm]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingElection(null);
    resetForm({ title: '', tier: '', date: '', status: '' });
  }, [resetForm]);

  const onFormValid = useCallback((data: ElectionFormValues) => {
    if (editingElection) {
      const payload: { title?: string; tier?: string; date?: string; status?: string } = {
        title: data.title.trim(),
        tier: data.tier || undefined,
        date: data.date,
        status: data.status || undefined,
      };
      updateMutation.mutate({ id: editingElection.id, data: payload });
    } else {
      createMutation.mutate({
        title: data.title.trim(),
        tier: data.tier || 'LOCAL',
        date: data.date,
        status: data.status || 'UPCOMING',
      });
    }
  }, [editingElection, createMutation, updateMutation]);

  const handleSave = useCallback(() => {
    handleFormSubmit(onFormValid)();
  }, [handleFormSubmit, onFormValid]);

  const handleDelete = useCallback(() => {
    if (deletingElection) {
      deleteMutation.mutate(deletingElection.id);
    }
  }, [deletingElection, deleteMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ---- Render ----
  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Election Management</h2>
          <p className="text-sm text-muted-foreground">
            {filteredElections.length} of {elections.length} election{elections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreateDialog} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {!isMobile && 'Create Election'}
        </Button>
      </div>

      <Separator />

      {/* Search / Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search elections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-9 shrink-0">
              <Filter className="h-3.5 w-3.5" />
              Tier: {TIER_OPTIONS.find((o) => o.value === tierFilter)?.label}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {TIER_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setTierFilter(opt.value)}
                className={cn(tierFilter === opt.value && 'bg-accent')}
              >
                {tierFilter === opt.value && <Check className="h-3.5 w-3.5 mr-1.5" />}
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-9 shrink-0">
              <Filter className="h-3.5 w-3.5" />
              Status: {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {STATUS_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn(statusFilter === opt.value && 'bg-accent')}
              >
                {statusFilter === opt.value && <Check className="h-3.5 w-3.5 mr-1.5" />}
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Election Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 space-y-3">
                <div className="h-5 w-3/4 rounded bg-muted" />
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded bg-muted" />
                  <div className="h-5 w-20 rounded bg-muted" />
                </div>
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="flex gap-4">
                  <div className="h-4 w-16 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredElections.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="rounded-full bg-muted/50 p-4 mb-4">
            <Vote className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium text-muted-foreground">
            {search || tierFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'No elections match your filters'
              : 'No elections yet'}
          </h3>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {search || tierFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try adjusting your search or filters'
              : 'Create your first election to get started'}
          </p>
          {!search && tierFilter === 'ALL' && statusFilter === 'ALL' && (
            <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Create Election
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredElections.map((election, idx) => (
              <motion.div
                key={election.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.25, delay: idx * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <Card className="group hover:shadow-md transition-shadow duration-200">
                  <CardContent className="p-4 space-y-3">
                    {/* Title & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm leading-tight line-clamp-2">
                        {election.title}
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] px-1.5 py-0', TIER_BADGE[election.tier])}
                        >
                          {election.tier}
                        </Badge>
                      </div>
                    </div>

                    {/* Status badge */}
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0 gap-1',
                        STATUS_BADGE[election.status],
                        election.status === 'ACTIVE' && 'animate-pulse'
                      )}
                    >
                      {election.status === 'ACTIVE' && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald" />
                        </span>
                      )}
                      {election.status}
                    </Badge>

                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(election.date)}</span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{election.pollingUnitCount.toLocaleString()} units</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Vote className="h-3.5 w-3.5" />
                        <span>{resultsCount.toLocaleString()} results</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 hover:bg-accent"
                        onClick={() => setSelectedTab('overview')}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 hover:bg-accent"
                        onClick={() => openEditDialog(election)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 hover:bg-rose/10 hover:text-rose text-muted-foreground"
                        onClick={() => {
                          setDeletingElection(election);
                          setDeleteConfirmOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingElection ? 'Edit Election' : 'Create Election'}
              </DialogTitle>
              <DialogDescription>
                {editingElection
                  ? 'Update the election details below.'
                  : 'Fill in the details to create a new election.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Title */}
              <div className="grid gap-2">
                <Label htmlFor="election-title">Title</Label>
                <Input
                  {...formRegister('title')}
                  id="election-title"
                  placeholder="e.g. 2027 General Election"
                  className={cn(formErrors.title && "border-rose/50 focus-visible:ring-rose/30")}
                />
                {formErrors.title && (
                  <p className="text-xs text-rose">{formErrors.title.message}</p>
                )}
              </div>

              {/* Tier */}
              <div className="grid gap-2">
                <Label htmlFor="election-tier">Tier</Label>
                <Controller
                  name="tier"
                  control={formControl}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="election-tier" className={cn(formErrors.tier && "border-rose/50")}>
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIER_SELECT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {formErrors.tier && (
                  <p className="text-xs text-rose">{formErrors.tier.message}</p>
                )}
              </div>

              {/* Date */}
              <div className="grid gap-2">
                <Label htmlFor="election-date">Date</Label>
                <Input
                  {...formRegister('date')}
                  id="election-date"
                  type="date"
                  className={cn(formErrors.date && "border-rose/50 focus-visible:ring-rose/30")}
                />
                {formErrors.date && (
                  <p className="text-xs text-rose">{formErrors.date.message}</p>
                )}
              </div>

              {/* Status */}
              <div className="grid gap-2">
                <Label htmlFor="election-status">Status</Label>
                <Controller
                  name="status"
                  control={formControl}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="election-status" className={cn(formErrors.status && "border-rose/50")}>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_SELECT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {formErrors.status && (
                  <p className="text-xs text-rose">{formErrors.status.message}</p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={closeDialog} disabled={isSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
                {isSaving ? (
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {editingElection ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Election</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deletingElection?.title}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="gap-1.5"
            >
              {deleteMutation.isPending ? (
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
