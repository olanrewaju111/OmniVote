/**
 * Tab renderer — renders the correct tab component based on activeTab.
 * Uses ErrorBoundary wrapping for each tab.
 * Phase 10: Wrapped TabContent in React.memo with custom comparator
 * to prevent re-renders when only liveIncidents changes (which updates
 * frequently via WebSocket but is only used by 'overview' and 'feed' tabs).
 */

'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import {
  GeoMapView, SituationRoom, LiveFeed, AlertTriage, AiInsights,
  MediaGallery, MobilizationEngine, CampaignMonitor, SecurityCenter,
  FieldSafety, PvtQuickCount, VictoryRoadmapPanel, EvidenceDossier,
  FlashpointWargame, HoneypotBiometrics, AuditLogViewer, SubmitReport,
  MyReports, AgentRoster, AgentEngagement, SystemHealth,
  TenantManagement, CampaignAnalyticsPanel, SocialCardsPanel,
  NarrativeBuilderPanel, ReportsCenter, LiveActivityStream,
  ElectionManagementPanel, OsintMonitor, OverviewTab, DataExplorerPanel,
  BroadcastBriefingPanel,
} from '@/components/dashboard/lazy-components';
import type { TabContentProps } from '@/types/dashboard';

/**
 * Custom comparator: skip re-render if only liveIncidents changed
 * and the active tab doesn't consume it.
 */
function tabPropsEqual(prev: TabContentProps, next: TabContentProps): boolean {
  // Always re-render on tab change or data changes
  if (prev.activeTab !== next.activeTab) return false;
  if (prev.dashData !== next.dashData) return false;
  if (prev.incidents !== next.incidents) return false;
  if (prev.alertsData !== next.alertsData) return false;

  // Tabs that consume liveIncidents
  const liveConsumingTabs = ['overview', 'feed'];
  if (liveConsumingTabs.includes(prev.activeTab)) {
    return prev.liveIncidents === next.liveIncidents;
  }

  // For all other tabs, liveIncidents changes don't matter
  return true;
}

function TabContentInner({ activeTab, dashData, incidents, alertsData, liveIncidents }: TabContentProps) {
  switch (activeTab) {
    case 'overview':
      return (
        <ErrorBoundary title="Overview">
          <OverviewTab
            dashData={dashData}
            incidents={incidents}
            alertsData={alertsData}
            liveIncidents={liveIncidents}
          />
        </ErrorBoundary>
      );
    case 'situation':
      return (
        <ErrorBoundary title="Situation Room">
          <div className="h-full"><SituationRoom /></div>
        </ErrorBoundary>
      );
    case 'map':
      return (
        <ErrorBoundary title="Geo Map">
          <div className="h-full p-4">
            <div className="h-full rounded-xl border border-border bg-card/40 overflow-hidden">
              <GeoMapView points={dashData?.pollingUnits || []} bounds={dashData?.mapBounds || undefined} liveIncidents={liveIncidents} />
            </div>
          </div>
        </ErrorBoundary>
      );
    case 'feed':
      return (
        <ErrorBoundary title="Live Feed">
          <div className="h-full">
            <LiveFeed incidents={incidents} hasMore={dashData ? true : false} liveIncidents={liveIncidents} />
          </div>
        </ErrorBoundary>
      );
    case 'alerts':
      return (
        <ErrorBoundary title="Alert Triage">
          <div className="h-full">
            <AlertTriage
              alerts={alertsData?.alerts || []}
              operationalCount={alertsData?.operationalCount || 0}
              securityCount={alertsData?.securityCount || 0}
              criticalCount={alertsData?.criticalCount || 0}
            />
          </div>
        </ErrorBoundary>
      );
    case 'osint':
      return (
        <ErrorBoundary title="OSINT Monitor">
          <div className="h-full"><OsintMonitor /></div>
        </ErrorBoundary>
      );
    case 'ai':
      return (
        <ErrorBoundary title="AI Insights">
          <AiInsights
            incidents={incidents}
            stateAgg={dashData?.election.stateAgg || {}}
          />
        </ErrorBoundary>
      );
    case 'media':
      return (
        <ErrorBoundary title="Media Gallery">
          <MediaGallery />
        </ErrorBoundary>
      );
    case 'mobilization':
      return (
        <ErrorBoundary title="Mobilization Engine">
          <div className="h-full"><MobilizationEngine /></div>
        </ErrorBoundary>
      );
    case 'campaigns':
      return (
        <ErrorBoundary title="Campaign Monitor">
          <div className="h-full"><CampaignMonitor /></div>
        </ErrorBoundary>
      );
    case 'campaign-analytics':
      return (
        <ErrorBoundary title="Campaign Analytics">
          <div className="h-full"><CampaignAnalyticsPanel /></div>
        </ErrorBoundary>
      );
    case 'social-cards':
      return (
        <ErrorBoundary title="Social Cards">
          <div className="h-full"><SocialCardsPanel /></div>
        </ErrorBoundary>
      );
    case 'security':
      return (
        <ErrorBoundary title="Security Center">
          <div className="h-full"><SecurityCenter /></div>
        </ErrorBoundary>
      );
    case 'field-safety':
      return (
        <ErrorBoundary title="Field Safety">
          <div className="h-full"><FieldSafety /></div>
        </ErrorBoundary>
      );
    case 'pvt':
      return (
        <ErrorBoundary title="PVT Quick Count">
          <div className="h-full"><PvtQuickCount /></div>
        </ErrorBoundary>
      );
    case 'victory-roadmap':
      return (
        <ErrorBoundary title="Victory Roadmap">
          <div className="h-full"><VictoryRoadmapPanel /></div>
        </ErrorBoundary>
      );
    case 'evidence':
      return (
        <ErrorBoundary title="Evidence Dossier">
          <div className="h-full"><EvidenceDossier /></div>
        </ErrorBoundary>
      );
    case 'flashpoint':
      return (
        <ErrorBoundary title="Flashpoint Wargame">
          <div className="h-full"><FlashpointWargame /></div>
        </ErrorBoundary>
      );
    case 'honeypot':
      return (
        <ErrorBoundary title="Honeypot Biometrics">
          <div className="h-full"><HoneypotBiometrics /></div>
        </ErrorBoundary>
      );
    case 'audit-logs':
      return (
        <ErrorBoundary title="Audit Logs">
          <div className="h-full"><AuditLogViewer /></div>
        </ErrorBoundary>
      );
    case 'submit':
      return (
        <ErrorBoundary title="Submit Report">
          <SubmitReport />
        </ErrorBoundary>
      );
    case 'my-reports':
      return (
        <ErrorBoundary title="My Reports">
          <div className="h-full"><MyReports /></div>
        </ErrorBoundary>
      );
    case 'agents':
      return (
        <ErrorBoundary title="Agent Roster">
          <div className="h-full"><AgentRoster /></div>
        </ErrorBoundary>
      );
    case 'engagement':
      return (
        <ErrorBoundary title="Agent Engagement">
          <div className="h-full"><AgentEngagement /></div>
        </ErrorBoundary>
      );
    case 'system':
      return (
        <ErrorBoundary title="System Health">
          <div className="h-full flex flex-col overflow-y-auto">
            <ElectionManagementPanel />
            <SystemHealth />
          </div>
        </ErrorBoundary>
      );
    case 'tenants':
      return (
        <ErrorBoundary title="Tenant Management">
          <div className="h-full"><TenantManagement /></div>
        </ErrorBoundary>
      );
    case 'narrative':
      return (
        <ErrorBoundary title="Narrative Builder">
          <div className="h-full"><NarrativeBuilderPanel /></div>
        </ErrorBoundary>
      );
    case 'reports':
      return (
        <ErrorBoundary title="Reports Center">
          <div className="h-full"><ReportsCenter /></div>
        </ErrorBoundary>
      );
    case 'activity-stream':
      return (
        <ErrorBoundary title="Activity Stream">
          <div className="h-full"><LiveActivityStream /></div>
        </ErrorBoundary>
      );
    case 'data-explorer':
      return (
        <ErrorBoundary title="Data Explorer">
          <div className="h-full"><DataExplorerPanel /></div>
        </ErrorBoundary>
      );
    case 'broadcast':
      return (
        <ErrorBoundary title="Broadcast Briefing">
          <div className="h-full"><BroadcastBriefingPanel /></div>
        </ErrorBoundary>
      );
    default:
      return <DashboardSkeleton />;
  }
}

export const TabContent = React.memo(TabContentInner, tabPropsEqual);
