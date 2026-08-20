'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { m, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '@/store/dashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Zap, Loader2, Vote, Building2,
  Lock, Mail, Eye, EyeOff, Shield, ArrowLeft,
  Check, X as XIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';

const TENANT_TIER: Record<string, { tier: 'PRESIDENTIAL' | 'STATE' | 'LOCAL'; badge: string }> = {
  'presidential': { tier: 'PRESIDENTIAL', badge: 'Presidential' },
  'governorship': { tier: 'STATE', badge: 'Governorship' },
  'local-gov': { tier: 'LOCAL', badge: 'Local Gov' },
};

// Password strength calculator
function getPasswordStrength(pw: string): { score: number; label: string; color: string; checks: { label: string; pass: boolean }[] } {
  if (!pw) return { score: 0, label: '', color: '', checks: [] };
  const checks = [
    { label: '8+ characters', pass: pw.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(pw) },
    { label: 'Number', pass: /[0-9]/.test(pw) },
    { label: 'Special char', pass: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = checks.filter(c => c.pass).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'text-rose', 'text-amber', 'text-cyan', 'text-emerald'];
  return { score, label: labels[score], color: colors[score], checks };
}

export function TenantLogin() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const { login, setElectionInfo, setTenantId, setAvailableTenants, isAuthenticated, user } = useDashboardStore();

  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const { data: tenantData, isLoading: tenantLoading } = useQuery<{
    tenant: { id: string; name: string; slug: string; primaryColor: string; pollingUnitCount?: number; _count?: { users: number; elections: number; incidents: number } } | null;
  }>({
    queryKey: ['tenant-by-slug', slug],
    queryFn: () => fetchJson(`/api/tenants?slug=${slug}`),
    retry: false,
    staleTime: Infinity,
    enabled: mounted,
  });

  const tenant = tenantData?.tenant;
  const tierInfo = tenant ? TENANT_TIER[tenant.slug] : null;
  const pwStrength = useMemo(() => getPasswordStrength(password), [password]);

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
      if (data.availableTenants) setAvailableTenants(data.availableTenants);
      router.replace('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoggingIn(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotError('Email is required');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (!res.ok) throw new Error('Something went wrong. Please try again.');
      setForgotSent(true);
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setForgotLoading(false);
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
        <m.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4 max-w-sm px-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-rose/10 flex items-center justify-center mx-auto">
            <Building2 className="h-8 w-8 text-rose" />
          </div>
          <h2 className="text-lg font-semibold">Organization Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The organization &quot;{slug}&quot; does not exist or is not active.
          </p>
          <Button variant="outline" onClick={() => router.push('/')} className="gap-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Go to Main Login
          </Button>
        </m.div>
      </div>
    );
  }

  const accentColor = tenant.primaryColor || '#10b981';

  return (
    <div className="min-h-screen bg-background flex">
      {/* ═══ Left panel — tenant branding ═══ */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[480px] border-r border-border flex-col p-8 justify-between relative overflow-hidden"
        style={{ background: `linear-gradient(to bottom, ${accentColor}10, var(--background) 70%)` }}
      >
        <div className="absolute inset-0 map-grid opacity-30" />
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: `${accentColor}08` }} />

        <div className="relative z-10">
          <m.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-10"
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: accentColor }}>
              <Zap className="h-6 w-6" style={{ color: '#0a0a0a' }} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">OmniVote</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Monitor</p>
            </div>
          </m.div>

          <m.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl font-bold mb-3 leading-tight"
          >
            {tenant.name}
          </m.h2>
          <m.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-sm text-muted-foreground leading-relaxed max-w-sm"
          >
            Secure election monitoring command center. Sign in with your organization credentials to access real-time dashboards and field operations.
          </m.p>
          {tierInfo && (
            <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Badge variant="outline" className={cn(
                'mt-4 text-[11px] h-7 px-3',
                tierInfo.tier === 'PRESIDENTIAL' ? 'border-violet/30 text-violet bg-violet/10' :
                tierInfo.tier === 'STATE' ? 'border-amber/30 text-amber bg-amber/10' :
                'border-cyan/30 text-cyan bg-cyan/10'
              )}>
                <Vote className="h-3 w-3 mr-1.5" />
                {tierInfo.badge} Election
              </Badge>
            </m.div>
          )}
        </div>

        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="relative z-10 space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            {(tenant._count
              ? [
                  { label: 'Agents', value: String(tenant._count.users) },
                  { label: 'Polling Units', value: String(tenant.pollingUnitCount || 0) },
                  { label: 'Incidents', value: String(tenant._count.incidents) },
                  { label: 'Elections', value: String(tenant._count.elections) },
                ]
              : [
                  { label: 'Agents', value: '—' },
                  { label: 'Polling Units', value: '—' },
                  { label: 'Incidents', value: '—' },
                  { label: 'Elections', value: '—' },
                ]
            ).map(s => (
              <div key={s.label} className="rounded-lg border border-border/60 bg-card/30 px-3 py-2.5">
                <p className="text-lg font-bold tabular-nums" style={{ color: accentColor }}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground/60">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/40">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ backgroundColor: accentColor }} />
            <span>Secure Connection &middot; AES-256 Encryption</span>
          </div>
        </m.div>
      </div>

      {/* ═══ Right panel — login form ═══ */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto px-4 sm:px-6 py-8">
            {/* Mobile header */}
            <m.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:hidden flex items-center gap-3 mb-8"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                <Zap className="h-5 w-5" style={{ color: '#0a0a0a' }} />
              </div>
              <div>
                <h1 className="text-base font-bold">OmniVote Monitor</h1>
                <p className="text-[10px] text-muted-foreground">{tenant.name}</p>
              </div>
            </m.div>

            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-3 mb-6"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accentColor}15` }}>
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
            </m.div>

            {/* ═══════════ Login Form ═══════════ */}
            <AnimatePresence mode="wait">
              {view === 'login' ? (
                <m.div
                  key="login"
                  initial={{ opacity: 0, x: 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="text-lg font-semibold mb-1">
                    Sign In
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Enter your credentials to access the command center.
                  </p>

                  <form onSubmit={handleLogin} className="space-y-4">
                    {/* Email field */}
                    <div className="space-y-1.5">
                      <label htmlFor="tenant-login-email" className={cn(
                        'text-xs font-medium transition-colors',
                        focusedField === 'email' ? 'text-foreground' : 'text-muted-foreground/60'
                      )}>
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className={cn(
                          'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors',
                          focusedField === 'email' ? 'text-emerald' : 'text-muted-foreground/40'
                        )} />
                        <Input
                          id="tenant-login-email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setError(''); }}
                          onFocus={() => setFocusedField('email')}
                          onBlur={() => setFocusedField(null)}
                          className="pl-9 h-11 bg-card/40 border-border/60 text-sm transition-all focus-visible:border-emerald/40"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    {/* Password field */}
                    <div className="space-y-1.5">
                      <label htmlFor="tenant-login-password" className={cn(
                        'text-xs font-medium transition-colors',
                        focusedField === 'password' ? 'text-foreground' : 'text-muted-foreground/60'
                      )}>
                        Password
                      </label>
                      <div className="relative">
                        <Lock className={cn(
                          'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors',
                          focusedField === 'password' ? 'text-emerald' : 'text-muted-foreground/40'
                        )} />
                        <Input
                          id="tenant-login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setError(''); }}
                          onFocus={() => setFocusedField('password')}
                          onBlur={() => setFocusedField(null)}
                          className="pl-9 pr-10 h-11 bg-card/40 border-border/60 text-sm transition-all focus-visible:border-emerald/40"
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Password strength indicator */}
                      <AnimatePresence>
                        {password.length > 0 && (
                          <m.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-1.5 overflow-hidden"
                          >
                            {/* Strength bar */}
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map(i => (
                                <div key={i} className={cn(
                                  'h-1 flex-1 rounded-full transition-colors duration-300',
                                  i <= pwStrength.score
                                    ? pwStrength.score >= 3 ? 'bg-emerald' : pwStrength.score >= 2 ? 'bg-amber' : 'bg-rose'
                                    : 'bg-secondary'
                                )} />
                              ))}
                            </div>
                            <div className="flex items-center justify-between">
                              <p className={cn('text-[10px] font-medium', pwStrength.color)}>
                                {pwStrength.label}
                              </p>
                            </div>
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Forgot password link */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setView('forgot'); setError(''); setForgotError(''); setForgotSent(false); setForgotEmail(email); }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>

                    {/* Error message */}
                    <AnimatePresence>
                      {error && (
                        <m.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="flex items-start gap-2 p-3 rounded-lg bg-rose/10 border border-rose/20 text-xs text-rose"
                        >
                          <XIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{error}</span>
                        </m.div>
                      )}
                    </AnimatePresence>

                    {/* Submit button */}
                    <Button
                      type="submit"
                      className="w-full h-11 font-medium text-white transition-all duration-200 hover:shadow-lg"
                      style={{
                        backgroundColor: accentColor,
                        boxShadow: `0 0 0 0 ${accentColor}00`,
                      }}
                      disabled={loggingIn}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 20px ${accentColor}30`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      {loggingIn ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Authenticating...</>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          Sign In
                          <Shield className="h-3.5 w-3.5" style={{ opacity: 0.6 }} />
                        </span>
                      )}
                    </Button>
                  </form>
                </m.div>
              ) : (
                /* ═══════════ Forgot Password Form ═══════════ */
                <m.div
                  key="forgot"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="text-lg font-semibold mb-1">
                    Reset Password
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Enter your email and we&apos;ll send you a reset link.
                  </p>

                  {forgotSent ? (
                    <m.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-4"
                    >
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald/10 border border-emerald/20">
                        <div className="w-8 h-8 rounded-full bg-emerald/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="h-4 w-4 text-emerald" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald">Reset link sent</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            If an account exists, a reset link has been sent to your email.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setView('login')}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Sign In
                      </button>
                    </m.div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      {/* Forgot email field */}
                      <div className="space-y-1.5">
                        <label htmlFor="tenant-forgot-email" className={cn(
                          'text-xs font-medium transition-colors',
                          focusedField === 'forgot-email' ? 'text-foreground' : 'text-muted-foreground/60'
                        )}>
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className={cn(
                            'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors',
                            focusedField === 'forgot-email' ? 'text-emerald' : 'text-muted-foreground/40'
                          )} />
                          <Input
                            id="tenant-forgot-email"
                            type="email"
                            placeholder="your@email.com"
                            value={forgotEmail}
                            onChange={(e) => { setForgotEmail(e.target.value); setForgotError(''); }}
                            onFocus={() => setFocusedField('forgot-email')}
                            onBlur={() => setFocusedField(null)}
                            className="pl-9 h-11 bg-card/40 border-border/60 text-sm transition-all focus-visible:border-emerald/40"
                            autoComplete="email"
                            required
                          />
                        </div>
                      </div>

                      {/* Forgot error message */}
                      <AnimatePresence>
                        {forgotError && (
                          <m.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="flex items-start gap-2 p-3 rounded-lg bg-rose/10 border border-rose/20 text-xs text-rose"
                          >
                            <XIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{forgotError}</span>
                          </m.div>
                        )}
                      </AnimatePresence>

                      {/* Send reset link button */}
                      <Button
                        type="submit"
                        className="w-full h-11 font-medium text-white transition-all duration-200 hover:shadow-lg"
                        style={{
                          backgroundColor: accentColor,
                          boxShadow: `0 0 0 0 ${accentColor}00`,
                        }}
                        disabled={forgotLoading}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 20px ${accentColor}30`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        {forgotLoading ? (
                          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            Send Reset Link
                            <Mail className="h-3.5 w-3.5" style={{ opacity: 0.6 }} />
                          </span>
                        )}
                      </Button>

                      {/* Back to sign in */}
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => setView('login')}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          Back to Sign In
                        </button>
                      </div>
                    </form>
                  )}
                </m.div>
              )}
            </AnimatePresence>

            {process.env.NODE_ENV !== 'production' && (
              <p className="text-[10px] text-muted-foreground/30 mt-4 text-center">
                Development mode: use any seeded email with password &quot;password&quot;
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-border/40 px-6 py-3 text-center">
          <p className="text-[10px] text-muted-foreground/30">
            OmniVote Monitor v2.1 &middot; Multi-Tenant &middot; AES-256 Encryption &middot; C2PA Content Provenance
          </p>
        </div>
      </div>
    </div>
  );
}
