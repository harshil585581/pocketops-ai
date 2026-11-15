import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  CircleSlash,
  Cloud,
  Cpu,
  Download,
  Laptop,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Smartphone,
  Sun,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '../components/Dialog';
import { RoutingMatrix } from '../components/RoutingMatrix';
import { EngineStatus } from '../components/Shell';
import { Segmented, StatusDot, cx } from '../components/ui';
import { cloudLabel, LOCAL_MODEL } from '../engine';
import { browserInfo, promptApiExposed } from '../engine/chromeAI';
import { SyncCard } from '../components/SyncCard';
import { clearSessions } from '../lib/db';
import type { EngineMode } from '../lib/types';
import { useSessions } from '../lib/useSessions';
import { useEngine } from '../state/engine';
import { usePwa } from '../state/pwa';
import { useTheme, type ThemePref } from '../state/theme';
import { useToast } from '../state/toast';

const MODES: { value: EngineMode; title: string; body: string; icon: typeof Cpu }[] = [
  { value: 'auto', title: 'Automatic', body: 'Prefer on-device. Use cloud Gemini when Nano isn’t available.', icon: RefreshCw },
  { value: 'local-only', title: 'On-device only', body: 'Never send problems to the cloud. Requires Gemini Nano.', icon: Cpu },
  { value: 'cloud-only', title: 'Cloud only', body: 'Always use the more capable cloud model. Requires internet.', icon: Cloud },
];

const LOCAL_LABEL = {
  available: 'Ready',
  downloadable: 'Download required',
  downloading: 'Downloading',
  unavailable: 'Not supported on this device',
  unsupported: 'Not available in this browser',
} as const;

export default function Engine() {
  const engine = useEngine();
  const { theme, setTheme } = useTheme();
  const pwa = usePwa();
  const { push } = useToast();
  const { sessions } = useSessions();
  const [confirmClear, setConfirmClear] = useState(false);
  const info = browserInfo();
  const { local, online, downloadProgress } = engine;

  const localTone = local === 'available' ? 'local' : local === 'downloading' || local === 'downloadable' ? 'warn' : 'muted';

  const requirements: { ok: boolean; label: string; detail: string }[] = [
    {
      ok: info.isChrome && (info.chromeVersion ?? 0) >= 139,
      label: 'Chrome 139 or later',
      detail: info.isChrome ? `Detected Chrome ${info.chromeVersion}` : 'Hybrid inference needs desktop Chrome',
    },
    { ok: info.desktop, label: 'Desktop device', detail: info.desktop ? 'Windows, macOS, Linux or ChromeOS' : 'Mobile isn’t supported yet' },
    { ok: promptApiExposed(), label: 'Prompt API enabled', detail: promptApiExposed() ? 'LanguageModel API detected' : 'Not exposed by this browser' },
    { ok: local === 'available', label: 'Gemini Nano downloaded', detail: LOCAL_LABEL[local] },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-12">
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] sm:text-[34px]">Engine</h1>
        <p className="mt-1.5 max-w-xl text-[14.5px] text-ink-2">
          Where your requests run, how to prepare the on-device model, and how PocketOps works offline.
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

          {/* Model setup */}
          <Section title="On-device AI" desc="Gemini Nano is managed by Chrome. Download it once while online, then use it anywhere.">
            {local === 'available' && downloadProgress === null ? (
              <div className="card flex flex-wrap items-center gap-3 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-local/12 text-local">
                  <Check className="size-4.5" strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">Gemini Nano is ready</p>
                  <p className="text-[12.5px] text-ink-3">Diagnoses and follow-ups work on this device, even without internet.</p>
                </div>
                <button onClick={engine.refresh} className="btn-ghost h-8 text-[13px]">
                  <RefreshCw className={cx('size-3.5', engine.checking && 'animate-spin')} /> Re-check
                </button>
              </div>
            ) : (
            <>
            <div className="card overflow-hidden">
              <ul className="divide-y divide-line">
                {requirements.map((r) => (
                  <li key={r.label} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={cx(
                        'grid size-5 shrink-0 place-items-center rounded-full',
                        r.ok ? 'bg-local/15 text-local' : 'bg-surface-3 text-ink-3',
                      )}
                    >
                      {r.ok ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 text-[13.5px] font-medium">{r.label}</span>
                    <span className="truncate text-right text-[12.5px] text-ink-3">{r.detail}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line bg-surface-2/50 p-4">
                {downloadProgress !== null ? (
                  <div>
                    <div className="mb-2 flex justify-between text-[13px]">
                      <span className="flex items-center gap-2 font-medium">
                        <Loader2 className="size-3.5 animate-spin text-local" /> Downloading Gemini Nano
                      </span>
                      <span className="font-mono text-ink-3 tabular-nums">{Math.round(downloadProgress * 100)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-line-strong">
                      <motion.div className="h-full rounded-full bg-local" animate={{ width: `${downloadProgress * 100}%` }} />
                    </div>
                    <p className="mt-2 text-[12px] text-ink-3">Keep this tab open. Chrome continues the download in the background.</p>
                  </div>
                ) : local === 'available' ? (
                  <p className="flex items-center gap-2 text-[13.5px] text-local">
                    <Check className="size-4" /> Gemini Nano is ready. Diagnoses work without internet.
                  </p>
                ) : local === 'downloadable' || local === 'downloading' ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[13px] text-ink-2">
                      {online ? 'The model is a one-time download of a few GB.' : 'Connect to the internet to download.'}
                    </p>
                    <button onClick={engine.download} disabled={!online} className="btn-primary h-9">
                      <Download className="size-4" /> {local === 'downloading' ? 'Resume download' : 'Download model'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-2">
                    <CircleSlash className="mt-0.5 size-4 shrink-0 text-ink-3" />
                    <span>
                      On-device AI isn’t available here. PocketOps will use cloud Gemini when online and show saved guidance when
                      offline. Try Chrome 139+ on desktop with the Prompt API enabled.
                    </span>
                  </div>
                )}
                {engine.downloadError && <p className="mt-2 text-[12.5px] text-danger">{engine.downloadError}</p>}
              </div>
            </div>
            <button onClick={engine.refresh} className="btn-ghost mt-2 h-8 text-[13px]">
              <RefreshCw className={cx('size-3.5', engine.checking && 'animate-spin')} /> Re-check availability
            </button>
            </>
            )}
          </Section>

          {/* Sync */}
          <Section title="Cloud sync" desc="Firebase Authentication and Cloud Firestore keep a backup of your saved guides.">
            <SyncCard />
          </Section>

          {/* App */}
          <Section title="App" desc="Appearance, installation and local data.">
            <div className="card divide-y divide-line">
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
              <Row label="Saved guidance" hint={`${sessions.length} guide${sessions.length === 1 ? '' : 's'} stored in IndexedDB on this device.`}>
                <button
                  onClick={() => setConfirmClear(true)}
                  disabled={!sessions.length}
                  className="btn h-8 border border-line px-3 text-[13px] text-danger hover:bg-danger/8"
                >
                  <Trash2 className="size-3.5" /> Clear
                </button>
              </Row>
            </div>
          </Section>
        </div>

        <aside className="space-y-4">
          <RoutingMatrix />
          <EngineStatus static />
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all saved guidance?"
        body={`This permanently removes ${sessions.length} guide${sessions.length === 1 ? '' : 's'} from this device. It can’t be undone.`}
        confirmLabel="Clear all"
        destructive
        onClose={() => setConfirmClear(false)}
        onConfirm={async () => {
          await clearSessions();
          push({ tone: 'info', title: 'Saved guidance cleared' });
        }}
      />
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
