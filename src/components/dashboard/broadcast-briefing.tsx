'use client';

import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { m, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Send, Users, Shield, Clock, Loader2, X, CheckCircle2,
  AlertTriangle, Info, Eye, Sparkles, Copy, Download, FileText, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { fetchJson } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────

interface BroadcastForm {
  title: string;
  body: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  targetRole: 'ALL' | 'FIELD_AGENT' | 'ANALYST' | 'TENANT_ADMIN';
  channel: 'IN_APP' | 'ALL';
  includeSummary: boolean;
}

interface BroadcastHistoryItem {
  id: string;
  title: string;
  priority: string;
  targetRole: string;
  sentCount: number;
  readCount: number;
  createdAt: string;
}

interface BroadcastResponse {
  success: boolean;
  sentCount: number;
  broadcastId: string;
}

// ─── Quick Templates ──────────────────────────────────────────────────

const QUICK_TEMPLATES: Array<{
  id: string;
  label: string;
  icon: typeof Zap;
  title: string;
  body: string;
  priority: BroadcastForm['priority'];
  targetRole: BroadcastForm['targetRole'];
}> = [
  {
    id: 'urgent-incident',
    label: 'Urgent Incident',
    icon: AlertTriangle,
    title: 'URGENT: Critical Incident Reported',
    body: 'A critical incident has been verified in {state}. All field agents in the area should exercise extreme caution and follow safety protocols. Report any additional observations immediately.',
    priority: 'URGENT',
    targetRole: 'FIELD_AGENT',
  },
  {
    id: 'turnout-update',
    label: 'Turnout Update',
    icon: Users,
    title: 'Voter Turnout Update',
    body: 'Current voter turnout stands at {turnout}% across {units} polling units. Please intensify voter mobilization efforts in low-turnout areas. Every vote counts.',
    priority: 'HIGH',
    targetRole: 'FIELD_AGENT',
  },
  {
    id: 'results-snapshot',
    label: 'Results Snapshot',
    icon: FileText,
    title: 'Preliminary Results Update',
    body: 'Based on {count} polling units reported so far, early results show a competitive race. Continue monitoring and reporting. Do not share unverified results externally.',
    priority: 'NORMAL',
    targetRole: 'ALL',
  },
  {
    id: 'security-advisory',
    label: 'Security Advisory',
    icon: Shield,
    title: 'Security Advisory',
    body: 'Security intelligence indicates potential risks in the following areas: {areas}. Field agents should maintain heightened awareness, keep communication lines open, and activate check-in protocols.',
    priority: 'HIGH',
    targetRole: 'ALL',
  },
  {
    id: 'victory-milestone',
    label: 'Victory Milestone',
    icon: Sparkles,
    title: 'Milestone Achieved',
    body: 'Excellent progress! Our candidate is leading in {states} states with strong margins. Keep up the momentum. Final push needed in battleground states. Stay focused and vigilant.',
    priority: 'NORMAL',
    targetRole: 'ALL',
  },
  {
    id: 'closing-reminder',
    label: 'Closing Reminder',
    icon: Clock,
    title: 'Poll Closing Reminder',
    body: 'Polling units will begin closing in the next 2 hours. Ensure all results are documented, photographed, and transmitted before departure. Use the PVT submission form for official results.',
    priority: 'HIGH',
    targetRole: 'FIELD_AGENT',
  },
];

// ─── Priority Badge ───────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { className: string }> = {
    LOW: { className: 'bg-cyan/15 text-cyan border-cyan/30' },
    NORMAL: { className: 'bg-muted text-muted-foreground border-border' },
    HIGH: { className: 'bg-amber/15 text-amber border-amber/30' },
    URGENT: { className: 'bg-rose/15 text-rose border-rose/30' },
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] h-5 border', config[priority]?.className)}>
      {priority}
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

interface BroadcastBriefingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BroadcastBriefing({ open, onOpenChange }: BroadcastBriefingProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BroadcastForm>({
    title: '',
    body: '',
    priority: 'NORMAL',
    targetRole: 'ALL',
    channel: 'IN_APP',
    includeSummary: true,
  });
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);

  const maxChars = 1000;

  const handleTextChange = useCallback((field: 'title' | 'body', value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'body') setCharacterCount(value.length);
  }, []);

  const applyTemplate = useCallback((templateId: string) => {
    const template = QUICK_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    setActiveTemplateId(templateId);
    setForm(prev => ({
      ...prev,
      title: template.title,
      body: template.body,
      priority: template.priority,
      targetRole: template.targetRole,
    }));
    setCharacterCount(template.body.length);
  }, []);

  const clearForm = useCallback(() => {
    setForm({ title: '', body: '', priority: 'NORMAL', targetRole: 'ALL', channel: 'IN_APP', includeSummary: true });
    setActiveTemplateId(null);
    setCharacterCount(0);
  }, []);

  // Send broadcast
  const broadcastMutation = useMutation({
    mutationFn: async (data: BroadcastForm) => {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to send broadcast');
      return res.json() as Promise<{
        success: boolean;
        sentCount: number;
        broadcastId: string;
      }>;
    },
    onSuccess: (data) => {
      toast.success(`Broadcast sent to ${data.sentCount} recipients`, {
        description: 'Message delivered via in-app channel.',
        action: { label: 'View Activity', onClick: () => {/* could navigate */} },
      });
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      clearForm();
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Broadcast failed', { description: 'Please try again.' });
    },
  });

  const handleSend = useCallback(() => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Please fill in both title and message body');
      return;
    }
    broadcastMutation.mutate(form);
  }, [form, broadcastMutation]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    const text = `${form.title}\n\n${form.body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }, [form.title, form.body]);

  const previewRecipients = useMemo(() => {
    const labels: Record<string, string> = {
      ALL: 'All team members',
      FIELD_AGENT: 'All field agents',
      ANALYST: 'All analysts',
      TENANT_ADMIN: 'Admin team',
    };
    return labels[form.targetRole] || form.targetRole;
  }, [form.targetRole]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-amber" />
            Stakeholder Broadcast
          </DialogTitle>
          <DialogDescription>
            Send targeted announcements and briefings to team members. Messages are delivered in real-time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Quick Templates */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Templates</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {QUICK_TEMPLATES.map((t) => {
                const Icon = t.icon;
                return (
                  <m.button
                    key={t.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => applyTemplate(t.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all duration-200 text-xs',
                      activeTemplateId === t.id
                        ? 'border-amber/40 bg-amber/5 ring-1 ring-amber/20'
                        : 'border-border bg-card/40 hover:bg-card/60'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{t.label}</span>
                  </m.button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Form */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-title" className="text-xs">Title</Label>
              <Input
                id="broadcast-title"
                value={form.title}
                onChange={(e) => handleTextChange('title', e.target.value)}
                placeholder="e.g. URGENT: Critical Incident in Lagos"
                className="h-9 text-sm"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="broadcast-body" className="text-xs">Message</Label>
                <span className={cn(
                  'text-[10px] tabular-nums',
                  characterCount > maxChars ? 'text-rose' : 'text-muted-foreground'
                )}>
                  {characterCount} / {maxChars}
                </span>
              </div>
              <Textarea
                id="broadcast-body"
                value={form.body}
                onChange={(e) => {
                  if (e.target.value.length <= maxChars) {
                    handleTextChange('body', e.target.value);
                  }
                }}
                placeholder="Write your briefing message... Use {state}, {turnout}, {units} as dynamic placeholders."
                className="min-h-[120px] text-sm resize-none"
                rows={5}
              />
            </div>

            {/* Settings row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(prev => ({ ...prev, priority: v as BroadcastForm['priority'] }))}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan" />Low</span></SelectItem>
                    <SelectItem value="NORMAL"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground" />Normal</span></SelectItem>
                    <SelectItem value="HIGH"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber" />High</span></SelectItem>
                    <SelectItem value="URGENT"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose" />Urgent</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Target Audience</Label>
                <Select value={form.targetRole} onValueChange={(v) => setForm(prev => ({ ...prev, targetRole: v as BroadcastForm['targetRole'] }))}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Members</SelectItem>
                    <SelectItem value="FIELD_AGENT">Field Agents</SelectItem>
                    <SelectItem value="ANALYST">Analysts</SelectItem>
                    <SelectItem value="TENANT_ADMIN">Admins</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm(prev => ({ ...prev, channel: v as BroadcastForm['channel'] }))}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN_APP">In-App Only</SelectItem>
                    <SelectItem value="ALL">All Channels</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Include summary toggle */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.includeSummary}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, includeSummary: checked }))}
              />
              <div>
                <p className="text-xs font-medium">Attach Election Summary</p>
                <p className="text-[10px] text-muted-foreground">Include live KPI snapshot with the broadcast</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Preview */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</p>
            <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber/15 flex items-center justify-center">
                    <Megaphone className="h-3 w-3 text-amber" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{form.title || 'Broadcast Title'}</p>
                    <p className="text-[10px] text-muted-foreground">OmniVote Broadcast</p>
                  </div>
                </div>
                <PriorityBadge priority={form.priority} />
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {form.body || 'Your message will appear here...'}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{previewRecipients}</span>
                <span>·</span>
                <Eye className="h-3 w-3" />
                <span>In-App</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 text-xs gap-1.5" disabled={!form.title && !form.body}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={clearForm} className="h-8 text-xs">
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!form.title.trim() || !form.body.trim() || broadcastMutation.isPending}
              className="h-8 text-xs gap-1.5 bg-emerald hover:bg-emerald/90"
            >
              {broadcastMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send Broadcast
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
