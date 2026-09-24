import React, { useState, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { User, EmailJob, EmailStats } from './types';
import {
  loginWithGoogle,
  getEmailsApi,
  getStatsApi,
  searchEmailsApi,
  getSlackStatusApi,
} from './services/api';

import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { ComposeModal } from './components/ComposeModal';
import { EmailTable } from './components/EmailTable';
import { SlackConnectModal } from './components/SlackConnectModal';

import { ToastProvider, useToast } from './components/ui/Toast';
import { Button } from './components/ui/Button';
import { Tabs } from './components/ui/Tabs';
import { Plus, Mail, Sparkles, CheckCircle2, Shield } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id.apps.googleusercontent.com';

export function AppContent() {
  const { showToast } = useToast();

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('reachinbox_user');
    return saved ? JSON.parse(saved) : null;
  });

  type TabType = 'ALL' | 'SCHEDULED' | 'SENT' | 'RATE_LIMITED';
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [emails, setEmails] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchSource, setSearchSource] = useState<'elasticsearch' | 'database'>('database');

  // Modal States
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);

  // Auto-Login Demo default if no user stored
  const handleDemoLogin = useCallback(async () => {
    try {
      const res = await loginWithGoogle(undefined, {
        email: 'intern.demo@reachinbox.ai',
        name: 'ReachInbox Demo Account',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      });
      setUser(res.user);
      localStorage.setItem('reachinbox_user', JSON.stringify(res.user));
      showToast('Logged in as Demo User', 'info');
    } catch (e) {
      console.error('Demo login error:', e);
      showToast('Failed to initialize demo login session', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    if (!user) {
      handleDemoLogin();
    }
  }, [user, handleDemoLogin]);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;
    try {
      const res = await loginWithGoogle(credentialResponse.credential);
      setUser(res.user);
      localStorage.setItem('reachinbox_user', JSON.stringify(res.user));
      showToast(`Welcome back, ${res.user.name}`, 'success');
    } catch (err) {
      console.error('Google OAuth Login error:', err);
      showToast('Google authentication failed', 'error');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('reachinbox_user');
    showToast('Signed out successfully', 'info');
  };

  // Load Emails & Stats
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const statsRes = await getStatsApi(user.id);
      setStats(statsRes.stats);

      const slackRes = await getSlackStatusApi(user.id);
      setSlackConnected(slackRes.isConnected);

      if (searchQuery.trim().length > 0) {
        const searchRes = await searchEmailsApi(user.id, searchQuery, activeTab);
        setEmails(searchRes.emails);
        setTotalCount(searchRes.total);
        setSearchSource(searchRes.source);
      } else {
        const emailRes = await getEmailsApi(user.id, activeTab);
        setEmails(emailRes.emails);
        setTotalCount(emailRes.total);
        setSearchSource('database');
      }
    } catch (err: unknown) {
      console.error('Failed to load dashboard data:', err);
      showToast('Could not sync email jobs queue status', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, activeTab, searchQuery, showToast]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100">
        <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl text-center space-y-6">
          <div className="w-12 h-12 rounded-lg bg-indigo-600 mx-auto flex items-center justify-center text-white shadow-sm">
            <Mail className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">ReachInbox Scheduler</h1>
            <p className="text-xs text-slate-400 mt-1">
              Production-Grade Email Job Queue & Throttling Dashboard
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-lg border border-slate-850 text-xs text-slate-300 space-y-2 text-left">
            <p className="font-semibold text-indigo-400 flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Core Architecture Highlights</span>
            </p>
            <ul className="space-y-1.5 text-slate-400 list-disc list-inside text-[11px]">
              <li>BullMQ + Redis Delayed Job Dispatching</li>
              <li>Elasticsearch Full-Text Search Engine</li>
              <li>Fake SMTP Ethereal Mail Preview Links</li>
              <li>Sender Rate Limiting & Slack Webhook Alerts</li>
            </ul>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => showToast('Google login failed', 'error')}
                useOneTap
              />
            </div>

            <p className="text-[11px] text-slate-500 font-mono">OR</p>

            <Button
              variant="primary"
              onClick={handleDemoLogin}
              className="w-full py-2.5"
              icon={<Sparkles className="w-4 h-4" />}
            >
              Continue with Instant Demo Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const tabsConfig: { id: TabType; label: string; count?: number }[] = [
    { id: 'ALL', label: 'All Jobs', count: stats?.total },
    { id: 'SCHEDULED', label: 'Scheduled', count: stats?.scheduled },
    { id: 'SENT', label: 'Sent', count: stats?.sent },
    { id: 'RATE_LIMITED', label: 'Rate Limited', count: stats?.rateLimited },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Header */}
      <Header
        user={user}
        onLogout={handleLogout}
        onOpenSlackModal={() => setIsSlackModalOpen(true)}
        slackConnected={slackConnected}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Page Banner / Title & Main CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2 border-b border-slate-850">
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Email Scheduler Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitor BullMQ Queues, Schedule Bulk Campaigns & Manage Hourly Rate Limits
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsComposeOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Compose New Email
          </Button>
        </div>

        {/* Slim Stats Strip */}
        <StatsCards
          stats={stats}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as TabType)}
        />

        {/* Main Content Area */}
        <div className="space-y-3 pt-2">
          {/* Reusable Tabs Component */}
          <Tabs<TabType>
            tabs={tabsConfig}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab)}
          />

          {/* Email Table */}
          <EmailTable
            emails={emails}
            loading={loading}
            totalCount={totalCount}
            activeTab={activeTab}
            onRefresh={loadData}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchSource={searchSource}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-[11px] text-slate-500 font-mono">
        ReachInbox Scheduler Engine • Express.js, BullMQ, Redis, PostgreSQL, Ethereal SMTP &amp; Elasticsearch
      </footer>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        user={user}
        onSuccess={() => {
          showToast('Email job(s) scheduled successfully!', 'success');
          loadData();
        }}
      />

      <SlackConnectModal
        isOpen={isSlackModalOpen}
        onClose={() => setIsSlackModalOpen(false)}
        userId={user.id}
        isConnected={slackConnected}
        onStatusUpdated={setSlackConnected}
      />
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </GoogleOAuthProvider>
  );
}
