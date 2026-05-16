import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  List,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  Radio,
  Send,
  Settings,
  Square,
  Trash2,
  Volume2,
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
import {
  analyzeSentence,
  EMOTION_COLORS,
  EMOTION_LABELS,
  type EmotionId,
  type SentenceAnalysis,
  type Token,
} from './lib/sentiment';
import {
  DEFAULT_VOICE,
  hasGeminiKey,
  NATURAL_VOICES,
  SpeechApiError,
  synthesizeSpeech,
} from './lib/speechApi';

const CARD = 'rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)]';
const HISTORY_LIMIT = 40;

type ScreenId = 'main' | 'speech' | 'log' | 'settings';

const SCREENS: { id: ScreenId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'main', label: 'Surround', icon: Radio },
  { id: 'speech', label: 'Speech', icon: MessageSquareText },
  { id: 'log', label: 'Recent', icon: List },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const CARDINALS = ['Front', 'Front right', 'Right', 'Behind right', 'Behind', 'Behind left', 'Left', 'Front left'];
const directionLabel = (deg: number) => CARDINALS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
const timeAgo = (date: Date) => {
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
};

type SpeechLine = {
  id: string;
  text: string;
  analysis: SentenceAnalysis;
  confidence: number | null;
  timestamp: Date;
};

// Inline style for a single coloured word. Emotional words get a tinted chip so
// the highlighting is obvious; neutral words stay plain and legible.
function wordStyle(emotion: EmotionId): React.CSSProperties {
  if (emotion === 'neutral') return { color: 'var(--color-ink)' };
  const color = EMOTION_COLORS[emotion];
  return {
    color,
    fontWeight: 600,
    backgroundColor: `${color}22`,
    borderRadius: '4px',
    padding: '0 2px',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  };
}

// Renders a transcript as a run of per-word coloured spans.
function ColoredCaption({ tokens, dim }: { tokens: Token[]; dim?: boolean }) {
  return (
    <span className={dim ? 'opacity-60' : undefined}>
      {tokens.map((token, index) =>
        token.text.trim() === '' ? (
          <span key={index}>{token.text}</span>
        ) : (
          <span key={index} style={wordStyle(token.emotion)}>
            {token.text}
          </span>
        ),
      )}
    </span>
  );
}

// Overall sentence sentiment: dominant emotion + a negative↔positive meter.
function SentimentBadge({ analysis }: { analysis: SentenceAnalysis }) {
  const color = EMOTION_COLORS[analysis.overall];
  // Map polarity (-1..1) onto a 0..100 marker position.
  const markerPct = Math.round(((analysis.polarity + 1) / 2) * 100);
  return (
    <div className="flex items-center gap-2">
      <span
        className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ color, backgroundColor: `${color}1f` }}
      >
        {EMOTION_LABELS[analysis.overall]}
      </span>
      <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-gradient-to-r from-[#3b82f6] via-[#9ca3af] to-[#22c55e]">
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-ink"
          style={{ left: `${markerPct}%` }}
        />
      </span>
    </div>
  );
}

const LEGEND: EmotionId[] = ['happy', 'calm', 'sad', 'urgent', 'angry'];

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('main');
  const [liveEvents, setLiveEvents] = useState<SoundEvent[]>([]);
  const [history, setHistory] = useState<SoundEvent[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [dismissedAlertId, setDismissedAlertId] = useState<string | null>(null);
  const { canInstall, installed, promptInstall } = useInstallPrompt();

  const critical = liveEvents.find((event) => resolveEvent(event).isCritical);
  const showCriticalPopup = screen === 'main' && critical != null && dismissedAlertId !== critical.id;

  const handleRadarEventsChange = (nextEvents: SoundEvent[]) => {
    setDismissedAlertId(null);
    setLiveEvents(nextEvents);
  };

  const handleEventDetected = (event: SoundEvent) => {
    setHistory((prev) => [event, ...prev].slice(0, HISTORY_LIMIT));
  };

  return (
    <div className="flex h-dvh w-full justify-center bg-canvas text-ink sm:items-center sm:bg-[#070708] sm:p-6">
      <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-canvas sm:h-[860px] sm:max-h-full sm:w-[392px] sm:rounded-[3.2rem] sm:shadow-[0_40px_90px_-25px_rgba(0,0,0,0.95)] sm:ring-1 sm:ring-white/10">
        <main className="relative flex-1 min-h-0 pb-20">
          <Screen active={screen === 'main'}>
            <ARView onEventsChange={handleRadarEventsChange} onEventDetected={handleEventDetected} />
            {showCriticalPopup && critical && (
              <CriticalAlertPopup event={critical} onDismiss={() => setDismissedAlertId(critical.id)} />
            )}
          </Screen>

          <Screen active={screen === 'speech'}>
            <SpeechScreen />
          </Screen>

          <Screen active={screen === 'log'}>
            <RecentSoundsScreen events={history} onClear={() => setHistory([])} />
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

        <nav className="absolute inset-x-3 bottom-4 z-30 grid grid-cols-4 rounded-2xl border border-white/[0.06] bg-paper/80 px-2 backdrop-blur-xl shadow-lg shadow-black/20">
          {SCREENS.map(({ id, label, icon: Icon }) => {
            const active = screen === id;
            return (
              <button
                key={id}
                onClick={() => setScreen(id)}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition ${
                  active
                    ? 'text-primary'
                    : 'text-faint hover:text-mist'
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

function ScreenShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto bg-canvas text-ink">
      <div
        className="px-4 pb-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <header className="mb-5 border-b border-line pb-3">
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        </header>
        {children}
      </div>
    </div>
  );
}

function CriticalAlertPopup({ event, onDismiss }: { event: SoundEvent; onDismiss: () => void }) {
  const resolved = resolveEvent(event);
  return (
    <div
      className="pointer-events-none absolute inset-x-3 z-40 flex justify-center"
      style={{ top: 'calc(env(safe-area-inset-top) + 4rem)' }}
    >
      <section className="pointer-events-auto w-full max-w-sm animate-fade-in rounded-xl border border-danger/40 bg-paper p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-danger/30 bg-danger/10 text-danger">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-danger">
              Critical sound
            </p>
            <h2 className="mt-0.5 truncate text-base font-bold">{resolved.shortName}</h2>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-line bg-paper-2 px-3 py-2.5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-faint">Direction</p>
          <p className="mt-0.5 text-base font-semibold">
            {directionLabel(event.directionDeg)} &middot; {event.directionDeg}&deg;
          </p>
          <p className="mt-1 font-mono text-[11px] text-mist">
            {Math.round(event.confidence * 100)}% &middot; {Math.round(event.loudness * 100)} dB
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="mt-3 w-full rounded-lg bg-danger px-4 py-2 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          Dismiss
        </button>
      </section>
    </div>
  );
}

function SpeechScreen() {
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const [sttSupported, setSttSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [lines, setLines] = useState<SpeechLine[]>([]);
  const [interimText, setInterimText] = useState('');

  const [speakText, setSpeakText] = useState('I need a quiet route to the exit, please.');
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
  const [ttsState, setTtsState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [ttsError, setTtsError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const ttsReady = hasGeminiKey();

  // Live, colour-coded interim caption recomputed as words stream in.
  const interimAnalysis = interimText ? analyzeSentence(interimText) : null;

  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const supported = Boolean(SpeechRecognitionAPI);
    setSttSupported(supported);
    if (!supported) {
      setSpeechError(
        'Live speech-to-text needs Chrome, Edge, or Safari. Firefox and Brave block the speech engine.',
      );
    } else if (!window.isSecureContext) {
      // The Web Speech API only runs in a secure context. Phones hitting the dev
      // server over a LAN IP (http://192.168.x.x) land here and the mic stays dead.
      setSpeechError(
        'Speech-to-text needs a secure page. Open the app over https or on localhost to enable the mic.',
      );
    }
    return () => {
      recognitionRef.current?.abort();
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const startRecording = async () => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setSpeechError('Speech recognition is not available in this browser.');
      return;
    }
    if (!window.isSecureContext) {
      setSpeechError('Speech-to-text needs a secure page (https or localhost).');
      return;
    }

    // Ask for the mic explicitly first so a blocked permission surfaces as a
    // clear message instead of a silent dead mic. The recognition engine reuses
    // this grant, so it won't prompt twice.
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
      stream?.getTracks().forEach((track) => track.stop());
    } catch {
      setSpeechError('Microphone access is blocked. Allow the mic for this site, then tap the mic again.');
      return;
    }

    setSpeechError('');
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (!text) continue;
          setLines((prev) =>
            [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                text,
                analysis: analyzeSentence(text),
                confidence: result[0].confidence ?? null,
                timestamp: new Date(),
              },
              ...prev,
            ].slice(0, 24),
          );
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      // Benign during continuous listening — let onend auto-restart silently.
      if (event.error === 'no-speech' || event.error === 'aborted') return;

      // Anything else is fatal: stop the retry loop and tell the user why.
      isRecordingRef.current = false;
      setRecording(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setSpeechError('Microphone access is blocked. Allow the mic for this site, then tap the mic again.');
      } else if (event.error === 'network') {
        setSpeechError(
          'The speech engine is unreachable. Check your connection — Brave and Firefox block it, so use Chrome, Edge, or Safari.',
        );
      } else {
        setSpeechError(`Recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setInterimText('');
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          // browser may be busy
        }
      } else {
        setRecording(false);
      }
    };

    recognitionRef.current = recognition;
    isRecordingRef.current = true;
    recognition.start();
    setRecording(true);
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
    setInterimText('');
  };

  const stopSpeaking = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setTtsState('idle');
  };

  const speak = async () => {
    const text = speakText.trim();
    if (!text || ttsState === 'loading') return;

    stopSpeaking();
    setTtsError('');
    setTtsState('loading');

    try {
      const url = await synthesizeSpeech(text, selectedVoice);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => stopSpeaking();
      audio.onerror = () => {
        setTtsError('Could not play the synthesized audio.');
        stopSpeaking();
      };
      await audio.play();
      setTtsState('playing');
    } catch (err) {
      const message =
        err instanceof SpeechApiError ? err.message : 'Speech synthesis failed. Please try again.';
      setTtsError(message);
      setTtsState('idle');
    }
  };

  const speechStatus = recording
    ? 'Listening\u2026'
    : sttSupported
      ? 'Ready'
      : 'Speech recognition unavailable';

  return (
    <ScreenShell title="Speech">
      <section className={`${CARD} p-4`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold tracking-tight">Speech to text</h3>
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-mist">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  recording ? 'bg-danger animate-pulse' : 'bg-emerald-400'
                }`}
              />
              {speechStatus}
            </p>
          </div>
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={!sttSupported}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl transition active:scale-95 ${
              recording
                ? 'bg-danger text-white'
                : sttSupported
                  ? 'bg-primary text-white'
                  : 'bg-paper-2 text-faint'
            }`}
            aria-label={recording ? 'Stop recording' : 'Record speech'}
          >
            {recording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        </div>

        {/* Colour legend so the per-word highlighting is readable at a glance. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          {LEGEND.map((emotion) => (
            <span key={emotion} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: EMOTION_COLORS[emotion] }}
              />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
                {EMOTION_LABELS[emotion]}
              </span>
            </span>
          ))}
        </div>

        {speechError && (
          <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs leading-relaxed text-amber-100">
            {speechError}
          </p>
        )}

        {recording && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-white/80">
            <span className="flex items-end gap-0.5" aria-hidden="true">
              {[0, 1, 2, 3].map((bar) => (
                <span
                  key={bar}
                  className="audio-bar w-1 rounded-full bg-red-300"
                  style={{ animationDelay: `${bar * 0.12}s` }}
                />
              ))}
            </span>
            <p className="text-sm leading-relaxed">Tap the mic again to stop.</p>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {interimAnalysis && (
            <div
              className="rounded-lg border border-primary/20 bg-primary/5 pl-3 pr-3 py-2.5"
              style={{ borderLeft: `3px solid ${EMOTION_COLORS[interimAnalysis.overall]}` }}
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <SentimentBadge analysis={interimAnalysis} />
                <span className="shrink-0 font-mono text-[10px] text-faint">live</span>
              </div>
              <p className="text-sm leading-relaxed">
                <ColoredCaption tokens={interimAnalysis.tokens} dim />
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
              </p>
            </div>
          )}

          {lines.length === 0 && !interimAnalysis ? (
            <div className="rounded-lg border border-dashed border-line bg-paper-2 px-4 py-6 text-center text-sm text-faint">
              Captions appear here, coloured word by word.
            </div>
          ) : (
            lines.map((line) => (
              <div
                key={line.id}
                className="rounded-lg border border-line bg-paper-2 pl-3 pr-3 py-2.5"
                style={{ borderLeft: `3px solid ${EMOTION_COLORS[line.analysis.overall]}` }}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <SentimentBadge analysis={line.analysis} />
                  <span className="shrink-0 font-mono text-[10px] text-faint">
                    {line.confidence == null ? timeAgo(line.timestamp) : `${Math.round(line.confidence * 100)}%`}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">
                  <ColoredCaption tokens={line.analysis.tokens} />
                </p>
              </div>
            ))
          )}
        </div>

        {lines.length > 0 && (
          <button
            onClick={() => setLines([])}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper-2 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-faint transition hover:text-ink"
          >
            <Trash2 size={13} />
            Clear
          </button>
        )}
      </section>

      <section className={`mt-4 ${CARD} p-4`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold tracking-tight">Text to speech</h3>
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-mist">
              <Volume2 size={11} />
              {ttsState === 'playing' ? 'Playing' : ttsState === 'loading' ? 'Synthesizing\u2026' : 'Natural voice'}
            </p>
          </div>
        </div>

        {!ttsReady && (
          <p className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs leading-relaxed text-amber-100">
            Add <span className="font-mono">VITE_GEMINI_API_KEY</span> to your environment to enable the
            natural voice.
          </p>
        )}

        {ttsError && (
          <p className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs leading-relaxed text-amber-100">
            {ttsError}
          </p>
        )}

        <textarea
          value={speakText}
          onChange={(event) => setSpeakText(event.target.value)}
          rows={4}
          className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm leading-relaxed text-ink outline-none transition placeholder:text-faint focus:border-primary"
          placeholder="Type what you want spoken aloud"
        />

        <div className="mt-3 flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-faint">
              Voice
            </span>
            <select
              value={selectedVoice}
              onChange={(event) => setSelectedVoice(event.target.value)}
              className="w-full rounded-lg border border-line bg-paper-2 py-2.5 pl-12 pr-3 text-sm text-ink outline-none focus:border-primary"
            >
              {NATURAL_VOICES.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} -   {voice.tone}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={ttsState === 'idle' ? speak : stopSpeaking}
            disabled={(!speakText.trim() || !ttsReady) && ttsState === 'idle'}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg transition active:scale-95 ${
              ttsState !== 'idle'
                ? 'bg-danger text-white'
                : speakText.trim() && ttsReady
                  ? 'bg-primary text-white'
                  : 'bg-paper-2 text-faint'
            }`}
            aria-label={ttsState === 'idle' ? 'Speak text' : 'Stop speaking'}
          >
            {ttsState === 'loading' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : ttsState === 'playing' ? (
              <Square size={15} fill="currentColor" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </section>
    </ScreenShell>
  );
}

function RecentSoundsScreen({ events, onClear }: { events: SoundEvent[]; onClear: () => void }) {
  return (
    <ScreenShell title="Recent">
      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-paper-2 px-5 py-8 text-center">
          <p className="text-base font-bold tracking-tight">No sounds yet</p>
          <p className="mt-1 text-sm leading-relaxed text-mist">
            Detections from Surround Sound appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const resolved = resolveEvent(event);
            return (
              <article
                key={event.id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  resolved.isCritical ? 'border-danger/30 bg-danger/5' : 'border-line bg-paper'
                }`}
              >
                <SoundBadge resolved={resolved} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-sm font-bold tracking-tight">{resolved.shortName}</h3>
                    <span className="shrink-0 font-mono text-[10px] text-faint">
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-mist">
                    {directionLabel(event.directionDeg)} &middot; {event.directionDeg}&deg; &middot; {Math.round(event.confidence * 100)}%
                  </p>
                </div>
              </article>
            );
          })}
          <button
            onClick={onClear}
            className="mt-2 w-full rounded-lg border border-line bg-paper-2 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-faint transition hover:text-ink"
          >
            Clear all
          </button>
        </div>
      )}
    </ScreenShell>
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
    <ScreenShell title="Settings">
      <section className={`${CARD} p-4`}>
        <h3 className="mb-3 text-sm font-bold tracking-tight">Alert types</h3>
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
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
                  enabled
                    ? 'border-primary/50 text-ink'
                    : 'border-line text-faint'
                }`}
              >
                <span className={`text-base ${enabled ? '' : 'opacity-40 grayscale'}`}>
                  {categoryMetadata[category].icon}
                </span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
                  {categoryMetadata[category].shortName}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`${CARD} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight">Haptics</h3>
          <button
            onClick={() => onSettingsChange((prev) => ({ ...prev, haptics: !prev.haptics }))}
            className={`h-6 w-10 rounded-full p-0.5 transition ${settings.haptics ? 'bg-primary' : 'bg-paper-2'}`}
            aria-label="Toggle haptics"
            aria-pressed={settings.haptics}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white transition ${settings.haptics ? 'translate-x-4' : ''}`}
            />
          </button>
        </div>
        <div className={`space-y-1 transition ${settings.haptics ? '' : 'pointer-events-none opacity-40'}`}>
          {CATEGORY_ORDER.slice(0, 4).map((category) => (
            <div
              key={category}
              className="flex items-center justify-between rounded-lg border border-line bg-paper-2 px-3 py-2"
            >
              <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
                <span className="text-sm">{categoryMetadata[category].icon}</span>
                {categoryMetadata[category].shortName}
              </span>
              <span className="font-mono text-[10px] text-faint">
                {categoryHaptics[category]?.label || 'Default'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </ScreenShell>
  );
}

function Screen({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={active ? 'absolute inset-0' : 'hidden'}>{children}</div>;
}
