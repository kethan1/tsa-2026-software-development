import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Compass,
  Download,
  List,
  MessageSquareText,
  Mic,
  MicOff,
  Radio,
  Send,
  Settings,
  SlidersHorizontal,
  Square,
  Trash2,
  Volume2,
  Watch,
} from 'lucide-react';

import { SoundEvent, UserSettings } from './types';
import {
  CATEGORY_ORDER,
  categoryHaptics,
  categoryMetadata,
  defaultSettings,
  resolveEvent,
} from './data';
import ARView from './components/ARView';
import { SoundBadge } from './components/SoundBadge';
import { useInstallPrompt } from './pwa';

type ScreenId = 'main' | 'speech' | 'log' | 'settings';

const SCREENS: { id: ScreenId; label: string; title: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'main', label: 'Surround', title: 'Surround Sound', icon: Radio },
  { id: 'speech', label: 'Speech', title: 'Speech tools', icon: MessageSquareText },
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

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string; confidence?: number };
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type EmotionId = 'angry' | 'urgent' | 'happy' | 'sad' | 'calm' | 'neutral';

type SpeechLine = {
  id: string;
  text: string;
  emotion: EmotionId;
  confidence: number | null;
  timestamp: Date;
};

const EMOTION_META: Record<EmotionId, { label: string; classes: string; dot: string }> = {
  angry: {
    label: 'Angry',
    classes: 'border-red-500/30 bg-red-500/12 text-red-100',
    dot: 'bg-red-400',
  },
  urgent: {
    label: 'Urgent',
    classes: 'border-amber-400/35 bg-amber-400/12 text-amber-50',
    dot: 'bg-amber-300',
  },
  happy: {
    label: 'Happy',
    classes: 'border-emerald-400/35 bg-emerald-400/12 text-emerald-50',
    dot: 'bg-emerald-300',
  },
  sad: {
    label: 'Sad',
    classes: 'border-sky-400/35 bg-sky-400/12 text-sky-50',
    dot: 'bg-sky-300',
  },
  calm: {
    label: 'Calm',
    classes: 'border-teal-300/35 bg-teal-300/12 text-teal-50',
    dot: 'bg-teal-200',
  },
  neutral: {
    label: 'Neutral',
    classes: 'border-white/12 bg-white/8 text-white',
    dot: 'bg-white/50',
  },
};

const detectEmotion = (value: string): EmotionId => {
  const text = value.toLowerCase();
  const angryWords = ['angry', 'mad', 'furious', 'stop', 'hate', 'annoyed', 'upset', 'ridiculous', 'shut up'];
  const urgentWords = ['help', 'emergency', 'hurry', 'now', 'danger', 'careful', 'watch out', 'run', 'fire'];
  const happyWords = ['happy', 'great', 'thanks', 'thank you', 'awesome', 'love', 'nice', 'excited', 'glad'];
  const sadWords = ['sad', 'sorry', 'hurt', 'crying', 'lonely', 'tired', 'miss', 'worried'];
  const calmWords = ['okay', 'fine', 'calm', 'relax', 'breathe', 'slowly', 'peaceful'];

  if (angryWords.some((word) => text.includes(word)) || /!{2,}/.test(value)) return 'angry';
  if (urgentWords.some((word) => text.includes(word))) return 'urgent';
  if (happyWords.some((word) => text.includes(word))) return 'happy';
  if (sadWords.some((word) => text.includes(word))) return 'sad';
  if (calmWords.some((word) => text.includes(word))) return 'calm';
  return 'neutral';
};

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('main');
  const [events, setEvents] = useState<SoundEvent[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [dismissedAlertId, setDismissedAlertId] = useState<string | null>(null);
  const { canInstall, installed, promptInstall } = useInstallPrompt();

  const critical = events.find((event) => resolveEvent(event).isCritical);
  const showCriticalPopup = screen === 'main' && critical != null && dismissedAlertId !== critical.id;

  const handleRadarEventsChange = (nextEvents: SoundEvent[]) => {
    setDismissedAlertId(null);
    setEvents(nextEvents);
  };

  return (
    <div className="min-h-[100dvh] bg-black text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col overflow-hidden bg-[#06090c] text-white shadow-2xl sm:my-5 sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] sm:border sm:border-black/15">
        {screen !== 'main' && (
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
        )}

        <main className="relative flex-1 overflow-hidden">
          <Screen active={screen === 'main'}>
            <ARView onEventsChange={handleRadarEventsChange} />
            {showCriticalPopup && critical && (
              <CriticalAlertPopup event={critical} onDismiss={() => setDismissedAlertId(critical.id)} />
            )}
            {canInstall && (
              <button
                onClick={promptInstall}
                className="absolute right-3 z-30 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/60 text-white shadow-lg backdrop-blur transition active:scale-95"
                style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
                aria-label="Install app"
              >
                <Download size={18} />
              </button>
            )}
          </Screen>

          <Screen active={screen === 'speech'}>
            <SpeechScreen />
          </Screen>

          <Screen active={screen === 'log'}>
            <RecentSoundsScreen events={events} />
          </Screen>

          <Screen active={screen === 'settings'}>
            <SettingsScreen
              settings={settings}
              onSettingsChange={setSettings}
              canInstall={canInstall}
              installed={installed}
              onInstall={promptInstall}
            />
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

function CriticalAlertPopup({ event, onDismiss }: { event: SoundEvent; onDismiss: () => void }) {
  const resolved = resolveEvent(event);
  return (
    <div
      className="pointer-events-none absolute inset-x-3 z-40 flex justify-center"
      style={{ top: 'calc(env(safe-area-inset-top) + 4.25rem)' }}
    >
      <section className="pointer-events-auto w-full max-w-sm animate-fade-in rounded-[1.5rem] border border-red-300/35 bg-[#1d0b0d]/94 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-red-300/45 bg-red-500/18 text-red-200">
            <AlertTriangle size={27} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-red-200">
              Critical sound detected
            </p>
            <h2 className="mt-1 truncate font-display text-xl font-black tracking-normal text-white">
              {resolved.shortName}
            </h2>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-white/12 bg-white/7 px-4 py-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Direction</p>
          <p className="mt-1 font-display text-lg font-bold text-white">
            {directionLabel(event.directionDeg)} · {event.directionDeg}°
          </p>
          <p className="mt-2 font-mono text-[11px] text-white/60">
            {Math.round(event.confidence * 100)}% confidence · {Math.round(event.loudness * 100)} dB scale
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="mt-3 w-full rounded-2xl bg-red-400 px-5 py-2.5 font-display text-sm font-bold text-[#160609] transition active:scale-[0.98]"
        >
          Got it - dismiss
        </button>
      </section>
    </div>
  );
}


function SpeechScreen() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [lines, setLines] = useState<SpeechLine[]>([]);
  const [speakText, setSpeakText] = useState('I need a quiet route to the exit, please.');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const Recognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let nextInterim = '';
      const nextLines: SpeechLine[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;

        if (result.isFinal) {
          nextLines.push({
            id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
            text: transcript,
            emotion: detectEmotion(transcript),
            confidence: typeof result[0].confidence === 'number' ? result[0].confidence : null,
            timestamp: new Date(),
          });
        } else {
          nextInterim = [nextInterim, transcript].filter(Boolean).join(' ');
        }
      }

      if (nextLines.length > 0) {
        setLines((prev) => [...nextLines, ...prev].slice(0, 24));
      }
      setInterimText(nextInterim);
    };
    recognition.onerror = (event) => {
      setSpeechError(event.error ? `Speech recognition error: ${event.error}` : 'Speech recognition stopped unexpectedly.');
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      setVoiceURI((current) => current || available[0]?.voiceURI || '');
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) return;
    try {
      setSpeechError('');
      setInterimText('');
      recognitionRef.current.start();
      setListening(true);
    } catch {
      setSpeechError('Speech recognition is already starting.');
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const speak = () => {
    const text = speakText.trim();
    if (!text || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = voices.find((voice) => voice.voiceURI === voiceURI);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  return (
    <div className="h-full min-h-[560px] overflow-y-auto bg-[#071016] px-5 py-5 text-white">
      <div className="mb-5 flex items-end justify-between border-b border-white/10 pb-4">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/70">Caption, color, speak</p>
          <h2 className="mt-1 font-display text-3xl font-black tracking-normal">Speech</h2>
        </div>
        <MessageSquareText size={25} className="text-cyan-100" />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/7 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold tracking-normal">Speech to text</h3>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              {listening ? 'Listening live' : speechSupported ? 'Ready' : 'Unavailable'}
            </p>
          </div>
          <button
            onClick={listening ? stopListening : startListening}
            disabled={!speechSupported}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full transition active:scale-95 ${
              listening
                ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.42)]'
                : speechSupported
                  ? 'bg-cyan-300 text-[#061015] shadow-[0_0_30px_rgba(103,232,249,0.28)]'
                  : 'bg-white/10 text-white/30'
            }`}
            aria-label={listening ? 'Stop speech recognition' : 'Start speech recognition'}
          >
            {listening ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {(Object.keys(EMOTION_META) as EmotionId[]).map((emotion) => (
            <span key={emotion} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/24 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-white/70">
              <span className={`h-2 w-2 rounded-full ${EMOTION_META[emotion].dot}`} />
              {EMOTION_META[emotion].label}
            </span>
          ))}
        </div>

        {speechError && (
          <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
            {speechError}
          </p>
        )}

        {interimText && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white/60">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Live</p>
            <p className="mt-1 text-sm leading-relaxed">{interimText}</p>
          </div>
        )}

        <div className="mt-4 space-y-2.5">
          {lines.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/14 bg-black/18 px-4 py-6 text-center text-sm text-white/45">
              No captions yet
            </div>
          ) : (
            lines.map((line) => {
              const meta = EMOTION_META[line.emotion];
              return (
                <article key={line.id} className={`rounded-2xl border px-4 py-3 ${meta.classes}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-[0.14em]">
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-white/45">
                      {line.confidence == null ? timeAgo(line.timestamp) : `${Math.round(line.confidence * 100)}%`}
                    </span>
                  </div>
                  <p className="text-base leading-relaxed text-white">{line.text}</p>
                </article>
              );
            })
          )}
        </div>

        {lines.length > 0 && (
          <button
            onClick={() => setLines([])}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/12"
          >
            <Trash2 size={14} />
            Clear captions
          </button>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/7 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.25)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold tracking-normal">Text to speech</h3>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              {speaking ? 'Speaking' : 'Voice output'}
            </p>
          </div>
          <Volume2 size={22} className="text-cyan-100" />
        </div>

        <textarea
          value={speakText}
          onChange={(event) => setSpeakText(event.target.value)}
          rows={4}
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/28 px-4 py-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/30 focus:border-cyan-200/50"
          placeholder="Type what you want spoken aloud"
        />

        <div className="mt-3 flex gap-2">
          <select
            value={voiceURI}
            onChange={(event) => setVoiceURI(event.target.value)}
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/50"
          >
            {voices.length === 0 ? (
              <option value="">Default voice</option>
            ) : (
              voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name}
                </option>
              ))
            )}
          </select>
          <button
            onClick={speaking ? stopSpeaking : speak}
            disabled={!speakText.trim() || !('speechSynthesis' in window)}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-95 ${
              speaking
                ? 'bg-red-500 text-white'
                : speakText.trim()
                  ? 'bg-cyan-300 text-[#061015]'
                  : 'bg-white/10 text-white/30'
            }`}
            aria-label={speaking ? 'Stop speaking' : 'Speak text'}
          >
            {speaking ? <Square size={17} fill="currentColor" /> : <Send size={18} />}
          </button>
        </div>
      </section>
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
      {events.length === 0 ? (
        <div className="rounded-2xl border border-[#091014]/10 bg-white p-5 text-center shadow-sm">
          <p className="font-display text-lg font-bold tracking-normal">No current events</p>
          <p className="mt-2 text-sm leading-relaxed text-[#66736d]">
            Press Start on Surround Sound to create the hardcoded demo event.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}

function SettingsScreen({
  settings,
  onSettingsChange,
  canInstall,
  installed,
  onInstall,
}: {
  settings: UserSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<UserSettings>>;
  canInstall: boolean;
  installed: boolean;
  onInstall: () => void;
}) {
  return (
    <div className="h-full min-h-[560px] overflow-y-auto bg-[#f5f6f1] px-5 py-5 text-[#091014]">
      <div className="mb-5 border-b border-[#091014]/15 pb-4">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-[#64706b]">Sensitivity, alerts, haptics</p>
        <h2 className="mt-1 font-display text-3xl font-black tracking-normal">Settings</h2>
      </div>

      <section className="mt-4 rounded-2xl border border-[#091014]/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Download size={19} />
            <div>
              <h3 className="font-display text-lg font-bold tracking-normal">Install app</h3>
              <p className="text-xs leading-relaxed text-[#64706b]">
                {installed ? 'Surround Sound is installed on this device.' : 'Add Surround Sound to your home screen.'}
              </p>
            </div>
          </div>
          <button
            onClick={onInstall}
            disabled={!canInstall}
            className={`shrink-0 rounded-full px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] transition ${
              canInstall ? 'bg-[#091014] text-white active:scale-95' : 'bg-[#e4e8e4] text-[#64706b]'
            }`}
          >
            {installed ? 'Installed' : canInstall ? 'Install' : 'Unavailable'}
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-[#091014]/10 bg-white p-4 shadow-sm">
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
