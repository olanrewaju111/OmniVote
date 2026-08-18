'use client';

import React, { useState, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSound } from '@/hooks/use-sound';
import { cn } from '@/lib/utils';

export const SoundToggle = React.memo(function SoundToggle() {
  const { toggleSound, isSoundEnabled, play } = useSound();
  const [enabled, setEnabled] = useState(isSoundEnabled);

  const handleToggle = useCallback(() => {
    const newState = toggleSound();
    setEnabled(newState);
    if (newState) play('click');
  }, [toggleSound, play]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 text-muted-foreground/50 hover:text-foreground transition-colors',
            !enabled && 'text-muted-foreground/30'
          )}
          onClick={handleToggle}
          aria-label={enabled ? 'Mute sounds' : 'Enable sounds'}
        >
          {enabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {enabled ? 'Sound on — click to mute' : 'Sound off — click to enable'}
      </TooltipContent>
    </Tooltip>
  );
});
