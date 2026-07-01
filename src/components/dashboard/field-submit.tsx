'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useDashboardStore } from '@/store/dashboard';
import {
  Send, MapPin, Camera, Mic, AlertTriangle, CheckCircle2,
  Radio, Loader2, ShieldCheck, Clock, Image as ImageIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function SubmitReport() {
  const { user } = useDashboardStore();
  const [incidentType, setIncidentType] = useState('OBSERVATION');
  const [severity, setSeverity] = useState('LOW');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSimulateSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setDescription('');
      }, 3000);
    }, 1500);
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Send className="h-5 w-5 text-emerald" />
            Submit Incident Report
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Report from your assigned polling unit. All submissions include GPS, timestamp, and device telemetry automatically.
          </p>
        </div>

        {/* Agent info card */}
        <Card className="border-emerald/20 bg-emerald/5">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald/20 flex items-center justify-center text-sm font-bold text-emerald">
              {user?.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-[11px] text-muted-foreground">{user?.role.replace(/_/g, ' ')}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald">
                <ShieldCheck className="h-3.5 w-3.5" />
                In-App Capture
              </div>
              <p className="text-[10px] text-muted-foreground">C2PA enabled</p>
            </div>
          </CardContent>
        </Card>

        {/* Proof of Presence notice */}
        <Card className="border-amber/20 bg-amber/5">
          <CardContent className="p-3.5 flex items-start gap-3">
            <Camera className="h-5 w-5 text-amber shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber">Proof of Presence (Anti-Spoofing)</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Media must be captured using the in-app camera. Camera roll uploads are disabled to prevent pre-recorded or stolen media from off-site locations.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Polling unit info */}
            <div className="rounded-lg bg-background border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-emerald" />
                <span className="text-xs font-medium">Assigned Polling Unit</span>
                <Badge variant="outline" className="ml-auto text-[10px] h-5 border-emerald/30 text-emerald">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald mr-1" />IN GEOFENCE
                </Badge>
              </div>
              <p className="text-sm font-medium">Surulere Ward 2 Unit 7</p>
              <p className="text-[11px] text-muted-foreground">LAG-SUR-007 &middot; Lagos / Surulere</p>
            </div>

            {/* Incident type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Incident Type</label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OBSERVATION">General Observation</SelectItem>
                  <SelectItem value="VIOLENCE">Violence</SelectItem>
                  <SelectItem value="INTIMIDATION">Voter Intimidation</SelectItem>
                  <SelectItem value="BALLOT_STUFFING">Ballot Stuffing</SelectItem>
                  <SelectItem value="LOGISTICS">Logistics Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Severity */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Severity</label>
              <div className="grid grid-cols-4 gap-2">
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-xs font-medium transition-all text-center',
                      severity === s
                        ? s === 'CRITICAL' ? 'bg-rose/15 text-rose border-rose/30'
                        : s === 'HIGH' ? 'bg-amber/15 text-amber border-amber/30'
                        : s === 'MEDIUM' ? 'bg-cyan/15 text-cyan border-cyan/30'
                        : 'bg-muted text-foreground border-border'
                        : 'border-border text-muted-foreground hover:bg-card/60'
                    )}
                  >
                    {s === 'CRITICAL' && <AlertTriangle className="h-3 w-3 mx-auto mb-0.5" />}
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you're observing at the polling unit..."
                className="min-h-[100px] bg-background border-border text-sm resize-none"
              />
            </div>

            {/* Media capture */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Attach Evidence</label>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-14 flex-col gap-1.5 border-border hover:bg-card/60">
                  <Camera className="h-5 w-5 text-emerald" />
                  <span className="text-[10px]">Photo</span>
                </Button>
                <Button variant="outline" className="h-14 flex-col gap-1.5 border-border hover:bg-card/60">
                  <Mic className="h-5 w-5 text-cyan" />
                  <span className="text-[10px]">Audio</span>
                </Button>
                <Button variant="outline" className="h-14 flex-col gap-1.5 border-border hover:bg-card/60">
                  <Radio className="h-5 w-5 text-amber" />
                  <span className="text-[10px]">Video</span>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                All media captured in-app with C2PA provenance metadata. Camera roll disabled for anti-spoofing.
              </p>
            </div>

            {/* SOS Button */}
            <Separator />
            <Button
              variant="outline"
              className="w-full h-12 border-rose/30 text-rose hover:bg-rose/10 hover:text-rose gap-2"
            >
              <Radio className="h-5 w-5" />
              <div className="text-left">
                <p className="text-sm font-semibold">SOS — Dead-Man&apos;s Switch</p>
                <p className="text-[10px] opacity-70">Triggers stealth recording + alerts T&S with exact GPS</p>
              </div>
            </Button>

            {/* Submit */}
            <Button
              onClick={handleSimulateSubmit}
              disabled={submitting || !description}
              className="w-full h-11 bg-emerald hover:bg-emerald/90 text-emerald-950 font-semibold gap-2"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
              ) : submitted ? (
                <><CheckCircle2 className="h-4 w-4" /> Report Submitted Successfully</>
              ) : (
                <><Send className="h-4 w-4" /> Submit Report</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <Card className="border-border bg-card/40">
            <CardContent className="p-3">
              <p className="text-lg font-bold text-emerald tabular-nums">7</p>
              <p className="text-[11px] text-muted-foreground">Reports Today</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/40">
            <CardContent className="p-3">
              <p className="text-lg font-bold text-cyan tabular-nums">3</p>
              <p className="text-[11px] text-muted-foreground">Media Captured</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}