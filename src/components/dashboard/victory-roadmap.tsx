'use client';

import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { useDashboardStore, TIER_SHORT } from '@/store/dashboard';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Trophy, TrendingUp, TrendingDown, Minus, ShieldCheck, ShieldAlert,
  MapPin, Target, Route, Landmark, Handshake, Crown, ChevronDown, ChevronUp,
  Loader2, Sparkles, Info, BarChart3, Users, Zap, Flag, CircleDot,
  CheckCircle2, XCircle, Clock, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

const PARTY_COLORS: Record<string, string> = {
  APC: '#008751',
  PDP: '#CE1126',
  LP: '#2196F3',
  NNPP: '#FF9800',
};

const PARTY_NAMES: Record<string, string> = {
  APC: 'All Progressives Congress',
  PDP: 'Peoples Democratic Party',
  LP: 'Labour Party',
  NNPP: 'New Nigeria Peoples Party',
};

interface StateResult {
  state: string;
  partyResults: Array<{ party: string; votes: number }>;
  totalValidVotes: number;
  totalRegistered: number;
  turnout: number;
  leadingParty: string;
  margin: number;
  status: string;
}

interface NationalAggregate {
  party: string;
  votes: number;
  percentage: number;
  states: number;
  trend: 'up' | 'down' | 'stable';
}

interface VictoryPath {
  totalStates: number;
  statesWon: number;
  statesLeaning: number;
  statesContested: number;
  statesLost: number;
  pathTo25: number;
  remainingNeeded: number;
  winProbability: number;
  keySwingStates: SwingState[];
}

interface SwingState {
  state: string;
  leadingParty: string;
  leadingPartyColor: string;
  trailingParty: string;
  trailingPartyColor: string;
  margin: number;
  totalVotes: number;
  status: 'SAFE' | 'LEANING' | 'TIGHT RACE' | 'TOSS_UP';
  votesRemaining: number;
}

interface CoalitionScenario {
  id: string;
  name: string;
  description: string;
  parties: string[];
  projectedStates: number;
  projectedVotes: number;
  projectedPercentage: number;
  confidence: number;
}

interface RoadmapData {
  states: StateResult[];
  national: NationalAggregate[];
  victoryPath: VictoryPath;
  coalitionScenarios: CoalitionScenario[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIN PROBABILITY GAUGE
// ═══════════════════════════════════════════════════════════════════════════════

function WinProbabilityGauge({ probability, party }: { probability: number; party: string }) {
  const color = probability >= 75 ? '#10b981' : probability >= 50 ? '#f59e0b' : '#ef4444';
  const label = probability >= 75 ? 'Strong Position' : probability >= 50 ? 'Competitive' : probability >= 25 ? 'Challenged' : 'Unlikely';
  
  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (probability / 100) * circumference * 0.75;

  return (
    <div className="relative flex flex-col items-center">
      <svg width="200" height="140" viewBox="0 0 200 140" className="overflow-visible">
        {/* Background arc */}
        <path
          d="M 20 120 A 80 80 0 0 1 180 120"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          className="text-muted/20"
        />
        {/* Filled arc */}
        <motion.path
          d="M 20 120 A 80 80 0 0 1 180 120"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference * 0.75}
          initial={{ strokeDashoffset: circumference * 0.75 }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        {/* Center text */}
        <text x="100" y="100" textAnchor="middle" className="fill-foreground" style={{ fontSize: '32px', fontWeight: 800 }}>
          {probability}%
        </text>
        <text x="100" y="118" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '10px' }}>
          WIN PROBABILITY
        </text>
      </svg>
      <div className="flex items-center gap-2 mt-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PARTY_COLORS[party] || '#6b7280' }} />
        <span className="text-xs font-semibold">{party}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE CARD
// ═══════════════════════════════════════════════════════════════════════════════

function StateCard({ state, onClick }: { state: StateResult; onClick?: () => void }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    SAFE: { label: 'SAFE', className: 'bg-emerald/15 text-emerald border-emerald/30' },
    LEANING: { label: 'LEANING', className: 'bg-cyan/15 text-cyan border-cyan/30' },
    'TIGHT RACE': { label: 'TIGHT', className: 'bg-amber/15 text-amber border-amber/30' },
    TOSS_UP: { label: 'TOSS UP', className: 'bg-rose/15 text-rose border-rose/30' },
  };
  
  const marginPct = state.totalValidVotes > 0 ? (state.margin / state.totalValidVotes * 100) : 0;
  const isClose = marginPct < 5;
  const leadingColor = PARTY_COLORS[state.leadingParty] || '#6b7280';
  
  const status = marginPct >= 15 ? 'SAFE' : marginPct >= 8 ? 'LEANING' : marginPct >= 3 ? 'TIGHT RACE' : 'TOSS_UP';
  const cfg = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'rounded-lg border p-3 cursor-pointer transition-all duration-200 hover:shadow-md',
        isClose ? 'border-amber/30 bg-amber/[0.03]' : 'border-border bg-card/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">{state.state}</span>
        </div>
        <Badge variant="outline" className={cn('text-[10px] h-5 border', cfg.className)}>
          {cfg.label}
        </Badge>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: leadingColor }} />
            <span className="font-medium">{state.leadingParty}</span>
          </div>
          <span className="text-muted-foreground">{state.totalValidVotes.toLocaleString()} votes</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Progress value={state.turnout} className="h-1.5 flex-1" />
          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{state.turnout}%</span>
        </div>
        
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>Margin: <strong className={cn(isClose ? 'text-amber' : 'text-foreground')}>{marginPct.toFixed(1)}%</strong></span>
          <span>Reg: {state.totalRegistered.toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COALITION BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function CoalitionBuilder({ 
  scenarios, 
  states, 
  selectedScenario, 
  onSelectScenario 
}: { 
  scenarios: CoalitionScenario[];
  states: StateResult[];
  selectedScenario: string | null;
  onSelectScenario: (id: string | null) => void;
}) {
  const active = scenarios.find(s => s.id === selectedScenario);
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Handshake className="h-4 w-4 text-violet" />
        <h3 className="text-sm font-semibold">Coalition Scenarios</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {scenarios.map((scenario) => (
          <motion.button
            key={scenario.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onSelectScenario(selectedScenario === scenario.id ? null : scenario.id)}
            className={cn(
              'rounded-lg border p-3 text-left transition-all duration-200',
              selectedScenario === scenario.id
                ? 'border-violet/40 bg-violet/5 ring-1 ring-violet/20'
                : 'border-border bg-card/40 hover:bg-card/60'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex -space-x-1">
                {scenario.parties.map((p) => (
                  <div
                    key={p}
                    className="w-5 h-5 rounded-sm border-2 border-background"
                    style={{ backgroundColor: PARTY_COLORS[p] || '#6b7280' }}
                    title={p}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold flex-1 truncate">{scenario.name}</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                {scenario.confidence}%
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">{scenario.description}</p>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-foreground font-medium">{scenario.projectedStates} states</span>
              <span className="text-muted-foreground">{scenario.projectedPercentage.toFixed(1)}%</span>
            </div>
          </motion.button>
        ))}
      </div>
      
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-violet/20 bg-violet/[0.02]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-violet" />
                  <h4 className="text-xs font-semibold">{active.name} — Analysis</h4>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-violet tabular-nums">{active.projectedStates}</p>
                    <p className="text-[10px] text-muted-foreground">States</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-violet tabular-nums">{active.projectedPercentage.toFixed(1)}%</p>
                    <p className="text-[10px] text-muted-foreground">Vote Share</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold tabular-nums" style={{ color: active.confidence >= 60 ? '#10b981' : '#f59e0b' }}>
                      {active.confidence}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Confidence</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Coalition States</p>
                  <div className="flex flex-wrap gap-1">
                    {states
                      .filter(s => active.parties.includes(s.leadingParty))
                      .map(s => (
                        <Badge key={s.state} variant="outline" className="text-[10px] h-5">
                          <div className="w-1.5 h-1.5 rounded-sm mr-1" style={{ backgroundColor: PARTY_COLORS[s.leadingParty] || '#6b7280' }} />
                          {s.state}
                        </Badge>
                      ))
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATTLEGROUND STATES
// ═══════════════════════════════════════════════════════════════════════════════

function BattlegroundStates({ states }: { states: SwingState[] }) {
  const statusColors: Record<string, string> = {
    SAFE: 'border-emerald/20',
    LEANING: 'border-cyan/20',
    'TIGHT RACE': 'border-amber/30',
    TOSS_UP: 'border-rose/30',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-amber" />
          <h3 className="text-sm font-semibold">Key Battlegrounds</h3>
          <Badge variant="secondary" className="text-[10px] h-5">{states.length}</Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {states.map((ss, i) => (
          <motion.div
            key={ss.state}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              'rounded-lg border p-3 transition-all duration-200',
              statusColors[ss.status] || 'border-border',
              ss.status === 'TIGHT RACE' && 'bg-amber/[0.03]',
              ss.status === 'TOSS_UP' && 'bg-rose/[0.03]'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{ss.state}</span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] h-5 border',
                  ss.status === 'TIGHT RACE' && 'bg-amber/15 text-amber border-amber/30',
                  ss.status === 'TOSS_UP' && 'bg-rose/15 text-rose border-rose/30',
                  ss.status === 'LEANING' && 'bg-cyan/15 text-cyan border-cyan/30',
                  ss.status === 'SAFE' && 'bg-emerald/15 text-emerald border-emerald/30'
                )}
              >
                {ss.status}
              </Badge>
            </div>
            
            {/* Two-party comparison bar */}
            <div className="mb-2">
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(85, 50 + (ss.margin / ss.totalVotes * 100) / 2)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-l-full"
                  style={{ backgroundColor: ss.leadingPartyColor }}
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(85, 50 - (ss.margin / ss.totalVotes * 100) / 2)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-r-full"
                  style={{ backgroundColor: ss.trailingPartyColor }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px]">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: ss.leadingPartyColor }} />
                  <span className="font-medium">{ss.leadingParty}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">{ss.trailingParty}</span>
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: ss.trailingPartyColor }} />
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Margin: <strong className="text-foreground">{ss.margin.toLocaleString()}</strong></span>
              <span>{ss.totalVotes.toLocaleString()} total</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE DETAIL DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function StateDetailPanel({ state, onClose }: { state: StateResult; onClose: () => void }) {
  const partyData = state.partyResults
    .sort((a, b) => b.votes - a.votes)
    .map(p => ({
      name: p.party,
      votes: p.votes,
      pct: state.totalValidVotes > 0 ? (p.votes / state.totalValidVotes * 100) : 0,
      fill: PARTY_COLORS[p.party] || '#6b7280',
    }));

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full border-l border-border bg-background/95 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-bold">{state.state}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
          Close
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border bg-card/40 p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Registered</p>
          <p className="text-lg font-bold tabular-nums">{state.totalRegistered.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-card/40 p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valid Votes</p>
          <p className="text-lg font-bold tabular-nums">{state.totalValidVotes.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-card/40 p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Turnout</p>
          <p className="text-lg font-bold tabular-nums">{state.turnout}%</p>
        </div>
        <div className="rounded-lg border bg-card/40 p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Leading</p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PARTY_COLORS[state.leadingParty] || '#6b7280' }} />
            <span className="text-lg font-bold">{state.leadingParty}</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Party Breakdown</p>
        <div className="space-y-2.5">
          {partyData.map(p => (
            <div key={p.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.fill }} />
                  <span className="font-medium">{p.name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="tabular-nums">{p.votes.toLocaleString()}</span>
                  <span className="font-semibold text-foreground tabular-nums w-12 text-right">{p.pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${p.pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: p.fill }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATH TO VICTORY STEPPER
// ═══════════════════════════════════════════════════════════════════════════════

function PathToVictory({ path, party }: { path: VictoryPath; party: string }) {
  const progressPct = path.totalStates > 0 ? (path.pathTo25 / 25) * 100 : 0;
  const color = PARTY_COLORS[party] || '#10b981';
  const isOnTrack = path.remainingNeeded <= 0;

  return (
    <Card className="border-border bg-card/40">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Route className="h-4 w-4" style={{ color }} />
          <h3 className="text-sm font-semibold">Path to 25 States</h3>
          {isOnTrack && (
            <Badge className="text-[10px] h-5 bg-emerald/15 text-emerald border-emerald/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />ON TRACK
            </Badge>
          )}
        </div>
        
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">States secured / needed</span>
            <span className="font-bold tabular-nums" style={{ color }}>
              {path.pathTo25} / 25
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted/30">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, progressPct)}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <p className="text-base font-bold tabular-nums text-emerald">{path.statesWon}</p>
            <p className="text-[10px] text-muted-foreground">Won</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold tabular-nums text-cyan">{path.statesLeaning}</p>
            <p className="text-[10px] text-muted-foreground">Leaning</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold tabular-nums text-amber">{path.statesContested}</p>
            <p className="text-[10px] text-muted-foreground">Contested</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold tabular-nums text-rose">{path.statesLost}</p>
            <p className="text-[10px] text-muted-foreground">Lost</p>
          </div>
        </div>
        
        {path.remainingNeeded > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber" />
              <span className="text-muted-foreground">
                Need <strong className="text-foreground">{path.remainingNeeded} more states</strong> from {path.statesContested} contested + {path.statesLeaning} leaning
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function VictoryRoadmap() {
  const tenantId = useDashboardStore((s) => s.tenantId);
  const [selectedParty, setSelectedParty] = useState<string>('APC');
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<StateResult | null>(null);
  const [viewMode, setViewMode] = useState<'roadmap' | 'states' | 'coalition'>('roadmap');

  const { data, isLoading } = useQuery<RoadmapData>({
    queryKey: ['victory-roadmap', tenantId],
    queryFn: () => fetchJson<RoadmapData>(`/api/victory-roadmap?tenantId=${tenantId}`),
    refetchInterval: 30_000,
    enabled: !!tenantId,
  });

  // Compute derived data
  const swingStates = useMemo<SwingState[]>(() => {
    if (!data?.states) return [];
    return data.states
      .map(s => {
        const sorted = [...s.partyResults].sort((a, b) => b.votes - a.votes);
        const leading = sorted[0];
        const trailing = sorted[1];
        if (!leading || !trailing) return null;
        const marginPct = s.totalValidVotes > 0 ? (leading.votes - trailing.votes) / s.totalValidVotes * 100 : 0;
        const status: SwingState['status'] = marginPct >= 15 ? 'SAFE' : marginPct >= 8 ? 'LEANING' : marginPct >= 3 ? 'TIGHT RACE' : 'TOSS_UP';
        return {
          state: s.state,
          leadingParty: leading.party,
          leadingPartyColor: PARTY_COLORS[leading.party] || '#6b7280',
          trailingParty: trailing.party,
          trailingPartyColor: PARTY_COLORS[trailing.party] || '#6b7280',
          margin: leading.votes - trailing.votes,
          totalVotes: s.totalValidVotes,
          status,
          votesRemaining: s.totalRegistered - s.totalValidVotes,
        };
      })
      .filter((s): s is SwingState => s !== null && s.status !== 'SAFE')
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 12);
  }, [data?.states]);

  const partyNational = useMemo(() => {
    if (!data?.national) return null;
    return data.national.find(n => n.party === selectedParty);
  }, [data?.national, selectedParty]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-emerald mx-auto" />
          <p className="text-sm text-muted-foreground">Loading victory roadmap...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Trophy className="h-8 w-8 text-muted-foreground/20 mx-auto" />
          <p className="text-sm text-muted-foreground">No roadmap data available yet</p>
          <p className="text-xs text-muted-foreground/50">Results must be reported from polling units before analysis can begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header with party selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber" />
              Victory Roadmap
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Path-to-victory analysis and coalition modeling for {TIER_SHORT[useDashboardStore.getState().electionTier]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedParty} onValueChange={setSelectedParty}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(data.national || []).map(n => (
                  <SelectItem key={n.party} value={n.party}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PARTY_COLORS[n.party] || '#6b7280' }} />
                      {n.party}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* View mode tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted/30 w-fit">
          {([['roadmap', 'Roadmap', Route], ['states', 'All States', MapPin], ['coalition', 'Coalitions', Handshake]] as const).map(([mode, label, Icon]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                viewMode === mode
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {viewMode === 'roadmap' && (
          <>
            {/* Top row: Win Probability + Path to Victory */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border bg-card/40">
                <CardContent className="p-4">
                  <WinProbabilityGauge 
                    probability={data.victoryPath.winProbability} 
                    party={selectedParty}
                  />
                </CardContent>
              </Card>
              <PathToVictory path={data.victoryPath} party={selectedParty} />
            </div>

            {/* National party standings */}
            <Card className="border-border bg-card/40">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5" />
                  National Party Standings
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {(data.national || []).map((party, i) => (
                    <div key={party.party} className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground w-4">#{i + 1}</span>
                      <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: PARTY_COLORS[party.party] || '#6b7280' }} />
                      <span className="text-xs font-semibold w-10">{party.party}</span>
                      <div className="flex-1">
                        <div className="h-3 w-full overflow-hidden rounded-full bg-muted/30">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${party.percentage}%` }}
                            transition={{ duration: 1, ease: 'easeOut', delay: i * 0.1 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: PARTY_COLORS[party.party] || '#6b7280' }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-bold tabular-nums w-14 text-right">{party.percentage.toFixed(1)}%</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-right">{party.states}st</span>
                      {party.trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald" />}
                      {party.trend === 'down' && <TrendingDown className="h-3 w-3 text-rose" />}
                      {party.trend === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Battleground states */}
            <BattlegroundStates states={swingStates} />
          </>
        )}

        {viewMode === 'states' && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-cyan" />
              <h3 className="text-sm font-semibold">All States — Results Breakdown</h3>
              <Badge variant="secondary" className="text-[10px] h-5">{data.states.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {data.states
                .sort((a, b) => {
                  const marginA = a.totalValidVotes > 0 ? a.margin / a.totalValidVotes : 0;
                  const marginB = b.totalValidVotes > 0 ? b.margin / b.totalValidVotes : 0;
                  return marginA - marginB;
                })
                .map(s => (
                  <StateCard 
                    key={s.state} 
                    state={s} 
                    onClick={() => setSelectedState(s)}
                  />
                ))}
            </div>
          </>
        )}

        {viewMode === 'coalition' && (
          <CoalitionBuilder
            scenarios={data.coalitionScenarios}
            states={data.states}
            selectedScenario={selectedScenario}
            onSelectScenario={setSelectedScenario}
          />
        )}
      </div>

      {/* State detail side panel */}
      <AnimatePresence>
        {selectedState && (
          <StateDetailPanel 
            state={selectedState}
            onClose={() => setSelectedState(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}