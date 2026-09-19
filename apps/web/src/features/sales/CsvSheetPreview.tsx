import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormModal } from '@/components/ui/form-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { parseCsvRows, saveTextFile } from '@/features/sales/csvPreview';

const PREVIEW_ROWS = 200;

export type CsvSheetSource = {
  title: string;
  filename: string;
  load: () => Promise<string>;
};

type Props = {
  source: CsvSheetSource | null;
  onClose: () => void;
};

export function CsvSheetPreview({ source, onClose }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!source) {
      setText('');
      setError('');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setText('');
    void source
      .load()
      .then((csv) => {
        if (!cancelled) {
          setText(csv);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Unable to load this sheet.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const rows = text ? parseCsvRows(text) : [];
  const header = rows[0] ?? [];
  const body = rows.slice(1, PREVIEW_ROWS + 1);
  const extra = Math.max(0, rows.length - 1 - PREVIEW_ROWS);

  return (
    <FormModal
      open={Boolean(source)}
      wide
      title={source?.title ?? 'Sheet preview'}
      description="Check the sheet, then download."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={loading || Boolean(error) || !text}
            onClick={() => {
              if (source && text) {
                saveTextFile(text, source.filename);
              }
            }}
          >
            Download
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading sheet">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      {!loading && !error && rows.length ? (
        <div className="space-y-2">
          <p className="font-mono text-xs text-muted">{source?.filename}</p>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-paper">
                <tr>
                  {header.map((cell, index) => (
                    <th
                      key={`${cell}-${index}`}
                      className="whitespace-nowrap border-b border-line px-2 py-2 font-medium"
                    >
                      {cell || '—'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-line last:border-0">
                    {header.map((_, colIndex) => (
                      <td
                        key={colIndex}
                        className="whitespace-nowrap px-2 py-1.5 align-top"
                      >
                        {row[colIndex] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {extra > 0 ? (
            <p className="text-xs text-muted">
              Showing the first {PREVIEW_ROWS} data rows. Download includes the full
              sheet.
            </p>
          ) : null}
        </div>
      ) : null}
      {!loading && !error && !rows.length ? (
        <p className="text-sm text-muted">This sheet is empty.</p>
      ) : null}
    </FormModal>
  );
}
