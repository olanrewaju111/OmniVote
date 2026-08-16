'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '@/store/dashboard';
import { Badge } from '@/components/ui/badge';
import {
  Zap, Loader2, Vote, Building2, ExternalLink, Shield, Lock, Cpu, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';


interface TenantOption {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
}

const TENANT_TIER: Record<string, { tier: 'PRESIDENTIAL' | 'STATE' | 'LOCAL'; badge: string }> = {
  'presidential': { tier: 'PRESIDENTIAL', badge: 'Presidential' },
  'governorship': { tier: 'STATE', badge: 'Governorship' },
  'local-gov': { tier: 'LOCAL', badge: 'Local Gov' },
};

// Feature highlights for the left panel
const FEATURES = [
  { icon: <Shield className="h-4 w-4" />, title: 'AI Threat Detection', desc: 'Deepfake ID, CIB analysis, adversarial defense' },
  { icon: <Globe className="h-4 w-4" />, title: 'Real-time Mapping', desc: '381+ polling units with GPS verification' },
  { icon: <Lock className="h-4 w-4" />, title: 'Zero-Trust Security', desc: 'AES-256 encryption, C2PA provenance' },
  { icon: <Cpu className="h-4 w-4" />, title: '7 AI Models Active', desc: 'Whisper, CV, NLP, geofence, and more' },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

export function LoginScreen() {
  const router = useRouter();
  const { setElectionInfo, setTenantId } = useDashboardStore();

  const { data, isLoading } = useQuery<{
    authenticated: boolean;
    tenants: TenantOption[];
  }>({
    queryKey: ['auth-tenants'],
    queryFn: () => fetchJson('/api/auth'),
  });

  const tenants = data?.tenants || [];

  const handleTenantSelect = (_tenantId: string, tenantSlug: string) => {
    router.push(`/t/${tenantSlug}`);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* ═══ Left panel — branding ═══ */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] bg-gradient-to-b from-emerald/8 via-background to-background border-r border-border flex-col p-8 justify-between relative overflow-hidden">
        <div className="absolute inset-0 map-grid opacity-30" />
        {/* Decorative gradient orbs */}
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-emerald/5 blur-3xl" />
        <div className="absolute bottom-20 -left-20 w-40 h-40 rounded-full bg-cyan/5 blur-3xl" />

        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-10"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald flex items-center justify-center shadow-lg shadow-emerald/20">
              <Zap className="h-6 w-6 text-emerald-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">OmniVote</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Monitor</p>
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-2xl font-bold mb-3 leading-tight"
          >
            Secure Election<br />Command Center
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="text-sm text-muted-foreground leading-relaxed max-w-sm"
          >
            Real-time election monitoring with AI-powered threat detection, deepfake identification, and adversarial defense systems.
          </motion.p>

          {/* Feature highlights */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="mt-8 space-y-3"
          >
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={item}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-card/40 transition-colors group"
              >
                <div className="p-1.5 rounded-md bg-emerald/10 text-emerald shrink-0 group-hover:bg-emerald/15 transition-colors">
                  {f.icon}
                </div>
                <div>
                  <p className="text-xs font-medium">{f.title}</p>
                  <p className="text-[11px] text-muted-foreground/60">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 space-y-4"
        >
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Organizations', value: String(tenants.length) },
              { label: 'Active Agents', value: '25+' },
              { label: 'Polling Units', value: '381+' },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-border/60 bg-card/30 px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-emerald tabular-nums">{s.value}</p>
                <p className="text-[10px] text-muted-foreground/60">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse-dot" />
            <span>Multi-Tenant Deployment &middot; {tenants.length} Active Organizations</span>
          </div>
          <p className="text-[10px] text-muted-foreground/30">
            OmniVote Monitor v2.1 &middot; Zero-Trust Architecture &middot; AES-256 Encryption
          </p>
        </motion.div>
      </div>

      {/* ═══ Right panel — tenant selection ═══ */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto px-4 sm:px-6 py-8">
            {/* Mobile header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:hidden flex items-center gap-3 mb-8"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald flex items-center justify-center shadow-md shadow-emerald/20">
                <Zap className="h-5 w-5 text-emerald-950" />
              </div>
              <div>
                <h1 className="text-base font-bold">OmniVote Monitor</h1>
                <p className="text-[10px] text-muted-foreground">Election Command Center</p>
              </div>
            </motion.div>

            {/* Tenant Selection */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-lg font-semibold mb-1">Select Organization</h3>
              <p className="text-sm text-muted-foreground mb-6">Choose your election monitoring organization to sign in.</p>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton-kpi rounded-lg" style={{ height: '72px' }} />
                  ))}
                </div>
              ) : (
                <AnimatePresence>
                  <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-2.5"
                  >
                    {tenants.map(t => {
                      const tInfo = TENANT_TIER[t.slug];
                      return (
                        <motion.button
                          key={t.id}
                          variants={item}
                          whileHover={{ scale: 1.005, x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleTenantSelect(t.id, t.slug)}
                          className="w-full rounded-xl border border-border/60 bg-card/40 hover:bg-card/60 hover:border-border p-4 text-left transition-all duration-200 group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald/10 flex items-center justify-center shrink-0 group-hover:bg-emerald/15 transition-colors">
                              <Building2 className="h-5 w-5 text-emerald" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{t.name}</p>
                                {tInfo && (
                                  <Badge variant="outline" className={cn(
                                    'text-[10px] h-5',
                                    tInfo.tier === 'PRESIDENTIAL' ? 'border-violet/30 text-violet bg-violet/10' :
                                    tInfo.tier === 'STATE' ? 'border-amber/30 text-amber bg-amber/10' :
                                    'border-cyan/30 text-cyan bg-cyan/10'
                                  )}>
                                    <Vote className="h-2.5 w-2.5 mr-1" />
                                    {tInfo.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                                {tInfo?.tier === 'PRESIDENTIAL' ? 'All 36 states + FCT' :
                                 tInfo?.tier === 'STATE' ? 'Lagos State (14 LGAs)' :
                                 'Lagos Island LGA (6 wards)'}
                              </p>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 group-hover:text-muted-foreground transition-all shrink-0" />
                          </div>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              )}
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-6 py-3 text-center">
          <p className="text-[10px] text-muted-foreground/30">
            OmniVote Monitor v2.1 &middot; Multi-Tenant &middot; AES-256 Encryption &middot; C2PA Content Provenance
          </p>
        </div>
      </div>
    </div>
  );
}