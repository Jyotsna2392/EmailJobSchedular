import React, { useState } from 'react';
import { EmailJob } from '../types';
import { Badge } from './ui/Badge';
import { Table, Column, TimeCell } from './ui/Table';
import { TableSkeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { ExternalLink, RefreshCw, Mail, Search, Info } from 'lucide-react';

interface EmailTableProps {
  emails: EmailJob[];
  loading: boolean;
  totalCount: number;
  activeTab: string;
  onRefresh: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchSource?: 'elasticsearch' | 'database';
  onOpenCompose?: () => void;
}

export const EmailTable: React.FC<EmailTableProps> = ({
  emails,
  loading,
  totalCount,
  activeTab,
  onRefresh,
  searchQuery,
  onSearchChange,
  searchSource,
  onOpenCompose,
}) => {
  const [selectedEmail, setSelectedEmail] = useState<EmailJob | null>(null);

  const columns: Column<EmailJob>[] = [
    {
      key: 'recipient',
      header: 'Recipient Lead',
      cell: (email) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-100">{email.recipient}</span>
          <span className="text-[10px] text-slate-400 font-mono">
            Sender: {email.senderAccount?.email || 'System Outbound'}
          </span>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Subject & Preview',
      cell: (email) => (
        <div className="max-w-xs sm:max-w-md truncate">
          <p className="font-medium text-slate-200 truncate">{email.subject}</p>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{email.body}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (email) => <Badge status={email.status} />,
    },
    {
      key: 'time',
      header: activeTab === 'SENT' ? 'Sent Time' : 'Scheduled Time',
      align: 'right',
      cell: (email) => (
        <TimeCell dateString={email.sentAt || email.scheduledAt} />
      ),
    },
    {
      key: 'actions',
      header: 'SMTP Log',
      align: 'right',
      cell: (email) => (
        <div className="flex justify-end">
          {email.etherealUrl ? (
            <a
              href={email.etherealUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[11px] font-mono transition-colors"
            >
              <span>View SMTP</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-[11px] text-slate-500 italic font-mono">Queued</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Search Toolbar & Refresh */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-lg">
        {/* Search Input with Elasticsearch Badge */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search leads, subject, or message..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md pl-8 pr-20 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
          />
          {searchSource && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono font-semibold uppercase px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {searchSource === 'elasticsearch' ? 'ES Engine' : 'DB Search'}
            </span>
          )}
        </div>

        {/* Status Count & Refresh */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-slate-400">
            Showing <strong className="text-slate-200 font-mono">{emails.length}</strong> of{' '}
            <span className="font-mono">{totalCount}</span> jobs
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            isLoading={loading}
            title="Refresh jobs"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Table / Skeleton / Empty State */}
      {loading && emails.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <TableSkeleton rows={5} />
        </div>
      ) : emails.length === 0 ? (
        <EmptyState
          icon={<Mail className="w-6 h-6 text-slate-400" />}
          title="No email jobs found"
          description={
            searchQuery
              ? 'No scheduled or sent emails matching your filter query.'
              : 'Start your email outreach by composing a new scheduled job.'
          }
          action={
            onOpenCompose ? (
              <Button variant="primary" size="sm" onClick={onOpenCompose}>
                Compose New Email
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table<EmailJob>
          columns={columns}
          data={emails}
          keyExtractor={(e) => e.id}
          onRowClick={(email) => setSelectedEmail(email)}
        />
      )}

      {/* Email Job Details Modal */}
      {selectedEmail && (
        <Modal
          isOpen={!!selectedEmail}
          onClose={() => setSelectedEmail(null)}
          maxWidth="lg"
          title={
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-indigo-400" />
              <span>Email Job Details</span>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-800">
              <div>
                <span className="text-slate-400 text-[11px] block">Job ID</span>
                <span className="font-mono text-slate-200 text-xs">{selectedEmail.id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Status</span>
                <div className="mt-1">
                  <Badge status={selectedEmail.status} />
                </div>
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-[11px] block">Recipient Lead</span>
              <p className="font-semibold text-slate-100 text-sm mt-0.5">{selectedEmail.recipient}</p>
            </div>

            <div>
              <span className="text-slate-400 text-[11px] block">Subject</span>
              <p className="font-medium text-slate-200 mt-0.5">{selectedEmail.subject}</p>
            </div>

            <div>
              <span className="text-slate-400 text-[11px] block">Message Body</span>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 mt-1 font-sans leading-relaxed whitespace-pre-wrap">
                {selectedEmail.body}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block">Scheduled Time</span>
                <TimeCell dateString={selectedEmail.scheduledAt} />
              </div>
              <div>
                <span className="text-slate-400 block">Sent Time</span>
                <TimeCell dateString={selectedEmail.sentAt} />
              </div>
            </div>

            {selectedEmail.errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
                <p className="font-semibold">Execution Log Error:</p>
                <p className="mt-1 font-mono">{selectedEmail.errorMessage}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
