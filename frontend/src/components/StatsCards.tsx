import React from 'react';
import { EmailStats } from '../types';

interface StatsCardsProps {
  stats: EmailStats | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, activeTab, onTabChange }) => {
  const statItems = [
    {
      id: 'ALL',
      label: 'Total Jobs',
      value: stats?.total ?? 0,
      dotColor: 'bg-indigo-400',
    },
    {
      id: 'SCHEDULED',
      label: 'Scheduled',
      value: stats?.scheduled ?? 0,
      dotColor: 'bg-amber-400',
    },
    {
      id: 'SENT',
      label: 'Sent',
      value: stats?.sent ?? 0,
      dotColor: 'bg-emerald-400',
    },
    {
      id: 'FAILED',
      label: 'Failed',
      value: stats?.failed ?? 0,
      dotColor: 'bg-rose-400',
    },
    {
      id: 'RATE_LIMITED',
      label: 'Rate Limited',
      value: stats?.rateLimited ?? 0,
      dotColor: 'bg-purple-400',
    },
  ];

  return (
    <div className="w-full bg-slate-900/70 border border-slate-800 rounded-lg p-2 flex flex-wrap items-center justify-between gap-2 shadow-sm text-xs">
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        {statItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-md transition-all ${
                isActive
                  ? 'bg-slate-800 text-slate-100 border border-slate-700/80 shadow-sm font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${item.dotColor}`} />
              <span className="text-slate-300 font-medium">{item.label}</span>
              <span
                className={`font-mono text-[11px] px-1.5 py-0.2 rounded font-semibold ${
                  isActive ? 'bg-slate-700 text-white' : 'bg-slate-800/80 text-slate-400'
                }`}
              >
                {item.value}
              </span>
            </button>
          );
        })}
      </div>

      <div className="hidden lg:flex items-center space-x-2 pr-2 text-[11px] text-slate-400 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>Queue Engine Active</span>
      </div>
    </div>
  );
};
