import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, Send, Clock, AlertCircle, FileText, Sliders, CheckCircle2 } from 'lucide-react';
import { scheduleEmailsApi } from '../services/api';
import { User } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Textarea } from './ui/Input';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  user,
  onSuccess,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manualRecipients, setManualRecipients] = useState('');
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // Validation errors state
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);

  // Scheduler parameters
  const [scheduledAt, setScheduledAt] = useState<string>(
    new Date(Date.now() + 60000).toISOString().slice(0, 16)
  );
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle CSV / Text file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setRecipientsError(null);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        complete: (results: Papa.ParseResult<unknown>) => {
          const extracted: string[] = [];
          results.data.forEach((row: unknown) => {
            const rowStr = Array.isArray(row) ? row.join(' ') : JSON.stringify(row);
            const matches = rowStr.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
            if (matches) {
              extracted.push(...matches);
            }
          });
          const unique = Array.from(new Set(extracted));
          setParsedEmails(unique);
        },
        error: (err: Error) => {
          setRecipientsError(`Failed to parse CSV file: ${err.message}`);
        },
      });
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        const matches = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi) || [];
        const unique = Array.from(new Set(matches));
        setParsedEmails(unique);
      };
      reader.readAsText(file);
    }
  };

  // Combine CSV uploaded emails + manual textarea input
  const getCombinedRecipients = (): string[] => {
    const manualList = manualRecipients
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));
    return Array.from(new Set([...parsedEmails, ...manualList]));
  };

  const validateForm = (): boolean => {
    let isValid = true;
    setSubjectError(null);
    setBodyError(null);
    setRecipientsError(null);
    setGeneralError(null);

    const recipients = getCombinedRecipients();
    if (recipients.length === 0) {
      setRecipientsError('Please provide at least one recipient email address (via CSV upload or manual text entry)');
      isValid = false;
    }

    if (!subject.trim()) {
      setSubjectError('Subject line is required');
      isValid = false;
    }

    if (!body.trim()) {
      setBodyError('Email body content is required');
      isValid = false;
    }

    return isValid;
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const recipients = getCombinedRecipients();
    setLoading(true);

    try {
      await scheduleEmailsApi({
        userId: user.id,
        recipients,
        subject,
        body,
        scheduledAt: new Date(scheduledAt).toISOString(),
        delaySeconds: Number(delaySeconds),
        hourlyLimit: Number(hourlyLimit),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      setGeneralError(
        errorObj.response?.data?.error || errorObj.message || 'Failed to schedule emails'
      );
    } finally {
      setLoading(false);
    }
  };

  const totalRecipientsCount = getCombinedRecipients().length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Send className="w-3.5 h-3.5" />
          </div>
          <span>Compose &amp; Schedule Outreach</span>
        </div>
      }
    >
      <form onSubmit={handleScheduleSubmit} className="space-y-6">
        {generalError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center space-x-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* SECTION 1: Email Content */}
        <div className="space-y-4">
          <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              1. Email Content &amp; Recipients
            </span>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              {totalRecipientsCount} Detected Lead(s)
            </span>
          </div>

          {/* CSV / Text File Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Upload Lead CSV or Text File
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-slate-700 hover:border-indigo-500/60 rounded-lg p-3.5 text-center bg-slate-900/40 hover:bg-slate-850/60 transition-all cursor-pointer group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.txt"
                className="hidden"
              />
              <div className="flex items-center justify-center space-x-3">
                <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                <div className="text-left">
                  <p className="text-xs text-slate-300">
                    <span className="font-semibold text-indigo-400">Click to browse</span> or drag CSV / TXT file
                  </p>
                  {fileName ? (
                    <p className="text-[11px] font-mono text-emerald-400 mt-0.5 flex items-center space-x-1">
                      <FileText className="w-3 h-3" />
                      <span>{fileName}</span>
                      <span className="text-slate-400">({parsedEmails.length} emails parsed)</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500">Supports .csv or line-by-line emails</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Manual Recipients Textarea */}
          <Textarea
            label="Additional Recipients (Comma or line-separated)"
            placeholder="e.g. lead1@company.com, lead2@startup.io..."
            rows={2}
            value={manualRecipients}
            onChange={(e) => {
              setManualRecipients(e.target.value);
              setRecipientsError(null);
            }}
            error={recipientsError || undefined}
          />

          {/* Subject Input */}
          <Input
            label="Subject Line"
            placeholder="e.g. Quick intro - ReachInbox Scheduler"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setSubjectError(null);
            }}
            error={subjectError || undefined}
          />

          {/* Body Content */}
          <Textarea
            label="Email Body Copy"
            placeholder="Write your email body copy here..."
            rows={4}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setBodyError(null);
            }}
            error={bodyError || undefined}
          />
        </div>

        {/* SECTION 2: Schedule & Queue Throttling Settings */}
        <div className="space-y-4 pt-2">
          <div className="border-b border-slate-800 pb-1.5 flex items-center space-x-2">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              2. Schedule &amp; Queue Settings
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Start Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 text-xs font-mono"
              />
            </div>

            {/* Delay Seconds */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Send Delay (seconds)
              </label>
              <input
                type="number"
                min="1"
                max="300"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 2)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 text-xs font-mono"
              />
            </div>

            {/* Hourly Limit Cap */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Hourly Limit / Sender
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 200)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
            disabled={totalRecipientsCount === 0}
            icon={<Clock className="w-4 h-4" />}
          >
            Schedule {totalRecipientsCount} Email(s)
          </Button>
        </div>
      </form>
    </Modal>
  );
};
