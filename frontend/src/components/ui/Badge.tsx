import React from 'react';

export type StatusType = 'SCHEDULED' | 'SENT' | 'FAILED' | 'RATE_LIMITED' | 'PROCESSING';

export interface BadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, label, size = 'sm' }) => {
  const config = {
    SCHEDULED: {
      bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      dot: 'bg-amber-400',
      defaultLabel: 'Scheduled',
    },
    SENT: {
      bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      dot: 'bg-emerald-400',
      defaultLabel: 'Sent',
    },
    FAILED: {
      bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      dot: 'bg-rose-400',
      defaultLabel: 'Failed',
    },
    RATE_LIMITED: {
      bg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      dot: 'bg-purple-400',
      defaultLabel: 'Rate Limited',
    },
    PROCESSING: {
      bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      dot: 'bg-indigo-400 animate-pulse',
      defaultLabel: 'Sending...',
    },
  };

  const style = config[status] || config.SCHEDULED;
  const displayLabel = label || style.defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full font-medium ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${style.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
      <span>{displayLabel}</span>
    </span>
  );
};
