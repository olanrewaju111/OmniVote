import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ConfirmDialog } from './confirm-dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const meta: Meta<typeof ConfirmDialog> = {
  title: 'Dashboard/Confirm Dialog',
  component: ConfirmDialog,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof ConfirmDialog>;

function DialogWrapper({ variant = 'default' }: { variant?: 'default' | 'destructive' }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button
        variant={variant === 'destructive' ? 'destructive' : 'outline'}
        onClick={() => setOpen(true)}
      >
        {variant === 'destructive' ? 'Delete Incident' : 'Acknowledge'}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={variant === 'destructive' ? 'Delete Incident' : 'Acknowledge Alert'}
        description={
          variant === 'destructive'
            ? 'This action cannot be undone. The incident and all associated evidence will be permanently removed.'
            : 'Are you sure you want to acknowledge this alert? It will be marked as reviewed.'
        }
        confirmLabel={variant === 'destructive' ? 'Delete' : 'Acknowledge'}
        onConfirm={() => setOpen(false)}
        variant={variant}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <DialogWrapper />,
};

export const Destructive: Story = {
  render: () => <DialogWrapper variant="destructive" />,
};
