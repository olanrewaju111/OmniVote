'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useDashboardStore } from '@/store/dashboard';
import { Badge } from '@/components/ui/badge';
import {
  Zap, Loader2, Vote, Building2, ExternalLink,
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

  // Check for existing session on mount
  useEffect(() => {
    if (data?.authenticated) {
      // Already have a valid session — the page.tsx will handle the redirect
    }
  }, [data?.authenticated]);

  const handleTenantSelect = (_tenantId: string, tenantSlug: string) => {
    // Navigate to the tenant's branded login page
    router.push(`/t/${tenantSlug}`);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] bg-gradient-to-b from-emerald/10 via-background to-background border-r border-border flex-col p-8 justify-between relative overflow-hidden">
        <div className="absolute inset-0 map-grid opacity-40" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald flex items-center justify-center">
              <Zap className="h-6 w-6 text-emerald-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">OmniVote</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Monitor</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-3 leading-tight">
            Secure Election<br />Command Center
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
            Real-time election monitoring with AI-powered threat detection, deepfake identification, and adversarial defense systems.
          </p>
        </div>
        <div className="relative z-10 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Tenants', value: String(tenants.length) },
              { label: 'Active Agents', value: '25+' },
              { label: 'Polling Units', value: '381+' },
              { label: 'AI Models', value: '7' },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
                <p className="text-lg font-bold text-emerald tabular-nums">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-dot" />
            <span>Multi-Tenant Deployment &middot; {tenants.length} Active Organizations</span>
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            OmniVote Monitor v2.1 &middot; Zero-Trust Architecture &middot; AES-256 Encryption
          </p>
        </div>
      </div>

      {/* Right panel — tenant selection */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto px-4 sm:px-6 py-8">
            {/* Mobile header */}
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-lg bg-emerald flex items-center justify-center">
                <Zap className="h-5 w-5 text-emerald-950" />
              </div>
              <div>
                <h1 className="text-base font-bold">OmniVote Monitor</h1>
                <p className="text-[10px] text-muted-foreground">Election Command Center</p>
              </div>
            </div>

            {/* Tenant Selection */}
            <>
              <h3 className="text-lg font-semibold mb-1">Select Organization</h3>
              <p className="text-sm text-muted-foreground mb-6">Choose your election monitoring organization to sign in.</p>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald" />
                </div>
              ) : (
                <div className="space-y-3">
                  {tenants.map(t => {
                    const tInfo = TENANT_TIER[t.slug];
                    return (
                      <motion.button
                        key={t.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleTenantSelect(t.id, t.slug)}
                        className="w-full rounded-lg border border-border bg-card/60 hover:bg-card/80 p-4 text-left transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald/10 flex items-center justify-center shrink-0">
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
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {tInfo?.tier === 'PRESIDENTIAL' ? 'All 36 states + FCT' :
                               tInfo?.tier === 'STATE' ? 'Lagos State (14 LGAs)' :
                               'Lagos Island LGA (6 wards)'}
                            </p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-3 text-center">
          <p className="text-[10px] text-muted-foreground/50">
            OmniVote Monitor v2.1 &middot; Multi-Tenant &middot; AES-256 Encryption &middot; C2PA Content Provenance
          </p>
        </div>
      </div>
    </div>
  );
}