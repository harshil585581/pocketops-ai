import { useState, type ReactNode } from 'react';
import {
  Check,
  CircleSlash,
  Cloud,
  Cpu,
  Download,
  Laptop,
  Loader2,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Smartphone,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { RoutingMatrix } from '../components/RoutingMatrix';
import { EngineStatus } from '../components/Shell';
import { Segmented, StatusDot, cx } from '../components/ui';
import { cloudLabel, LOCAL_MODEL } from '../engine';
import { browserInfo } from '../engine/chromeAI';
import { signInWithGoogle, signOutOfSync, useSync } from '../lib/sync';
import { useToast } from '../state/toast';
import type { EngineMode } from '../lib/types';
import { useEngine } from '../state/engine';
import { usePwa } from '../state/pwa';
import { useTheme, type ThemePref } from '../state/theme';

const MODES: { value: EngineMode; title: string; body: string; icon: typeof Cpu }[] = [
  { value: 'auto', title: 'Automatic', body: 'Prefer on-device. Use cloud Gemini when Nano isn’t available.', icon: RefreshCw },
  { value: 'local-only', title: 'On-device only', body: 'Never send problems to the cloud. Requires Gemini Nano.', icon: Cpu },
  { value: 'cloud-only', title: 'Cloud only', body: 'Always use the more capable cloud model. Requires internet.', icon: Cloud },
];


export default function Settings() {
  const engine = useEngine();
  const { theme, setTheme } = useTheme();
  const pwa = usePwa();
  const info = browserInfo();
  const { local, online, downloadProgress } = engine;

  const localTone = local === 'available' ? 'local' : local === 'downloading' || local === 'downloadable' ? 'warn' : 'muted';


  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-12">
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] sm:text-[34px]">Settings</h1>
        <p className="mt-1.5 max-w-xl text-[14.5px] text-ink-2">
          AI engine, on-device setup, sync and app preferences.
        </p>
      </header>

      {/* Live readouts */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Readout
          label="Network"
          icon={online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
          value={online ? 'Online' : 'Offline'}
          tone={online ? 'local' : 'danger'}
          detail={online ? 'Cloud inference reachable' : 'Only on-device AI and saved guidance'}
        />
        <Readout
          label="On-device"
          icon={<Cpu className="size-4" />}
          value={local === 'available' ? 'Ready' : local === 'downloading' ? 'Downloading' : local === 'downloadable' ? 'Not downloaded' : 'Unavailable'}
          tone={localTone}
          detail={`${LOCAL_MODEL} · Chrome built-in AI`}
          loading={engine.checking}
        />
        <Readout
          label="Cloud"
          icon={<Cloud className="size-4" />}
          value={!engine.cloudConfigured ? 'Not configured' : !online ? 'Unreachable' : 'Available'}
          tone={!engine.cloudConfigured ? 'danger' : !online ? 'muted' : 'cloud'}
          detail={engine.cloudConfigured ? `${cloudLabel()} · Firebase AI Logic` : 'Add your Firebase web config to .env'}
        />
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          {/* Live status first on mobile (desktop shows it at the top of the right column) */}
          <div className="lg:hidden">
            <EngineStatus static />
          </div>

          {/* Mode */}
          <Section title="Routing preference" desc="Choose how PocketOps picks an AI engine for each request.">
            <div className="grid gap-2.5 sm:grid-cols-3" role="radiogroup">
              {MODES.map((m) => {
                const on = engine.mode === m.value;
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    role="radio"
                    aria-checked={on}
                    onClick={() => engine.setMode(m.value)}
                    className={cx(
                      'relative rounded-2xl border p-4 text-left transition duration-200',
                      on ? 'border-ink bg-surface shadow-card' : 'border-line bg-surface/50 hover:border-line-strong hover:bg-surface',
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className={cx('grid size-8 place-items-center rounded-lg', on ? 'bg-ink text-canvas' : 'bg-surface-2 text-ink-2')}>
                        <Icon className="size-4" />
                      </span>
                      <span className={cx('grid size-4.5 place-items-center rounded-full border-[1.5px] transition', on ? 'border-ink bg-ink' : 'border-line-strong')}>
                        {on && <span className="size-1.5 rounded-full bg-canvas" />}
                      </span>
                    </div>
                    <p className="text-[14px] font-medium">{m.title}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{m.body}</p>
                  </button>
                );
              })}
            </div>
            <p
              className={cx(
                'mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px]',
                engine.route.target === 'none' ? 'bg-danger/8 text-danger' : 'bg-surface-2 text-ink-2',
              )}
            >
              <StatusDot
                tone={engine.route.target === 'on-device' ? 'local' : engine.route.target === 'cloud' ? 'cloud' : 'danger'}
                pulse={engine.route.target !== 'none'}
              />
              {engine.route.reason}
            </p>
          </Section>

          {/* App */}
          <Section title="App" desc="On-device AI, your account, appearance and installation.">
            <div className="card divide-y divide-line">
              <Row
                label="Gemini Nano"
                hint={
                  downloadProgress !== null
                    ? 'Downloading the on-device model — keep this tab open.'
                    : local === 'available'
                      ? 'Ready — diagnoses and follow-ups work on this device, even offline.'
                      : local === 'downloadable' || local === 'downloading'
                        ? online
                          ? 'One-time download (about 4 GB) to enable offline AI.'
                          : 'Connect to the internet to download the model.'
                        : 'Not available on this device — PocketOps uses cloud Gemini when online.'
                }
              >
                {downloadProgress !== null ? (
                  <span className="flex items-center gap-1.5 font-mono text-[13px] text-local tabular-nums">
                    <Loader2 className="size-3.5 animate-spin" /> {Math.round(downloadProgress * 100)}%
                  </span>
                ) : local === 'available' ? (
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-local">
                      <Check className="size-4" /> Ready
                    </span>
                    <button onClick={engine.refresh} aria-label="Re-check" title="Re-check" className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
                      <RefreshCw className={cx('size-3.5', engine.checking && 'animate-spin')} />
                    </button>
                  </span>
                ) : local === 'downloadable' || local === 'downloading' ? (
                  <button onClick={engine.download} disabled={!online} className="btn-primary h-8 text-[13px]">
                    <Download className="size-3.5" /> {local === 'downloading' ? 'Resume' : 'Download'}
                  </button>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
                      <CircleSlash className="size-3.5" /> Unavailable
                    </span>
                    <button onClick={engine.refresh} aria-label="Re-check" title="Re-check" className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
                      <RefreshCw className={cx('size-3.5', engine.checking && 'animate-spin')} />
                    </button>
                  </span>
                )}
              </Row>
              <AccountRow />
              <Row label="Appearance" hint="Match your system or pick a theme.">
                <Segmented<ThemePref>
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: 'system', label: <Monitor className="size-3.5" aria-label="System" /> },
                    { value: 'light', label: <Sun className="size-3.5" aria-label="Light" /> },
                    { value: 'dark', label: <Moon className="size-3.5" aria-label="Dark" /> },
                  ]}
                />
              </Row>
              <Row
                label="Install PocketOps"
                hint={pwa.installed ? 'Installed — runs in its own window.' : 'Add to your home screen or desktop for an app-like experience.'}
              >
                {pwa.installed ? (
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-local">
                    <Check className="size-4" /> Installed
                  </span>
                ) : pwa.canInstall ? (
                  <button onClick={pwa.install} className="btn-primary h-8 text-[13px]">
                    <Download className="size-3.5" /> Install
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                    {info.desktop ? <Laptop className="size-3.5" /> : <Smartphone className="size-3.5" />}
                    Use browser menu → Install
                  </span>
                )}
              </Row>
              <Row label="Offline app shell" hint="Interface cached by the service worker.">
                <span className={cx('flex items-center gap-1.5 text-[13px] font-medium', pwa.offlineReady ? 'text-local' : 'text-ink-3')}>
                  <StatusDot tone={pwa.offlineReady ? 'local' : 'muted'} />
                  {pwa.offlineReady ? 'Cached' : import.meta.env.DEV ? 'Disabled in dev' : 'Preparing'}
                </span>
              </Row>
            </div>
          </Section>
        </div>

        <aside className="space-y-4">
          <div className="hidden lg:block">
            <EngineStatus static />
          </div>
          <RoutingMatrix />
        </aside>
      </div>

    </div>
  );
}

function Readout({
  label,
  icon,
  value,
  tone,
  detail,
  loading,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  tone: 'local' | 'cloud' | 'warn' | 'danger' | 'muted';
  detail: string;
  loading?: boolean;
}) {
  const color = { local: 'text-local', cloud: 'text-cloud', warn: 'text-warn', danger: 'text-danger', muted: 'text-ink-3' }[tone];
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="label">{label}</span>
        <span className={cx('grid size-7 place-items-center rounded-lg bg-surface-2', color)}>{icon}</span>
      </div>
      <p className="flex items-center gap-2 text-[19px] font-semibold tracking-tight">
        {loading ? <span className="skeleton h-5 w-24" /> : (
          <>
            <StatusDot tone={tone} pulse={tone === 'local' || tone === 'cloud'} />
            {value}
          </>
        )}
      </p>
      <p className="mt-1 truncate text-[12.5px] text-ink-3">{detail}</p>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 mb-3.5 text-[13.5px] text-ink-3">{desc}</p>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium">{label}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-3">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function AccountRow() {
  const sync = useSync();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const google = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      push({ tone: 'error', title: 'Sign-in failed', body: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const syncText =
    sync.status === 'error'
      ? sync.error
      : { disabled: 'Sync not configured.', connecting: 'Connecting…', syncing: 'Syncing…', synced: 'Synced with Cloud Firestore.', offline: 'Offline — changes will sync later.' }[
          sync.status as Exclude<typeof sync.status, 'error'>
        ];
  return (
    <Row
      label={sync.uid ? (sync.isAnonymous ? 'Anonymous account' : sync.email || 'Google account') : 'Account'}
      hint={`${sync.uid && sync.isAnonymous ? 'Backed up for this browser. Sign in to sync across devices. ' : ''}${syncText ?? ''}`}
    >
      {sync.uid &&
        (sync.isAnonymous ? (
          <button onClick={google} disabled={busy || sync.status === 'offline'} className="btn-primary h-8 text-[13px]">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3.5" />} Sign in with Google
          </button>
        ) : (
          <button onClick={() => signOutOfSync()} className="btn-secondary h-8 text-[13px]">
            <LogOut className="size-3.5" /> Sign out
          </button>
        ))}
    </Row>
  );
}
