'use client';

import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';

/**
 * Wrapper that provides AnimatePresence tab transition animation.
 * Extracted so framer-motion is code-split away from the initial page bundle.
 */
export const AnimatedTabTransition = React.memo(function AnimatedTabTransition({
  activeKey,
  children,
}: {
  activeKey: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        initial={{ opacity: 0, y: 12, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.995 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="h-full"
        role="tabpanel"
        aria-label={`${activeKey.replace(/-/g, ' ')} panel`}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
});
