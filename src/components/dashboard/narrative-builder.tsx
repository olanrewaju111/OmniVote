'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Plus, Loader2, Trophy, ShieldAlert, Route,
  ChevronDown, ChevronUp, Clock, MessageSquare, Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { fetchJson } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard';

// ─── Types ───────────────────────────────────────────────────────────

type MessageCategory = 'LEADING' | 'COUNTER' | 'MOTIVATIONAL';
type TimelineEventType = 'MILESTONE' | 'INCIDENT_RESPONSE' | 'STRATEGY_SHIFT';

type CategoryFilter = 'ALL' | MessageCategory;

interface KeyMessage {
  id: string;
  title: string;
  body: string;
  category: MessageCategory;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

interface TalkingPoint {
  id: string;
  point: string;
  category: string;
  context: string;
  isActive: boolean;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: TimelineEventType;
}

interface NarrativeData {
  keyMessages: KeyMessage[];
  talkingPoints: TalkingPoint[];
  narrativeTimeline: TimelineEvent[];
}

// ─── Constants ───────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<MessageCategory, { badge: string; dot: string }> = {
  LEADING: {
    badge: 'bg-emerald/10 text-emerald border-emerald/30',
    dot: 'bg-emerald',
  },
  COUNTER: {
    badge: 'bg-rose/10 text-rose border-rose/30',
    dot: 'bg-rose',
  },
  MOTIVATIONAL: {
    badge: 'bg-amber/10 text-amber border-amber/30',
    dot: 'bg-amber',
  },
};

const CATEGORY_LABELS: Record<MessageCategory, string> = {
  LEADING: 'Leading',
  COUNTER: 'Counter',
  MOTIVATIONAL: 'Motivational',
};

const TIMELINE_STYLES: Record<TimelineEventType, { color: string; bg: string; border: string; badge: string }> = {
  MILESTONE: {
    color: 'text-amber',
    bg: 'bg-amber/10',
    border: 'border-amber/30',
    badge: 'text-amber border-amber/30 bg-amber/10',
  },
  INCIDENT_RESPONSE: {
    color: 'text-rose',
    bg: 'bg-rose/10',
    border: 'border-rose/30',
    badge: 'text-rose border-rose/30 bg-rose/10',
  },
  STRATEGY_SHIFT: {
    color: 'text-violet',
    bg: 'bg-violet/10',
    border: 'border-violet/30',
    badge: 'text-violet border-violet/30 bg-violet/10',
  },
};

const TIMELINE_ICONS: Record<TimelineEventType, typeof Trophy> = {
  MILESTONE: Trophy,
  INCIDENT_RESPONSE: ShieldAlert,
  STRATEGY_SHIFT: Route,
};

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCreated(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description }: { icon: typeof MessageSquare; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground/70 max-w-xs">{description}</p>
    </div>
  );
}

// ─── Priority Bar ────────────────────────────────────────────────────

function PriorityBar({ priority }: { priority: number }) {
  const width = Math.max(10, (priority / 10) * 100);
  const color =
    priority >= 8 ? 'bg-rose' : priority >= 5 ? 'bg-amber' : 'bg-emerald';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-3 text-right">{priority}</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function NarrativeBuilder() {
  const { tenantId } = useDashboardStore();
  const queryClient = useQueryClient();

  // UI state
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedPoint, setExpandedPoint] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: '',
    body: '',
    category: 'LEADING' as MessageCategory,
    priority: '5',
  });

  // ─── Data fetching ────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery<NarrativeData>({
    queryKey: ['narrative', tenantId],
    queryFn: async () => fetchJson(`/api/narrative?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const keyMessages = data?.keyMessages ?? [];
  const talkingPoints = data?.talkingPoints ?? [];
  const narrativeTimeline = data?.narrativeTimeline ?? [];

  // ─── Mutations ────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (payload: { title: string; body: string; category: MessageCategory; priority: number }) => {
      return fetchJson<{ success: boolean }>(`/api/narrative?tenantId=${tenantId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success('Message created', {
        description: 'New key message has been added to the narrative.',
      });
      queryClient.invalidateQueries({ queryKey: ['narrative', tenantId] });
      setDialogOpen(false);
      setForm({ title: '', body: '', category: 'LEADING', priority: '5' });
    },
    onError: () => {
      toast.error('Failed to create message', {
        description: 'Please try again.',
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ messageId, isActive }: { messageId: string; isActive: boolean }) => {
      return fetchJson<{ success: boolean }>(`/api/narrative?tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ messageId, isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['narrative', tenantId] });
    },
    onError: () => {
      toast.error('Failed to update message status');
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────

  const handleCreate = useCallback(() => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Please fill in both title and body');
      return;
    }
    const priorityNum = Math.min(10, Math.max(1, parseInt(form.priority, 10) || 5));
    createMutation.mutate({
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      priority: priorityNum,
    });
  }, [form, createMutation]);

  const handleToggleMessage = useCallback(
    (messageId: string, isActive: boolean) => {
      toggleMutation.mutate({ messageId, isActive: !isActive });
    },
    [toggleMutation],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedPoint((prev) => (prev === id ? null : id));
  }, []);

  // ─── Filtered data ────────────────────────────────────────────────

  const filteredMessages = useMemo(
    () =>
      categoryFilter === 'ALL'
        ? keyMessages
        : keyMessages.filter((m) => m.category === categoryFilter),
    [keyMessages, categoryFilter],
  );

  const groupedTalkingPoints = useMemo(() => {
    const groups: Record<string, TalkingPoint[]> = {};
    for (const tp of talkingPoints) {
      const key = tp.category || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(tp);
    }
    return groups;
  }, [talkingPoints]);

  // ─── Loading state ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald/10 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-emerald" />
            </div>
            <div className="h-5 w-44 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald/10 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-emerald" />
            </div>
            <h2 className="text-sm font-semibold">Election Narrative Builder</h2>
          </div>
        </div>
        <EmptyState
          icon={MessageSquare}
          title="Failed to load data"
          description="Could not fetch narrative data. Please try refreshing."
        />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Top Bar ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald/10 flex items-center justify-center">
            <Megaphone className="h-4 w-4 text-emerald" />
          </div>
          <h2 className="text-sm font-semibold">Election Narrative Builder</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="LEADING">Leading</SelectItem>
                <SelectItem value="COUNTER">Counter</SelectItem>
                <SelectItem value="MOTIVATIONAL">Motivational</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="h-8 text-xs gap-1.5 bg-emerald hover:bg-emerald/90 text-emerald-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            New Message
          </Button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <Tabs defaultValue="messages" className="flex flex-col flex-1 min-h-0 px-6 pt-4">
        <TabsList className="shrink-0 w-fit">
          <TabsTrigger value="messages" className="text-xs gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Key Messages
            {keyMessages.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                {keyMessages.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="talking-points" className="text-xs gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Talking Points
            {talkingPoints.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                {talkingPoints.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Timeline
            {narrativeTimeline.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                {narrativeTimeline.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Key Messages ──────────────────────────────────── */}
        <TabsContent value="messages" className="flex-1 min-h-0 mt-4">
          <ScrollArea className="h-full">
            {filteredMessages.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title={categoryFilter !== 'ALL' ? 'No messages in this category' : 'No key messages yet'}
                description="Create your first key message to start building the election narrative."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                <AnimatePresence mode="popLayout">
                  {filteredMessages.map((msg, idx) => {
                    const style = CATEGORY_STYLES[msg.category];
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, delay: idx * 0.05 }}
                        className="group relative"
                      >
                        <Card className={cn(
                          'transition-all duration-200 hover:shadow-md',
                          !msg.isActive && 'opacity-60',
                        )}>
                          <CardContent className="p-4 space-y-3">
                            {/* Header row */}
                            <div className="flex items-start justify-between gap-2">
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] h-5 border shrink-0', style.badge)}
                              >
                                <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', style.dot)} />
                                {CATEGORY_LABELS[msg.category]}
                              </Badge>
                              <Switch
                                checked={msg.isActive}
                                onCheckedChange={() => handleToggleMessage(msg.id, msg.isActive)}
                                disabled={toggleMutation.isPending}
                                className="scale-75 origin-top-right"
                              />
                          </div>

                          {/* Title */}
                          <p className="font-semibold text-sm leading-snug">{msg.title}</p>

                          {/* Body preview */}
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                            {msg.body}
                          </p>

                          {/* Priority bar */}
                          <PriorityBar priority={msg.priority} />

                          {/* Footer */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatCreated(msg.createdAt)}
                            </span>
                            {!msg.isActive && (
                              <Badge variant="outline" className="text-[10px] h-5 border-muted-foreground/20 text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── Tab 2: Talking Points ────────────────────────────────── */}
        <TabsContent value="talking-points" className="flex-1 min-h-0 mt-4">
          <ScrollArea className="h-full">
            {talkingPoints.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No talking points yet"
                description="Talking points will appear here once they are added to the narrative."
              />
            ) : (
              <div className="space-y-4 pb-4">
                {Object.entries(groupedTalkingPoints).map(([category, points], groupIdx) => (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: groupIdx * 0.05 }}
                  >
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {category}
                    </p>
                    <div className="space-y-2">
                      {points.map((tp, idx) => {
                        const isExpanded = expandedPoint === tp.id;
                        return (
                          <motion.div
                            key={tp.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.03 }}
                          >
                            <Card
                              className={cn(
                                'transition-all duration-200 cursor-pointer hover:shadow-sm',
                                !tp.isActive && 'opacity-60',
                                isExpanded && 'ring-1 ring-emerald/20',
                              )}
                              onClick={() => toggleExpanded(tp.id)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium leading-relaxed">{tp.point}</p>
                                    <AnimatePresence>
                                      {isExpanded && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.2 }}
                                          className="overflow-hidden"
                                        >
                                          <Separator className="my-2" />
                                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            {tp.context}
                                          </p>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Switch
                                      checked={tp.isActive}
                                      onCheckedChange={(checked) => {
                                        // Toggle talking point active state via the same PATCH endpoint
                                        toggleMutation.mutate({ messageId: tp.id, isActive: checked });
                                      }}
                                      disabled={toggleMutation.isPending}
                                      className="scale-75"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    {isExpanded ? (
                                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── Tab 3: Narrative Timeline ────────────────────────────── */}
        <TabsContent value="timeline" className="flex-1 min-h-0 mt-4">
          <ScrollArea className="h-full">
            {narrativeTimeline.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No timeline events yet"
                description="Narrative milestones, incident responses, and strategy shifts will appear here."
              />
            ) : (
              <div className="relative pb-4">
                {/* Vertical line */}
                <div className="absolute left-[15px] top-2 bottom-4 w-px bg-border" />

                <div className="space-y-0">
                  {narrativeTimeline.map((event, idx) => {
                    const timelineStyle = TIMELINE_STYLES[event.type];
                    const Icon = TIMELINE_ICONS[event.type];
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.05 }}
                        className="relative pl-10 py-3"
                      >
                        {/* Dot */}
                        <div className={cn(
                          'absolute left-[9px] top-5 w-[14px] h-[14px] rounded-full border-2 border-background z-10 flex items-center justify-center',
                          timelineStyle.bg,
                        )}>
                          <div className={cn('w-1.5 h-1.5 rounded-full', timelineStyle.border.replace('border-', 'bg-'))} />
                        </div>

                        {/* Card */}
                        <Card className={cn('transition-all duration-200 hover:shadow-sm border', timelineStyle.border)}>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div className={cn('w-7 h-7 rounded-md shrink-0 flex items-center justify-center', timelineStyle.bg)}>
                                <Icon className={cn('h-3.5 w-3.5', timelineStyle.color)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    variant="outline"
                                    className={cn('text-[10px] h-5 border', timelineStyle.badge)}
                                  >
                                    {event.type.replace('_', ' ')}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatTimestamp(event.timestamp)}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold leading-snug mb-0.5">{event.title}</p>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  {event.description}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* ── New Message Dialog ──────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-md bg-emerald/10 flex items-center justify-center">
                <Plus className="h-3.5 w-3.5 text-emerald" />
              </div>
              New Key Message
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a new key message to the election narrative. This will be available to the campaign team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="msg-title" className="text-xs">Title</Label>
              <Input
                id="msg-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Economic Recovery Plan"
                className="h-9 text-sm"
                maxLength={200}
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="msg-body" className="text-xs">Message Body</Label>
              <Textarea
                id="msg-body"
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Write the key message content..."
                className="min-h-[100px] text-sm resize-none"
                rows={4}
              />
            </div>

            {/* Category & Priority row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, category: v as MessageCategory }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEADING">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald" />
                        Leading
                      </span>
                    </SelectItem>
                    <SelectItem value="COUNTER">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose" />
                        Counter
                      </span>
                    </SelectItem>
                    <SelectItem value="MOTIVATIONAL">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber" />
                        Motivational
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="msg-priority" className="text-xs">Priority (1-10)</Label>
                <Input
                  id="msg-priority"
                  type="number"
                  min={1}
                  max={10}
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!form.title.trim() || !form.body.trim() || createMutation.isPending}
              className="h-8 text-xs gap-1.5 bg-emerald hover:bg-emerald/90 text-emerald-foreground"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
