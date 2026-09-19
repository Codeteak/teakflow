import { useEffect, useState, type FormEvent } from 'react';
import { DEFAULT_COMPANY_SETTINGS, type CompanySettings } from '@teakflow/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBanner, PageLoading } from '@/components/ui/page-state';
import { Input } from '@/components/ui/input';
import {
  getSettingsRequest,
  updateDailyWorkWindowRequest,
} from '@/features/settings/api';
import { formatClockLabel } from '@/lib/formatClock';

const empty: CompanySettings = {
  companyName: DEFAULT_COMPANY_SETTINGS.companyName,
  timezone: DEFAULT_COMPANY_SETTINGS.timezone,
  dailyWork: { ...DEFAULT_COMPANY_SETTINGS.dailyWork },
  googleConnected: false,
  googleConnectedEmail: null,
};

export function DailyWorkSettingsPage() {
  const [form, setForm] = useState<CompanySettings>(empty);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettingsRequest()
      .then((settings) => {
        if (!cancelled) {
          setForm(settings);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Unable to load settings.');
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
  }, []);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaved(false);
    setPending(true);
    try {
      const settings = await updateDailyWorkWindowRequest({
        startTime: form.dailyWork.startTime,
        endTime: form.dailyWork.endTime,
        minCharacters: form.dailyWork.minCharacters,
        maxCharacters: form.dailyWork.maxCharacters,
        allowLateSubmission: form.dailyWork.allowLateSubmission,
        reminderEnabled: form.dailyWork.reminderEnabled,
        reminderTime: form.dailyWork.reminderTime,
        timezone: form.timezone,
      });
      setForm(settings);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save settings.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Daily Work Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Window, length, late submissions, and reminders. Times use the company timezone.
        </p>
      </header>

      <Card>
        {loading ? (
          <PageLoading rows={2} className="p-1" />
        ) : (
          <form className="space-y-4" onSubmit={onSave}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Timezone</span>
                <Input
                  value={form.timezone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, timezone: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Reminder time</span>
                <Input
                  type="time"
                  value={form.dailyWork.reminderTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dailyWork: {
                        ...current.dailyWork,
                        reminderTime: event.target.value,
                      },
                    }))
                  }
                  required
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Submission start</span>
                <Input
                  type="time"
                  value={form.dailyWork.startTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dailyWork: { ...current.dailyWork, startTime: event.target.value },
                    }))
                  }
                  required
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Submission end</span>
                <Input
                  type="time"
                  value={form.dailyWork.endTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dailyWork: { ...current.dailyWork, endTime: event.target.value },
                    }))
                  }
                  required
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Minimum characters</span>
                <Input
                  type="number"
                  min={1}
                  value={form.dailyWork.minCharacters}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dailyWork: {
                        ...current.dailyWork,
                        minCharacters: Number(event.target.value),
                      },
                    }))
                  }
                  required
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.dailyWork.allowLateSubmission}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    dailyWork: {
                      ...current.dailyWork,
                      allowLateSubmission: event.target.checked,
                    },
                  }))
                }
              />
              Allow late submission
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.dailyWork.reminderEnabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    dailyWork: {
                      ...current.dailyWork,
                      reminderEnabled: event.target.checked,
                    },
                  }))
                }
              />
              Daily reminder if not submitted
            </label>
            <p className="text-sm text-muted">
              Window: {formatClockLabel(form.dailyWork.startTime)} –{' '}
              {formatClockLabel(form.dailyWork.endTime)}
            </p>
            {error ? <ErrorBanner message={error} /> : null}
            {saved ? <p className="text-sm text-sage">Saved.</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save settings'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
