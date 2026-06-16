'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SUPPORTED_LANGUAGES } from '@bot/shared';
import { updateGuildSettings } from './actions';

interface InitialSettings {
  prefix: string;
  welcomeChannelId: string | null;
  logChannelId: string | null;
  language: string;
}

interface Props {
  guildId: string;
  initial: InitialSettings;
  channels: { id: string; name: string; type: 'text' | 'voice' | 'other' }[];
}

export function GuildSettingsForm({ guildId, initial, channels }: Props): React.JSX.Element {
  const router = useRouter();
  const [prefix, setPrefix] = useState(initial.prefix);
  const [welcome, setWelcome] = useState(initial.welcomeChannelId ?? '');
  const [log, setLog] = useState(initial.logChannelId ?? '');
  const [language, setLanguage] = useState(initial.language);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await updateGuildSettings({
        guildId,
        prefix: prefix.trim() || undefined,
        welcomeChannelId: welcome || null,
        logChannelId: log || null,
        language,
      });
      if (res.success && res.data) {
        setSuccess('Settings saved');
        router.refresh();
      } else {
        setError(res.error ?? 'Failed to save');
      }
    });
  }

  const textChannels = channels.filter((c) => c.type === 'text');

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Field label="Prefix" hint="1-8 characters. Used for legacy text commands.">
        <input
          type="text"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          maxLength={8}
          required
          className="w-32 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-900"
        />
      </Field>

      <Field label="Welcome channel" hint="New members will be greeted here.">
        <ChannelSelect
          value={welcome}
          onChange={setWelcome}
          channels={textChannels}
          allowNone
          noneLabel="(disabled)"
        />
      </Field>

      <Field label="Log channel" hint="Moderation and audit events are written here.">
        <ChannelSelect
          value={log}
          onChange={setLog}
          channels={textChannels}
          allowNone
          noneLabel="(disabled)"
        />
      </Field>

      <Field label="Language" hint="Used for localisable strings (best-effort).">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {success}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      {hint ? (
        <p className="mb-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

function ChannelSelect({
  value,
  onChange,
  channels,
  allowNone,
  noneLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  channels: { id: string; name: string }[];
  allowNone: boolean;
  noneLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
    >
      {allowNone ? <option value="">{noneLabel}</option> : null}
      {channels.map((c) => (
        <option key={c.id} value={c.id}>
          #{c.name}
        </option>
      ))}
    </select>
  );
}
