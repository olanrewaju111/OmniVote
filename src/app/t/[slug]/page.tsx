'use client';

import dynamic from 'next/dynamic';

const TenantLogin = dynamic(
  () => import('@/components/dashboard/tenant-login').then(m => ({ default: m.TenantLogin })),
  { ssr: false },
);

export default function TenantLoginPage() {
  return <TenantLogin />;
}