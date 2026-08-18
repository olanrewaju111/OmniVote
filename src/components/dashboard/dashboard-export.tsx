'use client';

import React, { useState, useCallback, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Download,
  Loader2,
  Image as ImageIcon,
  FileText,
  Check,
  Layers,
  Monitor,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DashboardExportProps {
  /** Ref to the container element to capture */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Title for the export */
  title?: string;
  /** Button size */
  size?: 'sm' | 'default' | 'lg';
  /** Additional class */
  className?: string;
}

type ExportFormat = 'png' | 'pdf';
type ExportScope = 'current' | 'full';
type ExportQuality = 1 | 2;

type ExportStep = 'idle' | 'capturing' | 'generating' | 'done' | 'error';

// ─── Option Button ──────────────────────────────────────────────────────────

function OptionBtn({
  active,
  onClick,
  children,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all cursor-pointer flex-1 justify-center',
        active
          ? 'border-primary/50 bg-primary/10 text-foreground'
          : 'border-border/60 text-muted-foreground hover:border-foreground/20 hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DashboardExport({
  containerRef,
  title = 'Dashboard Export',
  size = 'default',
  className,
}: DashboardExportProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scope, setScope] = useState<ExportScope>('current');
  const [quality, setQuality] = useState<ExportQuality>(2);
  const [step, setStep] = useState<ExportStep>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const abortRef = useRef(false);

  const resetState = useCallback(() => {
    setStep('idle');
    setPreviewUrl(null);
    setErrorMessage('');
  }, []);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      setOpen(v);
      if (!v) {
        abortRef.current = true;
        resetState();
      } else {
        abortRef.current = false;
      }
    },
    [resetState],
  );

  const generatePreview = useCallback(async () => {
    if (!containerRef.current) {
      setErrorMessage('No dashboard container found');
      setStep('error');
      return;
    }

    abortRef.current = false;
    setStep('capturing');
    setErrorMessage('');

    try {
      const { toPng } = await import('html-to-image');
      const pixelRatio = quality;

      if (abortRef.current) return;

      const dataUrl = await toPng(containerRef.current, {
        pixelRatio,
        backgroundColor: '#0a0a0f',
        cacheBust: true,
      });

      if (abortRef.current) return;

      setPreviewUrl(dataUrl);
      setStep('done');
    } catch (err) {
      if (abortRef.current) return;
      console.error('Export capture failed:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Capture failed');
      setStep('error');
    }
  }, [containerRef, quality]);

  const handleExport = useCallback(async () => {
    if (!containerRef.current) return;

    if (format === 'png') {
      setStep('generating');
      try {
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(containerRef.current, {
          pixelRatio: quality,
          backgroundColor: '#0a0a0f',
          cacheBust: true,
        });

        const link = document.createElement('a');
        link.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();

        toast.success('PNG exported successfully');
        setOpen(false);
        resetState();
      } catch (err) {
        console.error('PNG export failed:', err);
        toast.error('PNG export failed. Try again.');
        setStep('idle');
      }
    } else {
      setStep('generating');
      try {
        const { toPng } = await import('html-to-image');
        const { default: jsPDF } = await import('jspdf');

        const dataUrl = await toPng(containerRef.current, {
          pixelRatio: quality,
          backgroundColor: '#0a0a0f',
          cacheBust: true,
        });

        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = dataUrl;
        });

        const imgWidth = img.width;
        const imgHeight = img.height;

        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const margin = 40;
        const contentWidth = pageWidth - margin * 2;
        const contentHeight = pageHeight - margin * 2 - 60;

        const scale = contentWidth / imgWidth;
        const scaledHeight = imgHeight * scale;

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: 'a4',
        });

        // Header
        pdf.setFillColor(10, 10, 15);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');

        pdf.setFontSize(16);
        pdf.setTextColor(220, 220, 220);
        pdf.text(title, margin, margin);

        pdf.setFontSize(9);
        pdf.setTextColor(140, 140, 140);
        const timestamp = new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        pdf.text(`Generated: ${timestamp}`, margin, margin + 20);
        pdf.text(
          `Scope: ${scope === 'current' ? 'Current Tab' : 'Full Dashboard'}`,
          margin + 200,
          margin + 20,
        );

        // Slice image into pages
        const canvas = document.createElement('canvas');
        canvas.width = imgWidth;
        const sliceHeight = Math.floor(contentHeight / scale);
        let sourceY = 0;
        let remainingHeight = scaledHeight;
        let pageNum = 1;

        while (remainingHeight > 0) {
          const thisSliceHeight = Math.min(sliceHeight, Math.ceil(remainingHeight));
          canvas.height = thisSliceHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) break;
          ctx.fillStyle = '#0a0a0f';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(
            img,
            0,
            sourceY,
            imgWidth,
            thisSliceHeight,
            0,
            0,
            imgWidth,
            thisSliceHeight,
          );

          const sliceUrl = canvas.toDataURL('image/png');

          if (pageNum > 1) {
            pdf.addPage();
            pdf.setFillColor(10, 10, 15);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
          }

          pdf.addImage(
            sliceUrl,
            'PNG',
            margin,
            margin + 40,
            contentWidth,
            thisSliceHeight * scale,
          );

          // Footer
          pdf.setFontSize(8);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 20, {
            align: 'center',
          });
          pdf.text('OmniVote Election Monitoring', pageWidth / 2, pageHeight - 10, {
            align: 'center',
          });

          sourceY += thisSliceHeight;
          remainingHeight -= thisSliceHeight;
          pageNum++;
        }

        pdf.save(
          `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
        );

        toast.success('PDF exported successfully');
        setOpen(false);
        resetState();
      } catch (err) {
        console.error('PDF export failed:', err);
        toast.error('PDF export failed. Try again.');
        setStep('idle');
      }
    }
  }, [containerRef, format, quality, title, scope, resetState]);

  const isProcessing = step === 'capturing' || step === 'generating';
  const sizeClasses = {
    sm: 'h-7 px-2.5 text-[10px]',
    default: 'h-8 px-3 text-xs',
    lg: 'h-9 px-4 text-sm',
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={cn('gap-1.5', sizeClasses[size], className)}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Export Dashboard</DialogTitle>
          <DialogDescription className="text-xs">
            Capture the current view as an image or PDF report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Format */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Format
            </label>
            <div className="flex gap-2 mt-1.5">
              <OptionBtn
                active={format === 'png'}
                onClick={() => {
                  setFormat('png');
                  setPreviewUrl(null);
                  setStep('idle');
                }}
                icon={ImageIcon}
              >
                PNG Image
              </OptionBtn>
              <OptionBtn
                active={format === 'pdf'}
                onClick={() => {
                  setFormat('pdf');
                  setPreviewUrl(null);
                  setStep('idle');
                }}
                icon={FileText}
              >
                PDF Report
              </OptionBtn>
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Scope
            </label>
            <div className="flex gap-2 mt-1.5">
              <OptionBtn
                active={scope === 'current'}
                onClick={() => setScope('current')}
                icon={Monitor}
              >
                Current Tab
              </OptionBtn>
              <OptionBtn
                active={scope === 'full'}
                onClick={() => setScope('full')}
                icon={Layers}
              >
                Full Dashboard
              </OptionBtn>
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Quality
            </label>
            <div className="flex gap-2 mt-1.5">
              <OptionBtn
                active={quality === 1}
                onClick={() => setQuality(1)}
                icon={Monitor}
              >
                Standard (1x)
              </OptionBtn>
              <OptionBtn
                active={quality === 2}
                onClick={() => setQuality(2)}
                icon={Monitor}
              >
                High (2x)
              </OptionBtn>
            </div>
          </div>

          {/* Preview / Progress / Error */}
          <AnimatePresence mode="wait">
            {step === 'capturing' && (
              <m.div
                key="capturing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-xs text-muted-foreground">Capturing dashboard...</p>
              </m.div>
            )}
            {step === 'generating' && (
              <m.div
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-xs text-muted-foreground">
                  Generating {format.toUpperCase()}...
                </p>
              </m.div>
            )}
            {step === 'error' && (
              <m.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-6"
              >
                <AlertCircle className="h-8 w-8 text-rose mb-2" />
                <p className="text-xs text-rose">{errorMessage || 'Export failed'}</p>
              </m.div>
            )}
            {step === 'done' && previewUrl && (
              <m.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Preview</p>
                <div className="relative rounded-lg border border-border/60 overflow-hidden bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Dashboard preview"
                    className="w-full h-auto max-h-[240px] object-contain"
                  />
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2">
          {(step === 'idle' || step === 'error') && (
            <Button
              variant="outline"
              size="sm"
              onClick={generatePreview}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Preview
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleExport}
            disabled={isProcessing || step === 'error'}
            className="gap-1.5 text-xs"
          >
            {isProcessing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            {step === 'done' ? 'Download' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
