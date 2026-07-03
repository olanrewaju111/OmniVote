'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useDashboardStore, ROLE_TABS, type UserRole, TIER_SHORT } from '@/store/dashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Shield, Eye, UserCheck, Users, Zap, Search,
  ChevronRight, Loader2, Radio, Vote, Building2,
  Lock, Mail, ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', icon: <Shield className="h-5 w-5" />, color: 'text-emerald border-emerald/30 bg-emerald/10', desc: 'Platform owner — infrastructure, tenants, global health' },
  TENANT_ADMIN: { label: 'Tenant Admin', icon: <Users className="h-5 w-5" />, color: 'text-cyan border-cyan/30 bg-cyan/10', desc: 'Organization admin — agent rosters, account management' },
  ANALYST: { label: 'Analyst', icon: <Eye className="h-5 w-5" />, color: 'text-amber border-amber/30 bg-amber/10', desc: 'Live dashboard monitoring, incident review, field ops' },
  TRUST_SAFETY: { label: 'Trust & Safety', icon: <UserCheck className="h-5 w-5" />, color: 'text-rose border-rose/30 bg-rose/10', desc: 'Deepfake review, disverification, agent authenticity' },
  FIELD_AGENT: { label: 'Field Agent', icon: <Radio className="h-5 w-5" />, color: 'text-muted-foreground border-border bg-card', desc: 'Polling unit observer — submit reports & media' },
};

const TENANT_TIER: Record<string, { tier: 'PRESIDENTIAL' | 'STATE' | 'LOCAL'; badge: string }> = {
  'presidential': { tier: 'PRESIDENTIAL', badge: 'Presidential' },
  'governorship': { tier: 'STATE', badge: 'Governorship' },
  'local-gov': { tier: 'LOCAL', badge: 'Local Gov' },
};

export function LoginScreen() {
  const { login, setElectionInfo, setTenantId } = useDashboardStore();

  // Step 1: select tenant, Step 2: enter credentials
  const [step, setStep] = useState<'tenant' | 'credentials'>('tenant');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState('');

  // Fetch tenants only (no user data exposed)
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

  const activeTenant = tenants.find(t => t.id === selectedTenantId);
  const tierInfo = activeTenant ? TENANT_TIER[activeTenant.slug] : null;

  const handleTenantSelect = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setStep('credentials');
    setError('');
  };

  const handleBack = () => {
    setStep('tenant');
    setEmail('');
    setPassword('');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    setLoggingIn(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      login(data.user);
      if (data.electionInfo) setElectionInfo(data.electionInfo);
      if (data.user.tenantId) setTenantId(data.user.tenantId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoggingIn(false);
    }
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

      {/* Right panel — login flow */}
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

            {/* Step 1: Tenant Selection */}
            {step === 'tenant' && (
              <>
                <h3 className="text-lg font-semibold mb-1">Select Organization</h3>
                <p className="text-sm text-muted-foreground mb-6">Choose your election monitoring organization.</p>

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
                          onClick={() => handleTenantSelect(t.id)}
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
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Step 2: Credentials */}
            {step === 'credentials' && activeTenant && (
              <>
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
                  aria-label="Back to tenant selection"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to organizations
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${activeTenant.primaryColor}20` }}
                  >
                    <Building2 className="h-5 w-5" style={{ color: activeTenant.primaryColor }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{activeTenant.name}</p>
                    {tierInfo && (
                      <Badge variant="outline" className={cn(
                        'text-[10px] h-5 mt-0.5',
                        tierInfo.tier === 'PRESIDENTIAL' ? 'border-violet/30 text-violet bg-violet/10' :
                        tierInfo.tier === 'STATE' ? 'border-amber/30 text-amber bg-amber/10' :
                        'border-cyan/30 text-cyan bg-cyan/10'
                      )}>
                        {tierInfo.badge} Election
                      </Badge>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-1">Sign In</h3>
                <p className="text-sm text-muted-foreground mb-6">Enter your credentials to access the command center.</p>

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Email */}
                  <div className="space-y-2">
                    <label htmlFor="login-email" className="text-xs font-medium text-muted-foreground">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        className="pl-9 h-10 bg-card/60 border-border text-sm"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label htmlFor="login-password" className="text-xs font-medium text-muted-foreground">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        className="pl-9 pr-9 h-10 bg-card/60 border-border text-sm"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="p-2.5 rounded-lg bg-rose/10 border border-rose/20 text-xs text-rose">
                      {error}
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full h-10 bg-emerald hover:bg-emerald/90 text-emerald-950 font-medium"
                    disabled={loggingIn}
                  >
                    {loggingIn ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing in...</>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>

                {/* Dev hint */}
                {process.env.NODE_ENV !== 'production' && (
                  <p className="text-[10px] text-muted-foreground/40 mt-4 text-center">
                    Development mode: use any seeded email with password &quot;password&quot;
                  </p>
                )}
              </>
            )}
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