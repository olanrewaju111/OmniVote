import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Switch } from './switch';
import { Label } from './label';

const meta: Meta<typeof Switch> = {
  title: 'UI/Switch',
  component: Switch,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="airplane-mode" />
      <Label htmlFor="airplane-mode">Airplane mode</Label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="wifi" defaultChecked />
      <Label htmlFor="wifi">Wi-Fi</Label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="bluetooth" disabled />
      <Label htmlFor="bluetooth" className="text-muted-foreground">Bluetooth (disabled)</Label>
    </div>
  ),
};

export const SettingsGroup: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Notifications</h3>
      <div className="space-y-3">
        {[
          { id: 'email-notif', label: 'Email notifications', checked: true },
          { id: 'push-notif', label: 'Push notifications', checked: true },
          { id: 'sms-notif', label: 'SMS alerts', checked: false },
          { id: 'sound', label: 'Sound effects', checked: true },
        ].map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor={item.id} className="cursor-pointer">{item.label}</Label>
            <Switch id={item.id} defaultChecked={item.checked} />
          </div>
        ))}
      </div>
    </div>
  ),
};
