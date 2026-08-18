'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useDashboardStore, type ViewTab, type UserRole } from '@/store/dashboard';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Plus,
  X,
  Send,
  Radio,
  ShieldAlert,
  BarChart3,
  MapPin,
} from 'lucide-react';

type UserRoleSet = Set<UserRole>;

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  tab: ViewTab;
  roles: UserRoleSet | '*';
  isSOS?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'submit-report',
    label: 'Submit Report',
    icon: <Send className="h-5 w-5" />,
    tab: 'submit',
    roles: new Set<UserRole>(['FIELD_AGENT', 'TENANT_ADMIN']),
  },
  {
    id: 'live-feed',
    label: 'Live Feed',
    icon: <Radio className="h-5 w-5" />,
    tab: 'feed',
    roles: '*',
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: <ShieldAlert className="h-5 w-5" />,
    tab: 'alerts',
    roles: new Set<UserRole>(['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY']),
  },
  {
    id: 'quick-count',
    label: 'Quick Count',
    icon: <BarChart3 className="h-5 w-5" />,
    tab: 'pvt',
    roles: new Set<UserRole>(['ANALYST', 'TENANT_ADMIN', 'SUPER_ADMIN']),
  },
  {
    id: 'map',
    label: 'Map',
    icon: <MapPin className="h-5 w-5" />,
    tab: 'map',
    roles: new Set<UserRole>(['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY']),
  },
  {
    id: 'sos-emergency',
    label: 'SOS Emergency',
    icon: <Radio className="h-5 w-5" />,
    tab: 'alerts',
    roles: '*',
    isSOS: true,
  },
];

function useFilteredActions(): QuickAction[] {
  const user = useDashboardStore((s) => s.user);
  if (!user) return [];
  return QUICK_ACTIONS.filter((action) => {
    if (action.roles === '*') return true;
    return action.roles.has(user.role);
  });
}

export const QuickActionsFab = React.memo(function QuickActionsFab() {
  const isMobile = useIsMobile();
  const { setSelectedTab, unreadAlerts, user } = useDashboardStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isSendingSOS, setIsSendingSOS] = useState(false);

  const filteredActions = useFilteredActions();

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleAction = useCallback(
    (action: QuickAction) => {
      if (action.isSOS) {
        const confirmed = window.confirm(
          '🚨 EMERGENCY SOS\n\nThis will send a critical violence alert to the operations team.\nAre you sure you want to proceed?'
        );
        if (!confirmed) return;

        const tenantId = user?.tenantId;
        if (!tenantId) {
          toast.error('No tenant context found. Please log in again.');
          setIsOpen(false);
          return;
        }

        setIsSendingSOS(true);
        fetch(`/api/incidents?tenantId=${tenantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'VIOLENCE',
            severity: 'CRITICAL',
            description: 'SOS Emergency triggered from Quick Actions',
          }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success('SOS alert sent — help is on the way');
          })
          .catch(() => {
            toast.error('Failed to send SOS. Try again or call emergency services.');
          })
          .finally(() => {
            setIsSendingSOS(false);
            setIsOpen(false);
          });
        return;
      }

      setSelectedTab(action.tab);
      setIsOpen(false);
    },
    [setSelectedTab, user]
  );

  // Don't render on desktop or when not authenticated
  if (!isMobile || !user) return null;

  // Reverse so the last action (SOS) appears at the bottom
  const displayedActions = [...filteredActions].reverse();

  return (
    <AnimatePresence>
      {/* Semi-transparent backdrop when expanded */}
      {isOpen && (
        <motion.div
          key="fab-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-0">
        {/* Expanded action buttons */}
        <AnimatePresence>
          {isOpen &&
            displayedActions.map((action, index) => {
              // Stagger delay — items fan out upward (reversed order, so index 0 = SOS at bottom)
              const staggerDelay = (displayedActions.length - 1 - index) * 0.05;
              const yOffset = (displayedActions.length - index) * 56 + 8;

              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.8 }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 25,
                    delay: staggerDelay,
                  }}
                  className={cn(
                    'flex items-center gap-2.5 mb-2',
                    'absolute bottom-0 right-0'
                  )}
                  style={{ bottom: yOffset }}
                >
                  {/* Label tooltip */}
                  <motion.span
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: staggerDelay + 0.1, duration: 0.15 }}
                    className={cn(
                      'whitespace-nowrap text-xs font-medium px-2.5 py-1 rounded-lg',
                      'pointer-events-none select-none',
                      action.isSOS
                        ? 'bg-rose-600 text-white'
                        : 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    )}
                  >
                    {action.label}
                  </motion.span>

                  {/* Action button */}
                  <button
                    onClick={() => handleAction(action)}
                    disabled={action.isSOS && isSendingSOS}
                    aria-label={action.label}
                    className={cn(
                      'relative flex items-center justify-center w-11 h-11 rounded-full',
                      'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      action.isSOS
                        ? cn(
                            'bg-gradient-to-br from-rose-500 to-rose-700 text-white',
                            'focus-visible:ring-rose-400',
                            'shadow-lg shadow-rose-500/30',
                            'hover:from-rose-400 hover:to-rose-600',
                            'disabled:opacity-60'
                          )
                        : cn(
                            'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200',
                            'border border-gray-200 dark:border-gray-700',
                            'shadow-md',
                            'focus-visible:ring-emerald-400',
                            'hover:bg-gray-50 dark:hover:bg-gray-700'
                          )
                    )}
                  >
                    {/* SOS pulse ring */}
                    {action.isSOS && (
                      <motion.span
                        className="absolute inset-0 rounded-full bg-rose-500"
                        animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          ease: 'easeOut',
                        }}
                      />
                    )}

                    {/* Alerts unread badge */}
                    {action.id === 'alerts' && unreadAlerts > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-amber text-amber-950 text-[10px] font-bold flex items-center justify-center px-1 border-2 border-white dark:border-gray-800">
                        {unreadAlerts > 99 ? '99+' : unreadAlerts}
                      </span>
                    )}

                    {/* SOS loading spinner */}
                    {action.isSOS && isSendingSOS ? (
                      <motion.div
                        className="h-5 w-5 rounded-full border-2 border-white border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      action.icon
                    )}
                  </button>
                </motion.div>
              );
            })}
        </AnimatePresence>

        {/* Main FAB button */}
        <motion.button
          onClick={toggleMenu}
          aria-label="Quick actions"
          aria-expanded={isOpen}
          className={cn(
            'relative flex items-center justify-center w-14 h-14 rounded-full',
            'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
            'shadow-lg shadow-emerald-500/25',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2',
            'hover:from-emerald-400 hover:to-emerald-500 active:scale-95',
            'transition-colors duration-150'
          )}
          whileTap={{ scale: 0.92 }}
        >
          {/* Pulse indicator for unread alerts */}
          {unreadAlerts > 0 && !isOpen && (
            <motion.span
              className="absolute inset-0 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          )}

          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Plus className="h-6 w-6" />
            )}
          </motion.div>
        </motion.button>
      </div>
    </AnimatePresence>
  );
});