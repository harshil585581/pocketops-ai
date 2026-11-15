import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Cloud,
  CloudOff,
  Cpu,
  Download,
  Eye,
  HardDrive,
  Lightbulb,
  ListChecks,
  Lock,
  MessageCircleQuestion,
  MessagesSquare,
  PenLine,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Smartphone,
  Sparkles,
  ThumbsUp,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { StatusDot, cx } from '../components/ui';
import { useEngine } from '../state/engine';

const fade = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { type: 'spring', stiffness: 260, damping: 30 },
} as const;

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <p className="label !text-local">{eyebrow}</p>
      <h2 className="mt-2 text-[24px] leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-[28px]">{title}</h2>
      {children && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-pretty text-ink-2">{children}</p>}
    </div>
  );
}

const STEPS = [
  {
    icon: PenLine,
    tint: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
    title: 'Describe the problem',
    body: 'Type what’s happening in your own words: what you see, hear or smell, and when it started.',
  },
  {
    icon: ListChecks,
    tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    title: 'Follow the guide',
    body: 'Read the safety notes first, check the likely causes, then tick off each step as you go.',
  },
  {
    icon: MessageCircleQuestion,
    tint: 'bg-amber-500/12 text-amber-600 dark:text-amber-300',
    title: 'Not fixed? Keep talking',
    body: 'Tap “Didn’t work?” on any step or reply in the same conversation. You’ll get new steps that build on what you tried.',
  },
  {
    icon: ThumbsUp,
    tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    title: 'Mark it resolved',
    body: 'Answer “Did this fix it?” and the conversation gets a green tick in the sidebar, ready for next time.',
  },
];

const FAQ = [
  {
    q: 'Why does Gemini Nano show “Unavailable” on my phone?',
    a: 'Chrome only lets websites use Gemini Nano on desktop computers (Windows, macOS, Linux, ChromeOS). On phones, PocketOps uses cloud Gemini when you’re online and shows your saved conversations when you’re offline.',
  },
  {
    q: 'Do I need to create an account?',
    a: 'No. You’re signed in anonymously in the background so your conversations are backed up. Sign in with Google in Settings if you want the same conversations on another device.',
  },
  {
    q: 'How do I install PocketOps as an app?',
    a: 'Use “Install app” in Settings, or your browser’s menu → Install. It then opens in its own window and works offline like a native app.',
  },
  {
    q: 'How do I delete a conversation?',
    a: 'Hover over it in the sidebar and click the bin icon (on phones it’s always visible), or use the bin icon at the top of the conversation.',
  },
  {
    q: 'Will the on-device and cloud answers be the same?',
    a: 'Not always. The cloud model is larger and usually gives more detailed answers; Gemini Nano is faster, private and works offline. Every answer is labelled with where it came from.',
  },
  {
    q: 'Is PocketOps free?',
    a: 'Yes. On-device AI runs on your own computer, and cloud answers run through Firebase AI Logic within its free usage limits.',
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {FAQ.map((f, i) => {
        const on = open === i;
        return (
          <div key={f.q}>
            <button
              onClick={() => setOpen(on ? null : i)}
              aria-expanded={on}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-surface-2/60"
            >
              <span className="flex-1 text-[15px] font-medium tracking-tight">{f.q}</span>
              <ChevronDown className={cx('size-4.5 shrink-0 text-ink-3 transition-transform duration-300', on && 'rotate-180')} />
            </button>
            <div className={cx('grid transition-[grid-template-rows] duration-300 ease-out', on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-[14px] leading-relaxed text-ink-2">{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Guide() {
  const { local, online, downloadProgress } = useEngine();
  const nanoReady = local === 'available';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-14">
      {/* Hero */}
      <motion.header {...fade} className="relative overflow-hidden rounded-3xl border border-line bg-surface p-7 shadow-card sm:p-10">
        <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-local/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 size-72 rounded-full bg-cloud/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-[12px] font-medium text-ink-2">
            <Sparkles className="size-3.5 text-local" /> How PocketOps works
          </span>
          <h1 className="mt-5 text-[32px] leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-[44px]">
            Your repair companion that <span className="text-brand">works without a signal</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-pretty text-ink-2">
            Describe what’s wrong with a device, machine, vehicle or anything at home. PocketOps finds the likely causes, walks you
            through a safe fix step by step, and keeps helping until it’s solved — using AI on your device when it can, and in the
            cloud when it helps.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              { icon: WifiOff, title: 'Works offline', body: 'Diagnose and follow up with no internet.', tone: 'text-local bg-local/10' },
              { icon: Lock, title: 'Private by default', body: 'On-device answers never leave your computer.', tone: 'text-local bg-local/10' },
              { icon: Cloud, title: 'Cloud when it helps', body: 'Bigger problems get a more capable model.', tone: 'text-cloud bg-cloud/10' },
            ].map((v) => (
              <div key={v.title} className="rounded-2xl border border-line bg-surface-2/60 p-4">
                <span className={cx('grid size-9 place-items-center rounded-xl', v.tone)}>
                  <v.icon className="size-4.5" />
                </span>
                <p className="mt-3 text-[14.5px] font-semibold tracking-tight">{v.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.header>

      {/* How to use */}
      <motion.section {...fade} className="mt-16">
        <SectionHead eyebrow="Getting started" title="Fix it in four steps">
          Every problem becomes a conversation you can come back to — even offline.
        </SectionHead>
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card card-hover relative p-5">
              <span className="absolute top-5 right-5 font-mono text-[12px] text-ink-3">0{i + 1}</span>
              <span className={cx('grid size-10 place-items-center rounded-xl', s.tint)}>
                <s.icon className="size-5" />
              </span>
              <p className="mt-4 text-[16px] font-semibold tracking-tight">{s.title}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* Hybrid AI */}
      <motion.section {...fade} className="mt-16">
        <SectionHead eyebrow="Hybrid AI" title="Two AI engines, one conversation">
          PocketOps uses Firebase AI Logic to pick the right engine for every message, automatically.
        </SectionHead>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-local/25 bg-gradient-to-br from-local/[0.07] to-transparent p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-local/12 text-local">
                <Cpu className="size-5" />
              </span>
              <div>
                <p className="text-[16px] font-semibold tracking-tight">On-device · Gemini Nano</p>
                <p className="text-[12.5px] text-ink-3">Runs inside Chrome on your computer</p>
              </div>
            </div>
            <ul className="mt-5 space-y-2.5 text-[14px] text-ink-2">
              {['Works with no internet at all', 'Your description never leaves the device', 'Used first whenever it’s ready'].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-local" /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-local/25 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-local">
              <Cpu className="size-3" /> Generated locally · Gemini Nano
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-cloud/25 bg-gradient-to-br from-cloud/[0.07] to-transparent p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-cloud/12 text-cloud">
                <Cloud className="size-5" />
              </span>
              <div>
                <p className="text-[16px] font-semibold tracking-tight">Cloud · Gemini Flash</p>
                <p className="text-[12.5px] text-ink-3">Google’s larger models, via Firebase</p>
              </div>
            </div>
            <ul className="mt-5 space-y-2.5 text-[14px] text-ink-2">
              {['Steps in when Nano isn’t available', 'Handles long, detailed descriptions', 'Powers “Deep analysis” for tough problems'].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cloud" /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-cloud/25 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-cloud">
              <Cloud className="size-3" /> Generated in cloud · Gemini Flash
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-line bg-surface-2/60 p-4 text-[14px] leading-relaxed text-ink-2">
          <Eye className="mt-0.5 size-4.5 shrink-0 text-ink-3" />
          <span>
            <span className="font-medium text-ink">Always transparent.</span> Each answer carries a label showing exactly where it was
            generated, so you know when your data stayed on your device.
          </span>
        </div>
      </motion.section>

      {/* Offline */}
      <motion.section {...fade} className="mt-16">
        <SectionHead eyebrow="Offline mode" title="What works without internet">
          Lose signal in a basement, a plant room or on the road — your guides and the on-device AI keep working.
        </SectionHead>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card p-6">
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <WifiOff className="size-4.5 text-local" /> Works offline
            </p>
            <ul className="mt-4 space-y-3 text-[14px] text-ink-2">
              {[
                [RefreshCw, 'The app itself opens instantly — it’s stored on your device'],
                [HardDrive, 'All your conversations and step progress'],
                [Cpu, 'New diagnoses and follow-ups with Gemini Nano'],
                [MessagesSquare, 'Related saved conversations if no AI is available'],
              ].map(([Icon, t]) => {
                const I = Icon as typeof Cpu;
                return (
                  <li key={t as string} className="flex gap-3">
                    <I className="mt-0.5 size-4 shrink-0 text-local" /> {t as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card p-6">
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <Wifi className="size-4.5 text-cloud" /> Needs internet
            </p>
            <ul className="mt-4 space-y-3 text-[14px] text-ink-2">
              {[
                [Cloud, 'Cloud Gemini answers and Deep analysis'],
                [Download, 'Downloading Gemini Nano for the first time'],
                [CloudOff, 'Syncing to your account — changes wait and upload later'],
                [ShieldCheck, 'Signing in with Google'],
              ].map(([Icon, t]) => {
                const I = Icon as typeof Cpu;
                return (
                  <li key={t as string} className="flex gap-3">
                    <I className="mt-0.5 size-4 shrink-0 text-cloud" /> {t as string}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </motion.section>

      {/* Set up offline AI */}
      <motion.section {...fade} className="mt-16">
        <SectionHead eyebrow="One-time setup" title="Turn on offline AI">
          Gemini Nano is built into desktop Chrome. Download it once while online, then it works anywhere.
        </SectionHead>
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-2/50 px-5 py-4">
            <span className="text-[14px] font-medium">On this device:</span>
            <span
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium',
                nanoReady ? 'bg-local/10 text-local' : 'bg-surface-3 text-ink-2',
              )}
            >
              <StatusDot tone={nanoReady ? 'local' : downloadProgress !== null ? 'warn' : 'muted'} pulse={nanoReady} />
              {nanoReady
                ? 'Gemini Nano is ready — you can go offline'
                : downloadProgress !== null
                  ? `Downloading… ${Math.round(downloadProgress * 100)}%`
                  : local === 'downloadable' || local === 'downloading'
                    ? 'Ready to download'
                    : 'Not available on this device'}
            </span>
            {!online && <span className="text-[12.5px] text-ink-3">You’re offline right now</span>}
            <Link to="/settings" className="btn-secondary ml-auto h-8 text-[13px]">
              <SettingsIcon className="size-3.5" /> Open Settings
            </Link>
          </div>
          <ol className="grid gap-px bg-line sm:grid-cols-3">
            {[
              ['Use desktop Chrome', 'Chrome 139 or later on Windows, macOS, Linux or ChromeOS.'],
              ['Download once', 'Settings → Gemini Nano → Download. It’s about 4 GB and Chrome manages it.'],
              ['Go offline', 'Turn off Wi-Fi and diagnose — answers say “Generated locally”.'],
            ].map(([t, d], i) => (
              <li key={t} className="bg-surface p-5">
                <span className="grid size-7 place-items-center rounded-full bg-ink font-mono text-[12px] text-canvas">{i + 1}</span>
                <p className="mt-3 text-[14.5px] font-semibold tracking-tight">{t}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
          <p className="flex items-start gap-2.5 border-t border-line px-5 py-3.5 text-[13px] leading-relaxed text-ink-3">
            <Smartphone className="mt-0.5 size-4 shrink-0" />
            On phones, Chrome doesn’t offer Gemini Nano to websites — PocketOps uses cloud Gemini online and your saved conversations
            offline.
          </p>
        </div>
      </motion.section>

      {/* Tips */}
      <motion.section {...fade} className="mt-16">
        <SectionHead eyebrow="Get better answers" title="Describe it like a technician would" />
        <div className="grid gap-3 md:grid-cols-[1fr_1.1fr]">
          <div className="card p-6">
            <ul className="space-y-3.5 text-[14px] text-ink-2">
              {[
                'What you see, hear or smell — clicks, beeps, burning smells, error codes',
                'When it started and what changed just before',
                'What you’ve already tried',
                'The make or model, if you know it',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2.5">
            <div className="flex gap-3 rounded-2xl border border-danger/20 bg-danger/[0.04] p-4">
              <XCircle className="mt-0.5 size-4.5 shrink-0 text-danger" />
              <div>
                <p className="label !text-danger">Too vague</p>
                <p className="mt-1 text-[14px] text-ink-2">“My washing machine is broken.”</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-local/25 bg-local/[0.06] p-4">
              <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-local" />
              <div>
                <p className="label !text-local">Great</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink">
                  “My Bosch washing machine stops mid-cycle with water still inside and shows error E18. It started yesterday. I already
                  checked the hose isn’t kinked.”
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Privacy & safety */}
      <motion.section {...fade} className="mt-16">
        <SectionHead eyebrow="Trust" title="Privacy and safety" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Lock,
              tone: 'bg-local/10 text-local',
              title: 'Private on-device',
              body: 'With Gemini Nano, your description is processed on your computer and never sent anywhere.',
            },
            {
              icon: ShieldCheck,
              tone: 'bg-cloud/10 text-cloud',
              title: 'Protected cloud',
              body: 'Cloud requests go through Firebase AI Logic with App Check, and your conversations sync only to your account.',
            },
            {
              icon: Sparkles,
              tone: 'bg-amber-500/12 text-amber-600 dark:text-amber-300',
              title: 'Safety first',
              body: 'Safety notes come before every fix. PocketOps is guidance, not a professional diagnosis — stop if you see smoke or sparks.',
            },
          ].map((c) => (
            <div key={c.title} className="card p-5">
              <span className={cx('grid size-9 place-items-center rounded-xl', c.tone)}>
                <c.icon className="size-4.5" />
              </span>
              <p className="mt-3 text-[15px] font-semibold tracking-tight">{c.title}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{c.body}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* FAQ */}
      <motion.section {...fade} className="mt-16">
        <SectionHead eyebrow="FAQ" title="Common questions" />
        <Faq />
      </motion.section>

      {/* CTA */}
      <motion.section
        {...fade}
        className="relative mt-16 overflow-hidden rounded-3xl border border-line bg-ink p-8 text-center text-canvas sm:p-12 dark:bg-surface dark:text-ink"
      >
        <div className="pointer-events-none absolute -top-20 left-1/4 size-64 rounded-full bg-local/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/4 size-64 rounded-full bg-cloud/25 blur-3xl" />
        <div className="relative">
          <h2 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] sm:text-[32px]">Something not working?</h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] opacity-75">Describe it in a sentence and get a safe, step-by-step fix.</p>
          <Link to="/" className="btn-brand mt-6 h-11 px-5 text-[15px]">
            Start a diagnosis <ArrowRight className="size-4" />
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
