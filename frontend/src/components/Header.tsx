import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { Mail, LogOut, Slack, Activity, ChevronDown, User as UserIcon } from 'lucide-react';
import { Button } from './ui/Button';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onOpenSlackModal: () => void;
  slackConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenSlackModal,
  slackConnected,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left Side: Logo & Workspace Title */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Mail className="w-4 h-4" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm text-slate-100 tracking-tight">ReachInbox</span>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
              Scheduler
            </span>
          </div>
        </div>

        {/* Right Side: Quick Links, Slack Toggle, & User Menu */}
        <div className="flex items-center space-x-3">
          {/* Live BullMQ Queue Link */}
          <a
            href="https://emailjobschedular.onrender.com/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs transition-colors"
            title="Open Live BullMQ Queue Dashboard"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>BullMQ Queues</span>
          </a>

          {/* Slack Status Button */}
          <button
            onClick={onOpenSlackModal}
            className={`inline-flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              slackConnected
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Slack className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {slackConnected ? 'Slack Alert Active' : 'Connect Slack'}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                slackConnected ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
          </button>

          {/* User Profile & Avatar Menu */}
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 p-1 rounded-lg hover:bg-slate-800/60 text-slate-300 transition-colors focus:outline-none"
              >
                <img
                  src={
                    user.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      user.name
                    )}&background=4f46e5&color=fff`
                  }
                  alt={user.name}
                  className="w-7 h-7 rounded-full border border-slate-700 object-cover"
                />
                <span className="hidden md:inline text-xs font-medium text-slate-200 max-w-[120px] truncate">
                  {user.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg bg-slate-900 border border-slate-800 shadow-xl py-1 z-50 animate-fadeIn text-xs">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="font-semibold text-slate-200 truncate">{user.name}</p>
                    <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenSlackModal();
                      }}
                      className="w-full text-left px-3 py-1.5 text-slate-300 hover:bg-slate-800 flex items-center space-x-2"
                    >
                      <Slack className="w-3.5 h-3.5 text-slate-400" />
                      <span>Notification Settings</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-800 py-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 flex items-center space-x-2 font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
