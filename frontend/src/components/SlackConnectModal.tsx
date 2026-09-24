import React, { useState } from 'react';
import { Slack, Check, AlertCircle } from 'lucide-react';
import { connectSlackWebhookApi, disconnectSlackApi } from '../services/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useToast } from './ui/Toast';

interface SlackConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  isConnected: boolean;
  existingWebhook?: string;
  onStatusUpdated: (connected: boolean) => void;
}

export const SlackConnectModal: React.FC<SlackConnectModalProps> = ({
  isOpen,
  onClose,
  userId,
  isConnected,
  existingWebhook = '',
  onStatusUpdated,
}) => {
  const [webhookUrl, setWebhookUrl] = useState(existingWebhook);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
      setError('Please enter a valid Slack Incoming Webhook URL (starts with https://hooks.slack.com/)');
      return;
    }

    setLoading(true);

    try {
      await connectSlackWebhookApi(userId, webhookUrl);
      showToast('Slack webhook connected successfully! Test alert sent.', 'success', 'Slack Integration');
      onStatusUpdated(true);
      onClose();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.message || 'Failed to connect Slack webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await disconnectSlackApi(userId);
      showToast('Slack notifications disconnected.', 'info');
      onStatusUpdated(false);
      onClose();
    } catch {
      setError('Failed to disconnect Slack');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title={
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Slack className="w-3.5 h-3.5" />
          </div>
          <span>Connect Slack Notifications</span>
        </div>
      }
    >
      <form onSubmit={handleSaveWebhook} className="space-y-4 text-xs">
        <p className="text-slate-300">
          Receive instant live notifications in your Slack channel whenever a sender account hits its hourly rate limit cap.
        </p>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center space-x-2 text-rose-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Slack Incoming Webhook URL"
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
          error={error || undefined}
        />

        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-300">Quick Setup Guide:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Open Slack API &gt; Incoming Webhooks</li>
            <li>Enable Incoming Webhooks and click &quot;Add New Webhook to Workspace&quot;</li>
            <li>Copy the generated Webhook URL and paste it above</li>
          </ol>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          {isConnected ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDisconnect}
              isLoading={loading}
            >
              Disconnect
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={loading}
              icon={<Check className="w-3.5 h-3.5" />}
            >
              Save &amp; Test Webhook
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
