'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useDashboardStore } from '@/store/dashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Zap, Loader2, Vote, Building2,
  Lock, Mail, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';

const TENANT_TIER: Record<string, { tier: 'PRESIDENTIAL' | 'STATE' | 'LOCAL'; badge: string }> = {
  'presidential': { tier: 'PRESIDENTIAL', badge: 'Presidential' },
  'governorship': { tier: 'STATE', badge: 'Governorship' },
  'local-gov': { tier: 'LOCAL', badge: 'Local Gov' },
};

export function TenantLogin() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const { login, setElectionInfo, setTenantId, isAuthenticated, user } = useDashboardStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: tenantData, isLoading: tenantLoading } = useQuery<{
    tenant: { id: string; name: string; slug: string; primaryColor: string } | null;
  }>({
    queryKey: ['tenant-by-slug', slug],
    queryFn: () => fetchJson(`/api/tenants?slug=${slug}`),
    retry: false,
    staleTime: Infinity,
    enabled: mounted,
  });

  const tenant = tenantData?.tenant;
  const tierInfo = tenant ? TENANT_TIER[tenant.slug] : null;

  // If already authenticated and belongs to this tenant, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && user?.tenantSlug === slug) {
      router.replace('/');
    }
  }, [isAuthenticated, user, slug, router]);

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
        body: JSON.stringify({ email, password, tenantSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      if (data.user.tenantSlug !== slug) {
        throw new Error(`This account belongs to "${data.user.tenantName}", not this organization.`);
      }

      login(data.user);
      if (data.electionInfo) setElectionInfo(data.electionInfo);
      if (data.user.tenantId) setTenantId(data.user.tenantId);
      router.replace('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoggingIn(false);
    }
  };

  // Loading state
  if (!mounted || tenantLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald" />
      </div>
    );
  }

  // Tenant not found
  if (!tenant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-4">
          <div className="w-16 h-16 rounded-2xl bg-rose/10 flex items-center justify-center mx-auto">
            <Building2 className="h-8 w-8 text-rose" />
          </div>
          <h2 className="text-lg font-semibold">Organization Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The organization &quot;{slug}&quot; does not exist or is not active.
          </p>
          <Button variant="outline" onClick={() => router.push('/')}>
            Go to Main Login
          </Button>
        </div>
      </div>
    );
  }

  const accentColor = tenant.primaryColor || '#10b981';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — tenant branding */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[480px] border-r border-border flex-col p-8 justify-between relative overflow-hidden"
        style={{ background: `linear-gradient(to bottom, ${accentColor}10, var(--background) 70%)` }}
      >
        <div className="absolute inset-0 map-grid opacity-40" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor }}>
              <Zap className="h-6 w-6" style={{ color: '#0a0a0a' }} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">OmniVote</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Monitor</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-3 leading-tight">{tenant.name}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
            Secure election monitoring command center. Sign in with your organization credentials to access real-time dashboards and field operations.
          </p>
          {tierInfo && (
            <Badge variant="outline" className={cn(
              'mt-4 text-[11px] h-7 px-3',
              tierInfo.tier === 'PRESIDENTIAL' ? 'border-violet/30 text-violet bg-violet/10' :
              tierInfo.tier === 'STATE' ? 'border-amber/30 text-amber bg-amber/10' :
              'border-cyan/30 text-cyan bg-cyan/10'
            )}>
              <Vote className="h-3 w-3 mr-1.5" />
              {tierInfo.badge} Election
            </Badge>
          )}
        </div>
        <div className="relative z-10 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Active Agents', value: '25+' },
              { label: 'Polling Units', value: '381+' },
              { label: 'AI Models', value: '7' },
              { label: 'Uptime', value: '99.9%' },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
                <p className="text-lg font-bold tabular-nums" style={{ color: accentColor }}>{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ backgroundColor: accentColor }} />
            <span>Secure Connection &middot; AES-256 Encryption</span>
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            OmniVote Monitor v2.1 &middot; Zero-Trust Architecture &middot; C2PA Content Provenance
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto px-4 sm:px-6 py-8">
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                <Zap className="h-5 w-5" style={{ color: '#0a0a0a' }} />
              </div>
              <div>
                <h1 className="text-base font-bold">OmniVote Monitor</h1>
                <p className="text-[10px] text-muted-foreground">{tenant.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accentColor}20` }}>
                <Building2 className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <div>
                <p className="text-sm font-medium">{tenant.name}</p>
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
              <div className="space-y-2">
                <label htmlFor="tenant-login-email" className="text-xs font-medium text-muted-foreground">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="tenant-login-email"
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

              <div className="space-y-2">
                <label htmlFor="tenant-login-password" className="text-xs font-medium text-muted-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="tenant-login-password"
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

              {error && (
                <div className="p-2.5 rounded-lg bg-rose/10 border border-rose/20 text-xs text-rose">{error}</div>
              )}

              <Button
                type="submit"
                className="w-full h-10 font-medium text-white"
                style={{ backgroundColor: accentColor }}
                disabled={loggingIn}
              >
                {loggingIn ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing in...</>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            {process.env.NODE_ENV !== 'production' && (
              <p className="text-[10px] text-muted-foreground/40 mt-4 text-center">
                Development mode: use any seeded email with password &quot;password&quot;
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-border px-6 py-3 text-center">
          <p className="text-[10px] text-muted-foreground/50">
            OmniVote Monitor v2.1 &middot; Multi-Tenant &middot; AES-256 Encryption &middot; C2PA Content Provenance
          </p>
        </div>
      </div>
    </div>
  );
}
