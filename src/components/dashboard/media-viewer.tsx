'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, X, Download, Maximize2,
  Image as ImageIcon, Video, FileAudio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type MediaFile = {
  url: string;
  type: 'image' | 'video' | 'audio';
};

interface MediaViewerProps {
  files: MediaFile[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
  title?: string;
}

function getMediaType(url: string): 'image' | 'video' | 'audio' {
  const lower = url.toLowerCase();
  if (/\.(mp4|mov|avi|webm|mkv)/.test(lower)) return 'video';
  if (/\.(mp3|ogg|wav|m4a|aac|webm)/.test(lower)) return 'audio';
  return 'image';
}

export function MediaViewer({ files, initialIndex = 0, open, onClose, title }: MediaViewerProps) {
  const [index, setIndex] = useState(initialIndex);

  // Reset index when files change or dialog opens
  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex, files.length]);

  const current = files[index];
  if (!current) return null;

  const mediaType = current.type || getMediaType(current.url);
  const hasPrev = index > 0;
  const hasNext = index < files.length - 1;

  const goPrev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex(i => Math.min(files.length - 1, i + 1)), [files.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, goPrev, goNext, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 gap-0 bg-background/95 backdrop-blur-xl border-border overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1.5">
              {mediaType === 'image' && <ImageIcon className="h-4 w-4 text-cyan" />}
              {mediaType === 'video' && <Video className="h-4 w-4 text-violet" />}
              {mediaType === 'audio' && <FileAudio className="h-4 w-4 text-amber" />}
            </span>
            <span className="text-xs font-medium truncate">
              {title || `Media ${index + 1} of ${files.length}`}
            </span>
            <Badge variant="outline" className="text-[9px] h-4 shrink-0">
              {mediaType.toUpperCase()}
            </Badge>
            <Badge variant="secondary" className="text-[9px] h-4 shrink-0">
              {index + 1} / {files.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
              <a href={current.url} target="_blank" rel="noopener noreferrer" download>
                <Download className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
              <a href={current.url} target="_blank" rel="noopener noreferrer">
                <Maximize2 className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Media area */}
        <div className="relative flex items-center justify-center bg-black/40 min-h-[300px] max-h-[75vh]">
          {/* Previous button */}
          {hasPrev && (
            <button
              onClick={goPrev}
              className="absolute left-2 z-10 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          {/* Media content */}
          <div className="w-full h-full flex items-center justify-center p-4">
            {mediaType === 'image' && (
              <img
                src={current.url}
                alt={title || `Image ${index + 1}`}
                className="max-w-full max-h-[70vh] object-contain rounded-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                  (e.target as HTMLImageElement).alt = 'Failed to load image';
                  (e.target as HTMLImageElement).className = 'text-muted-foreground text-sm p-8';
                }}
              />
            )}

            {mediaType === 'video' && (
              <video
                src={current.url}
                controls
                autoPlay
                className="max-w-full max-h-[70vh] rounded-md"
                preload="metadata"
              >
                Your browser does not support the video element.
              </video>
            )}

            {mediaType === 'audio' && (
              <div className="flex flex-col items-center gap-4 py-8 w-full max-w-md">
                <div className="w-24 h-24 rounded-full bg-amber/10 flex items-center justify-center">
                  <FileAudio className="h-10 w-10 text-amber" />
                </div>
                <p className="text-xs text-muted-foreground">Audio Recording</p>
                <audio
                  src={current.url}
                  controls
                  autoPlay
                  className="w-full"
                  preload="metadata"
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>

          {/* Next button */}
          {hasNext && (
            <button
              onClick={goNext}
              className="absolute right-2 z-10 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Thumbnail strip */}
        {files.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border shrink-0 overflow-x-auto">
            {files.map((f, i) => {
              const t = f.type || getMediaType(f.url);
              const isActive = i === index;
              return (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'shrink-0 w-12 h-12 rounded-md border-2 overflow-hidden flex items-center justify-center transition-all',
                    isActive ? 'border-emerald scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                  )}
                >
                  {t === 'image' ? (
                    <img src={f.url} alt="" className="w-full h-full object-cover" />
                  ) : t === 'video' ? (
                    <div className="w-full h-full bg-violet/20 flex items-center justify-center">
                      <Video className="h-4 w-4 text-violet" />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-amber/20 flex items-center justify-center">
                      <FileAudio className="h-4 w-4 text-amber" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline Media Thumbnail (for embedding in cards) ──────────────────

interface MediaThumbnailStripProps {
  mediaUrls: string[];
  onOpen: (index: number) => void;
  maxShow?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function MediaThumbnailStrip({ mediaUrls, onOpen, maxShow = 4, size = 'sm' }: MediaThumbnailStripProps) {
  if (!mediaUrls || mediaUrls.length === 0) return null;

  const sizeClasses = {
    sm: 'w-14 h-14',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  const visible = mediaUrls.slice(0, maxShow);
  const remaining = mediaUrls.length - maxShow;

  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {visible.map((url, i) => {
        const type = getMediaType(url);
        return (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); onOpen(i); }}
            className={cn(
              'rounded-md overflow-hidden border border-border shrink-0 bg-muted hover:border-emerald/50 transition-colors cursor-pointer',
              sizeClasses[size]
            )}
          >
            {type === 'image' ? (
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : type === 'video' ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-violet/10 text-violet">
                <Video className="h-4 w-4" />
                <span className="text-[8px] mt-0.5">VIDEO</span>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-amber/10 text-amber">
                <FileAudio className="h-4 w-4" />
                <span className="text-[8px] mt-0.5">AUDIO</span>
              </div>
            )}
          </button>
        );
      })}
      {remaining > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(maxShow); }}
          className={cn(
            'rounded-md border border-border shrink-0 bg-muted flex items-center justify-center text-[11px] text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer',
            sizeClasses[size]
          )}
        >
          +{remaining}
        </button>
      )}
    </div>
  );
}