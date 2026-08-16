'use client';

import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      {/* Map-grid background pattern */}
      <div className="map-grid absolute inset-0 opacity-40" />

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-8 px-6 text-center"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Decorative icon container */}
        <motion.div
          variants={item}
          className="flex h-28 w-28 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10"
        >
          <ShieldAlert className="size-14 text-emerald-500/50" strokeWidth={1.5} />
        </motion.div>

        {/* 404 */}
        <motion.p
          variants={item}
          className="select-none text-8xl font-bold tracking-tight text-muted-foreground/20"
        >
          404
        </motion.p>

        {/* Heading */}
        <motion.h1
          variants={item}
          className="text-xl font-semibold tracking-tight"
        >
          Page Not Found
        </motion.h1>

        {/* Description */}
        <motion.p
          variants={item}
          className="max-w-md text-sm text-muted-foreground"
        >
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
        </motion.p>

        {/* Actions */}
        <motion.div variants={item} className="flex gap-3">
          <Button onClick={() => router.push('/')}>Go to Dashboard</Button>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
