/**
 * Shared lazy-loaded (code-split) dashboard tab components.
 * Both tab-renderer and overview-tab import from here to avoid
 * duplicate dynamic() calls and circular dependencies.
 */

'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

import {
  DashboardSkeleton, TableSkeleton, FeedSkeleton, CardGridSkeleton,
  MapSkeleton, FormSkeleton, ChartSkeleton, ListDetailSkeleton,
} from '@/components/dashboard/dashboard-skeleton';

// ── Tab-specific loading skeletons ──
export const TAB_SKELETONS: Record<string, React.ComponentType> = {
  'situation': () => <div className="h-full p-4"><TableSkeleton rows={6} cols={5} /></div>,
  'map': MapSkeleton,
  'feed': () => <div className="h-full rounded-xl border border-border bg-card/40 overflow-hidden"><FeedSkeleton /></div>,
  'alerts': () => <div className="h-full p-4"><TableSkeleton rows={5} cols={4} /></div>,
  'osint': () => <CardGridSkeleton cols={2} rows={3} />,
  'ai': ChartSkeleton,
  'media': () => <CardGridSkeleton cols={3} rows={2} />,
  'mobilization': () => <CardGridSkeleton cols={2} rows={3} />,
  'campaigns': () => <CardGridSkeleton cols={2} rows={3} />,
  'security': ChartSkeleton,
  'field-safety': () => <CardGridSkeleton cols={2} rows={3} />,
  'pvt': ChartSkeleton,
  'victory-roadmap': ChartSkeleton,
  'evidence': ListDetailSkeleton,
  'flashpoint': () => <CardGridSkeleton cols={2} rows={3} />,
  'honeypot': () => <CardGridSkeleton cols={2} rows={3} />,
  'audit-logs': () => <div className="h-full p-4"><TableSkeleton rows={8} cols={5} /></div>,
  'submit': FormSkeleton,
  'my-reports': () => <div className="h-full p-4"><TableSkeleton rows={5} cols={4} /></div>,
  'agents': () => <div className="h-full p-4"><TableSkeleton rows={6} cols={5} /></div>,
  'engagement': ListDetailSkeleton,
  'system': () => <CardGridSkeleton cols={2} rows={3} />,
  'elections': () => <CardGridSkeleton cols={2} rows={3} />,
  'tenants': () => <div className="h-full p-4"><TableSkeleton rows={4} cols={4} /></div>,
  'campaign-analytics': () => <CardGridSkeleton cols={2} rows={3} />,
  'social-cards': () => <CardGridSkeleton cols={1} rows={2} />,
  'narrative': () => <CardGridSkeleton cols={2} rows={3} />,
  'reports': () => <CardGridSkeleton cols={2} rows={3} />,
  'data-explorer': ChartSkeleton,
};

// ── Dynamic import helper ──
const createDynamic = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  tabKey?: string,
) =>
  dynamic(loader, {
    loading: () => {
      const Skeleton = tabKey ? TAB_SKELETONS[tabKey] : null;
      if (Skeleton) return <div className="h-full p-4"><Skeleton /></div>;
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    },
  });

// ── Code-split components ──
export const GeoMapView = createDynamic(() => import('@/components/dashboard/geo-map').then(m => ({ default: m.GeoMapView })), 'map');
export const LiveFeed = createDynamic(() => import('@/components/dashboard/live-feed').then(m => ({ default: m.LiveFeed })), 'feed');
export const AlertTriage = createDynamic(() => import('@/components/dashboard/alert-triage').then(m => ({ default: m.AlertTriage })), 'alerts');
export const AiInsights = createDynamic(() => import('@/components/dashboard/ai-insights').then(m => ({ default: m.AiInsights })), 'ai');
export const MediaGallery = createDynamic(() => import('@/components/dashboard/media-gallery').then(m => ({ default: m.MediaGallery })), 'media');
export const SubmitReport = createDynamic(() => import('@/components/dashboard/field-submit').then(m => ({ default: m.SubmitReport })), 'submit');
export const MyReports = createDynamic(() => import('@/components/dashboard/field-reports').then(m => ({ default: m.MyReports })), 'my-reports');
export const AgentRoster = createDynamic(() => import('@/components/dashboard/agent-roster').then(m => ({ default: m.AgentRoster })), 'agents');
export const SystemHealth = createDynamic(() => import('@/components/dashboard/system-health').then(m => ({ default: m.SystemHealth })), 'system');
export const TenantManagement = createDynamic(() => import('@/components/dashboard/tenant-mgmt').then(m => ({ default: m.TenantManagement })), 'tenants');
export const SituationRoom = createDynamic(() => import('@/components/dashboard/situation-room').then(m => ({ default: m.SituationRoom })), 'situation');
export const AgentEngagement = createDynamic(() => import('@/components/dashboard/agent-engagement').then(m => ({ default: m.AgentEngagement })), 'engagement');
export const OsintMonitor = createDynamic(() => import('@/components/dashboard/osint-monitor').then(m => ({ default: m.OsintMonitor })), 'osint');
export const MobilizationEngine = createDynamic(() => import('@/components/dashboard/mobilization').then(m => ({ default: m.MobilizationEngine })), 'mobilization');
export const CampaignMonitor = createDynamic(() => import('@/components/dashboard/campaign-monitor').then(m => ({ default: m.CampaignMonitor })), 'campaigns');
export const SecurityCenter = createDynamic(() => import('@/components/dashboard/security-center').then(m => ({ default: m.SecurityCenter })), 'security');
export const FieldSafety = createDynamic(() => import('@/components/dashboard/field-safety').then(m => ({ default: m.FieldSafety })), 'field-safety');
export const PvtQuickCount = createDynamic(() => import('@/components/dashboard/pvt-quick-count').then(m => ({ default: m.PvtQuickCount })), 'pvt');
export const VictoryRoadmapPanel = createDynamic(() => import('@/components/dashboard/victory-roadmap').then(m => ({ default: m.VictoryRoadmap })), 'victory-roadmap');
export const EvidenceDossier = createDynamic(() => import('@/components/dashboard/evidence-dossier').then(m => ({ default: m.EvidenceDossier })), 'evidence');
export const FlashpointWargame = createDynamic(() => import('@/components/dashboard/flashpoint-wargame').then(m => ({ default: m.FlashpointWargame })), 'flashpoint');
export const HoneypotBiometrics = createDynamic(() => import('@/components/dashboard/honeypot-biometrics').then(m => ({ default: m.HoneypotBiometrics })), 'honeypot');
export const AuditLogViewer = createDynamic(() => import('@/components/dashboard/audit-log-viewer').then(m => ({ default: m.AuditLogViewer })), 'audit-logs');
export const CampaignAnalyticsPanel = createDynamic(() => import('@/components/dashboard/campaign-analytics').then(m => ({ default: m.default })), 'campaign-analytics');
export const SocialCardsPanel = createDynamic(() => import('@/components/dashboard/social-cards').then(m => ({ default: m.SocialCards })), 'social-cards');
export const NarrativeBuilderPanel = createDynamic(() => import('@/components/dashboard/narrative-builder').then(m => ({ default: m.NarrativeBuilder })), 'narrative');
export const ReportsCenter = createDynamic(() => import('@/components/dashboard/reports-center').then(m => ({ default: m.ReportsCenter })), 'reports');
export const LiveActivityStream = createDynamic(() => import('@/components/dashboard/live-activity-ticker').then(m => ({ default: m.LiveActivityTicker })), 'activity-stream');
export const SituationalKPIPanel = createDynamic(() => import('@/components/dashboard/situational-kpi').then(m => ({ default: m.SituationalKPI })), 'overview');
export const ElectionManagementPanel = createDynamic(() => import('@/components/dashboard/election-management').then(m => ({ default: m.ElectionManagement })), 'system');
export const OverviewTab = createDynamic(() => import('@/components/dashboard/overview-tab').then(m => ({ default: m.OverviewTab })), 'overview');
export const DataExplorerPanel = createDynamic(() => import('@/components/dashboard/data-explorer').then(m => ({ default: m.DataExplorer })), 'data-explorer');
