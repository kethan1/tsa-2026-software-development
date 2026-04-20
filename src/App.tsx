import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Camera,
  Compass,
  Download,
  List,
  Play,
  Radio,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Square,
  Volume2,
  Watch,
} from 'lucide-react';

import { SoundEvent, SenseSyncCategory, UserSettings } from './types';
import {
  CATEGORY_ORDER,
  categoryHaptics,
  categoryMetadata,
  defaultSettings,
  resolveEvent,
  sampleLog,
  urgencyFor,
} from './data';
import SoundRing from './components/SoundRing';
import { SoundBadge, UrgencyTag } from './components/SoundBadge';
import { useInstallPrompt } from './pwa';

type ScreenId = 'main' | 'alert' | 'log' | 'settings';

const SCREENS: { id: ScreenId; label: string; title: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'main', label: 'Radar', title: 'Live sound radar', icon: Radio },
  { id: 'alert', label: 'Alert', title: 'Critical alert', icon: ShieldAlert },
  { id: 'log', label: 'Recent', title: 'Recent sounds', icon: List },
  { id: 'settings', label: 'Settings', title: 'Settings', icon: Settings },
];

const CARDINALS = ['Front', 'Front right', 'Right', 'Behind right', 'Behind', 'Behind left', 'Left', 'Front left'];
const directionLabel = (deg: number) => CARDINALS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
const timeAgo = (date: Date) => {
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
};

const demoEvent = (category: SenseSyncCategory, directionDeg: number, loudness: number, label?: string): SoundEvent => ({
  id: `${category}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  category,
  rawLabel: label || categoryMetadata[category].displayName,
  icon: categoryMetadata[category].icon,
  urgency: urgencyFor(category, directionDeg),
  confidence: 0.86 + Math.random() * 0.1,
  loudness,
  directionDeg,
  timestamp: new Date(),
  source: 'demo',
});

function useCameraFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        setCameraError('');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraOn(true);
      } catch {
        setCameraError('Camera unavailable');
        setCameraOn(false);
      }
    };

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  return { videoRef, cameraOn, cameraError };
}

export default function App() {
  const initialLog = useMemo(() => sampleLog(), []);
  const [screen, setScreen] = useState<ScreenId>('main');
  const [events, setEvents] = useState<SoundEvent[]>(initialLog);
  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [heading] = useState(0);
  const { canInstall, promptInstall } = useInstallPrompt();
  const { videoRef, cameraOn, cameraError } = useCameraFeed();

  const latest = events[0];
  const critical = events.find((event) => resolveEvent(event).isCritical) || latest;
  const latestResolved = resolveEvent(latest);
  const criticalResolved = resolveEvent(critical);

  const pushEvent = (event: SoundEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, 12));
    if ('vibrate' in navigator) navigator.vibrate(resolveEvent(event).pattern);
  };

  const startDemo = () => {
    setRunning(true);
    pushEvent(demoEvent('vehicle', 180, 0.94, 'Vehicle approaching'));
  };

  const stopDemo = () => setRunning(false);

  return (
    <div className="min-h-[100dvh] bg-[#f3f5f2] text-[#071016]">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col overflow-hidden bg-[#06090c] text-white shadow-2xl sm:my-5 sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] sm:border sm:border-black/15">
        <header
          className="z-30 flex shrink-0 items-center justify-between border-b border-white/10 bg-[#061015]/92 px-5 pb-3 backdrop-blur-xl"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
        >
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/70">
              Sonar AR
            </p>
            <h1 className="mt-0.5 font-display text-lg font-semibold tracking-normal text-white">
              {SCREENS.find((item) => item.id === screen)?.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {canInstall && (
              <button
                onClick={promptInstall}
                aria-label="Install app"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/15"
              >
                <Download size={17} />
              </button>
            )}
            <div className="grid h-9 w-9 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
              <Compass size={18} />
            </div>
          </div>
        </header>

        <main className="relative flex-1 overflow-hidden">
          <Screen active={screen === 'main'}>
            <MainRadarScreen
              videoRef={videoRef}
              cameraOn={cameraOn}
              cameraError={cameraError}
              events={events}
              running={running}
              latest={latest}
              latestResolved={latestResolved}
              onStart={startDemo}
              onStop={stopDemo}
              onQuickSound={(category) => pushEvent(demoEvent(category, category === 'siren' ? 225 : 55, 0.72))}
            />
          </Screen>

          <Screen active={screen === 'alert'}>
            <CriticalAlertScreen event={critical} onSimulate={() => pushEvent(demoEvent('siren', 225, 0.98, 'Siren'))} />
          </Screen>

          <Screen active={screen === 'log'}>
            <RecentSoundsScreen events={events} />
          </Screen>

          <Screen active={screen === 'settings'}>
            <SettingsScreen settings={settings} onSettingsChange={setSettings} />
          </Screen>
        </main>

        <nav
          className="z-30 grid shrink-0 grid-cols-4 border-t border-white/10 bg-[#061015]/95 px-3 pt-2 backdrop-blur-xl"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          {SCREENS.map(({ id, label, icon: Icon }) => {
            const active = screen === id;
            return (
              <button
                key={id}
                onClick={() => setScreen(id)}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 font-mono text-[10px] font-bold uppercase transition ${
                  active ? 'bg-white text-[#061015]' : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function MainRadarScreen({
  videoRef,
  cameraOn,
  cameraError,
  events,
  running,
  latest,
  latestResolved,
  onStart,
  onStop,
  onQuickSound,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraOn: boolean;
  cameraError: string;
  events: SoundEvent[];
  running: boolean;
  latest: SoundEvent;
  latestResolved: ReturnType<typeof resolveEvent>;
  onStart: () => void;
  onStop: () => void;
  onQuickSound: (category: SenseSyncCategory) => void;
}) {
  return (
    <div className="relative h-full min-h-[560px] overflow-hidden bg-[#071016]">
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${cameraOn ? 'opacity-100' : 'opacity-0'}`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(20,184,166,0.08),rgba(4,7,10,0.72)_45%,rgba(4,7,10,0.92)_100%)]" />
      {!cameraOn && <div className="absolute inset-0 bg-[linear-gradient(145deg,#0d2530,#05070a_58%,#10110c)]" />}

      <div className="relative z-10 flex h-full flex-col px-5 py-5">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/35 px-3 py-1.5 backdrop-blur-md">
            <span className={`h-2 w-2 rounded-full ${running ? 'live-dot bg-emerald-300' : 'bg-white/35'}`} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
              {running ? 'Listening' : 'Standby'}
            </span>
          </div>
          <div className="rounded-full border border-white/12 bg-black/35 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 backdrop-blur-md">
            Camera {cameraOn ? 'live' : 'off'}
          </div>
        </div>

        <div className="grid flex-1 place-items-center py-6">
          <div className="relative grid place-items-center">
            <div className="absolute h-[78vw] max-h-[330px] min-h-[270px] w-[78vw] max-w-[330px] min-w-[270px] rounded-full border border-white/10 bg-black/20 shadow-[0_0_70px_rgba(45,212,191,0.18)] backdrop-blur-[1px]" />
            <SoundRing events={events} size={310} heading={0} max={4} />
          </div>
        </div>

        <div className="space-y-3">
          {cameraError && (
            <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 font-mono text-[10px] text-amber-100">
              {cameraError}. Radar overlay remains active.
            </p>
          )}

          <div className="rounded-2xl border border-white/12 bg-black/45 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <SoundBadge resolved={latestResolved} size={48} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <UrgencyTag resolved={latestResolved} />
                    <span className="font-mono text-[10px] text-white/50">{Math.round(latest.confidence * 100)}%</span>
                  </div>
                  <h2 className="mt-1 truncate font-display text-xl font-semibold tracking-normal text-white">
                    {latestResolved.shortName}
                  </h2>
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">
                    {directionLabel(latest.directionDeg)} - {Math.round(latest.loudness * 100)} dB scale
                  </p>
                </div>
              </div>
              <button
                onClick={running ? onStop : onStart}
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-white shadow-lg transition active:scale-95 ${
                  running ? 'bg-red-500 shadow-red-500/30' : 'bg-cyan-400 text-[#061015] shadow-cyan-400/25'
                }`}
                aria-label={running ? 'Stop sound radar' : 'Start sound radar'}
              >
                {running ? <Square size={21} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORY_ORDER.map((category) => (
              <button
                key={category}
                onClick={() => onQuickSound(category)}
                className="shrink-0 rounded-full border border-white/12 bg-black/40 px-3 py-2 font-mono text-[10px] font-bold uppercase text-white/80 backdrop-blur-md transition hover:bg-white/10"
              >
                <span className="mr-1.5">{categoryMetadata[category].icon}</span>
                {categoryMetadata[category].shortName}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CriticalAlertScreen({ event, onSimulate }: { event: SoundEvent; onSimulate: () => void }) {
  const resolved = resolveEvent(event);
  return (
    <div className="relative flex h-full min-h-[560px] flex-col overflow-hidden bg-[#210908] px-5 py-5 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(255,82,71,0.34),rgba(33,9,8,0.86)_42%,#070707_100%)]" />
      <div className="absolute inset-0 alert-throb border-[12px] border-red-500/45" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-8 grid h-28 w-28 place-items-center rounded-[28px] border-2 border-red-200 bg-red-500 text-white shadow-[0_0_70px_rgba(255,82,71,0.55)]">
          <AlertTriangle size={64} />
        </div>
        <p className="font-mono text-[12px] font-black uppercase tracking-[0.34em] text-red-100">Critical</p>
        <h2 className="mt-3 font-display text-5xl font-black tracking-normal text-white">{resolved.shortName}</h2>
        <p className="mt-4 font-mono text-sm uppercase tracking-[0.18em] text-red-100/80">
          {directionLabel(event.directionDeg)} - {event.directionDeg} deg
        </p>
        <div className="mt-9 w-full rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between text-left">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Haptic sent</span>
            <Watch size={19} className="text-red-100" />
          </div>
          <div className="mt-4 flex gap-2">
            {resolved.pattern.map((pulse, index) => (
              <span
                key={`${pulse}-${index}`}
                className="h-3 flex-1 rounded-full bg-red-300"
                style={{ opacity: 0.42 + Math.min(0.5, pulse / 700) }}
              />
            ))}
          </div>
        </div>
      </div>
      <button
        onClick={onSimulate}
        className="relative z-10 mb-2 rounded-full bg-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-[#210908] transition active:scale-95"
      >
        Simulate critical
      </button>
    </div>
  );
}

function RecentSoundsScreen({ events }: { events: SoundEvent[] }) {
  return (
    <div className="h-full min-h-[560px] overflow-y-auto bg-[#f5f6f1] px-5 py-5 text-[#091014]">
      <div className="mb-5 flex items-end justify-between border-b border-[#091014]/15 pb-4">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-[#64706b]">Timestamped log</p>
          <h2 className="mt-1 font-display text-3xl font-black tracking-normal">Recent sounds</h2>
        </div>
        <Bell size={24} />
      </div>
      <div className="space-y-2.5">
        {events.map((event) => {
          const resolved = resolveEvent(event);
          return (
            <article key={event.id} className="rounded-2xl border border-[#091014]/10 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <SoundBadge resolved={resolved} size={44} glow={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate font-display text-base font-bold tracking-normal">{resolved.name}</h3>
                    <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-[#66736d]">{timeAgo(event.timestamp)}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#66736d]">
                    {directionLabel(event.directionDeg)} - {Math.round(event.confidence * 100)}% confidence
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SettingsScreen({
  settings,
  onSettingsChange,
}: {
  settings: UserSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<UserSettings>>;
}) {
  return (
    <div className="h-full min-h-[560px] overflow-y-auto bg-[#f5f6f1] px-5 py-5 text-[#091014]">
      <div className="mb-5 border-b border-[#091014]/15 pb-4">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-[#64706b]">Sensitivity, alerts, haptics</p>
        <h2 className="mt-1 font-display text-3xl font-black tracking-normal">Settings</h2>
      </div>

      <section className="rounded-2xl border border-[#091014]/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={19} />
            <h3 className="font-display text-lg font-bold tracking-normal">Sensitivity</h3>
          </div>
          <span className="font-mono text-xs font-black">{Math.round(settings.sensitivity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.sensitivity}
          onChange={(event) => onSettingsChange((prev) => ({ ...prev, sensitivity: Number(event.target.value) }))}
          className="mt-4 w-full"
        />
      </section>

      <section className="mt-4 rounded-2xl border border-[#091014]/10 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Volume2 size={19} />
          <h3 className="font-display text-lg font-bold tracking-normal">Alert types</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORY_ORDER.map((category) => {
            const enabled = settings.alertOn[category];
            return (
              <button
                key={category}
                onClick={() =>
                  onSettingsChange((prev) => ({
                    ...prev,
                    alertOn: { ...prev.alertOn, [category]: !prev.alertOn[category] },
                  }))
                }
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  enabled ? 'border-[#091014] bg-[#091014] text-white' : 'border-[#091014]/12 bg-[#f5f6f1] text-[#091014]/50'
                }`}
              >
                <span className="text-lg">{categoryMetadata[category].icon}</span>
                <span className="ml-2 font-mono text-[10px] font-black uppercase tracking-[0.12em]">
                  {categoryMetadata[category].shortName}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-[#091014]/10 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Watch size={19} />
            <h3 className="font-display text-lg font-bold tracking-normal">Haptics</h3>
          </div>
          <button
            onClick={() => onSettingsChange((prev) => ({ ...prev, haptics: !prev.haptics }))}
            className={`h-7 w-12 rounded-full p-1 transition ${settings.haptics ? 'bg-[#091014]' : 'bg-[#c8d0ca]'}`}
            aria-label="Toggle haptics"
          >
            <span className={`block h-5 w-5 rounded-full bg-white transition ${settings.haptics ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <div className="space-y-2">
          {CATEGORY_ORDER.slice(0, 4).map((category) => (
            <div key={category} className="flex items-center justify-between rounded-xl bg-[#f5f6f1] px-3 py-2">
              <span className="font-mono text-[10px] font-black uppercase tracking-[0.12em]">
                {categoryMetadata[category].shortName}
              </span>
              <span className="font-mono text-[10px] text-[#64706b]">
                {(categoryHaptics[category]?.label || 'Default rhythm').split(' ').slice(0, 3).join(' ')}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Screen({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={active ? 'h-full' : 'hidden'}>{children}</div>;
}
