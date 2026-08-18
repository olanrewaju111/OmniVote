#!/bin/bash
# Phase 10: Migrate framer-motion imports from 'motion' to 'm' for LazyMotion strict mode
# This script handles the bulk replacement across all dashboard components.

cd /home/z/my-project/src/components/dashboard

# Step 1: Replace 'import { motion' with 'import { m' in import statements
# but preserve AnimatePresence and other non-motion imports

for file in $(grep -rl "from 'framer-motion'" . 2>/dev/null); do
  # Check if file uses 'motion' (not just AnimatePresence)
  if grep -q '\bmotion\.' "$file" || grep -q '{ *motion *}' "$file"; then
    echo "Processing: $file"
    
    # Replace import: { motion, ... } -> { m, ... }
    # Also handle: { motion } -> { m }
    sed -i "s/import { *motion */import { m /g" "$file"
    sed -i "s/, *motion *,/,/g" "$file"
    sed -i "s/, *motion *}/}/g" "$file"
    sed -i "s/import { m } from 'framer-motion'/import { m, AnimatePresence } from 'framer-motion'/g" "$file"
    
    # Replace motion.div -> m.div, motion.span -> m.span, etc.
    sed -i 's/motion\./m./g' "$file"
    
    # Replace <motion. -> <m. (closing tags handled by same pattern)
    # Already handled by motion. -> m.
  else
    echo "Skipping (no motion usage): $file"
  fi
done

echo "Done! Verify with: grep -rn 'motion\\.' src/components/dashboard/ | grep -v node_modules"
