'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { LazyMotion, domAnimation } from 'framer-motion';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // 15s stale time matches our SSE-driven approach: data is fresh for 15s,
        // then SSE would have already pushed updates. Polling at 30s is the fallback.
        staleTime: 15_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  }));

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <LazyMotion features={domAnimation} strict>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </LazyMotion>
    </ThemeProvider>
  );
}