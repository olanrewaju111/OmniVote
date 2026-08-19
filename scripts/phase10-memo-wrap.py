#!/usr/bin/env python3
"""Phase 10: Wrap heavy exported components with React.memo."""
import re, sys

# Components with NO props (self-contained tabs) - safe for simple React.memo
NO_PROP_COMPONENTS = [
    ('campaign-monitor.tsx', 'CampaignMonitor'),
    ('mobilization.tsx', 'MobilizationEngine'),
    ('election-tracker.tsx', 'ElectionTracker'),
    ('security-center.tsx', 'SecurityCenter'),
    ('campaign-analytics.tsx', 'CampaignAnalyticsPanel'),
    ('honeypot-biometrics.tsx', 'HoneypotBiometrics'),
    ('agent-engagement.tsx', 'AgentEngagement'),
    ('flashpoint-wargame.tsx', 'FlashpointWargame'),
    ('evidence-dossier.tsx', 'EvidenceDossier'),
    ('osint-monitor.tsx', 'OsintMonitor'),
    ('victory-roadmap.tsx', 'VictoryRoadmap'),
    ('field-safety.tsx', 'FieldSafety'),
    ('pvt-quick-count.tsx', 'PvtQuickCount'),
    ('agent-roster.tsx', 'AgentRoster'),
    ('narrative-builder.tsx', 'NarrativeBuilder'),
    ('reports-center.tsx', 'ReportsCenter'),
    ('tenant-mgmt.tsx', 'TenantManagement'),
    ('social-cards.tsx', 'SocialCards'),
]

BASE = '/home/z/my-project/src/components/dashboard'

def wrap_component(filename, comp_name):
    filepath = f'{BASE}/{filename}'
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if already wrapped with React.memo
    if f'export const {comp_name}' in content or 'React.memo' in content.split(f'export function {comp_name}')[0][-100:]:
        print(f'  SKIP (already memoized or const export): {filename}')
        return
    
    # Replace: export function CompName(...) { -> export const CompName = React.memo(function CompName(...) {
    old = f'export function {comp_name}'
    new = f'export const {comp_name} = React.memo(function {comp_name}'
    if old not in content:
        print(f'  SKIP (pattern not found): {filename}')
        return
    
    content = content.replace(old, new, 1)
    
    # Close the function - add the React.memo closing paren
    # Find the last } in the file and add ); after it
    # This is tricky - we need to find the matching closing brace
    # Simple approach: find the last line that's just '}' or ends with '}'
    # and append ');' after the function's closing brace
    
    # For components, the last } at the top level should be the function close
    # We'll find the last occurrence of a standalone '}' 
    lines = content.split('\n')
    # Find last non-empty line
    last_content_line = -1
    for i in range(len(lines) - 1, -1, -1):
        stripped = lines[i].strip()
        if stripped and not stripped.startswith('//') and not stripped.startswith('*'):
            last_content_line = i
            break
    
    if last_content_line >= 0:
        line = lines[last_content_line]
        stripped = line.strip()
        if stripped == '}':
            lines[last_content_line] = line.rstrip() + ');'
        elif stripped.endswith('}'):
            lines[last_content_line] = line.rstrip()[:-1] + '});'
        else:
            print(f'  WARN (unexpected last line): {filename}: {stripped[:60]}')
            return
    
    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))
    print(f'  OK: {filename} -> {comp_name}')

for filename, comp_name in NO_PROP_COMPONENTS:
    print(f'Processing {filename}...')
    wrap_component(filename, comp_name)
