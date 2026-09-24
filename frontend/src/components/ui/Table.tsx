import React from 'react';
import { formatDistanceToNow, format } from 'date-fns';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (item: T) => void;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyState,
  onRowClick,
}: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60 shadow-sm">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={`py-3 px-4 ${
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick && onRowClick(item)}
              className={`transition-colors ${
                onRowClick ? 'hover:bg-slate-800/50 cursor-pointer' : 'hover:bg-slate-800/30'
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-3 px-4 text-slate-300 ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  }`}
                >
                  {col.cell(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * TimeCell component renders relative time (e.g. "in 5 minutes", "2 hours ago")
 * with a native tooltip showing the exact absolute timestamp.
 */
export const TimeCell: React.FC<{ dateString?: string | null }> = ({ dateString }) => {
  if (!dateString) {
    return <span className="text-slate-500 font-mono text-[11px] italic">N/A</span>;
  }

  const date = new Date(dateString);
  const absoluteTime = format(date, 'MMM d, yyyy h:mm:ss a');
  const relativeTime = formatDistanceToNow(date, { addSuffix: true });

  return (
    <span
      title={absoluteTime}
      className="font-mono text-[11px] text-slate-400 hover:text-slate-200 cursor-help border-b border-dashed border-slate-700/60"
    >
      {relativeTime}
    </span>
  );
};
