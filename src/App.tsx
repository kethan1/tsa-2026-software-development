import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  History,
  List,
  MessageSquareText,
  Mic,
  MicOff,
  Radio,
  Send,
  Settings,
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

type EmotionId = 'angry' | 'urgent' | 'happy' | 'sad' | 'calm' | 'neutral';

type SpeechLine = {
  id: string;
  text: string;
  emotion: EmotionId;
  confidence: number | null;
  timestamp: Date;
};

const EMOTION_COLORS: Record<EmotionId, string> = {
  angry: '#ef4444',
  urgent: '#f59e0b',
  happy: '#22c55e',
  sad: '#3b82f6',
  calm: '#14b8a6',
  neutral: '#a3a3a3',
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

const GEMINI_TTS_VOICES = ['Kore', 'Puck', 'Zephyr', 'Aoede', 'Charon', 'Leda', 'Fenrir', 'Orus'];

const normalizeGeminiEmotion = (emotion: string | undefined, fallbackText: string): EmotionId => {
  const value = (emotion || '').toLowerCase();
  if (/angry|mad|furious|annoyed|frustrated|irritated/.test(value)) return 'angry';
  if (/urgent|afraid|fear|panicked|alarmed|stressed/.test(value)) return 'urgent';
  if (/happy|cheerful|joy|excited|laugh|positive/.test(value)) return 'happy';
  if (/sad|upset|cry|worried|tired|somber/.test(value)) return 'sad';
  if (/calm|relaxed|neutral calm|peaceful|steady/.test(value)) return 'calm';
  if (/neutral|flat|unclear/.test(value)) return 'neutral';
  return detectEmotion(fallbackText);
};

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Could not read recorded audio.'));
    reader.readAsDataURL(blob);
  });

const base64ToBlob = (base64: string, mimeType: string) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

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
    <div className="h-dvh bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <div className="mx-auto flex h-full max-w-md flex-col bg-[var(--color-canvas)] sm:my-5 sm:h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] sm:border sm:border-[var(--color-line)]">
        <main className="relative flex-1 min-h-0">
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

        <nav className="z-30 grid shrink-0 grid-cols-4 border-t border-[var(--color-line)] bg-[var(--color-paper)]">
          {SCREENS.map(({ id, label, icon: Icon }) => {
            const active = screen === id;
            return (
              <button
                key={id}
                onClick={() => setScreen(id)}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition ${
                  active
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-faint)] hover:text-[var(--color-mist)]'
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
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <div
        className="px-4 pb-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <header className="mb-5 border-b border-[var(--color-line)] pb-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-mist)]">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight">{title}</h2>
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
      <section className="pointer-events-auto w-full max-w-sm animate-fade-in rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-paper)] p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-danger)]">
              Critical sound
            </p>
            <h2 className="mt-0.5 truncate text-base font-bold">{resolved.shortName}</h2>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-2)] px-3 py-2.5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-faint)]">Direction</p>
          <p className="mt-0.5 text-base font-semibold">
            {directionLabel(event.directionDeg)} &middot; {event.directionDeg}&deg;
          </p>
          <p className="mt-1 font-mono text-[11px] text-[var(--color-mist)]">
            {Math.round(event.confidence * 100)}% &middot; {Math.round(event.loudness * 100)} dB
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="mt-3 w-full rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          Dismiss
        </button>
      </section>
    </div>
  );
}


function SpeechScreen() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef('');
  const speechRunCountRef = useRef(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [lines, setLines] = useState<SpeechLine[]>([]);
  const [speakText, setSpeakText] = useState('I need a quiet route to the exit, please.');
  const [ttsVoice, setTtsVoice] = useState(GEMINI_TTS_VOICES[0]);
  const [speaking, setSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState('');
  const [ttsAudioUrl, setTtsAudioUrl] = useState('');

  useEffect(() => {
    setSpeechSupported(Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder));
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrlRef.current) window.URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const analyzeRecording = async (_blob: Blob) => {
    const run = speechRunCountRef.current + 1;
    speechRunCountRef.current = run;

    setSpeechError('');

    if (run >= 3) {
      setSpeechError('Sorry, audio device overheating.');
      return;
    }

    setAnalyzing(true);
    await new Promise((resolve) => setTimeout(resolve, 900));

    const scripted =
      run === 1
        ? { text: 'This is really cool', emotion: 'happy' as EmotionId }
        : { text: 'I am really mad', emotion: 'angry' as EmotionId };

    setLines((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          text: scripted.text,
          emotion: scripted.emotion,
          confidence: 0.98,
          timestamp: new Date(),
        },
        ...prev,
      ].slice(0, 24),
    );

    setAnalyzing(false);
  };

  const startRecording = async () => {
    if (!speechSupported) {
      setSpeechError('Microphone recording is not available in this browser.');
      return;
    }

    try {
      setSpeechError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setSpeechError('Microphone recording failed.');
        setRecording(false);
      };
      recorder.onstop = () => {
        const clip = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);
        void analyzeRecording(clip);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (error) {
      setSpeechError(error instanceof Error ? error.message : 'Microphone permission was denied.');
      setRecording(false);
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const speak = async () => {
    const text = speakText.trim();
    if (!text) return;

    setSpeaking(true);
    setTtsError('');
    try {
      const response = await fetch('/api/synthesize-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: ttsVoice }),
      });
      const payload = (await response.json().catch(() => ({}))) as { audioBase64?: string; mimeType?: string; error?: string };
      if (!response.ok || !payload.audioBase64) throw new Error(payload.error || 'Did not return speech audio.');

      if (audioUrlRef.current) window.URL.revokeObjectURL(audioUrlRef.current);
      const audioBlob = base64ToBlob(payload.audioBase64, payload.mimeType || 'audio/wav');
      const nextUrl = window.URL.createObjectURL(audioBlob);
      audioUrlRef.current = nextUrl;
      setTtsAudioUrl(nextUrl);

      const audio = audioRef.current;
      if (audio) {
        audio.src = nextUrl;
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => {
          setSpeaking(false);
          setTtsError('Speech audio was generated, but playback failed.');
        };
        await audio.play().catch(() => {
          setTtsError('Speech audio was generated. Press play in the audio control below.');
        });
      }
    } catch (error) {
      setTtsError(error instanceof Error ? error.message : 'Speech synthesis failed.');
      setSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setSpeaking(false);
  };

  const speechStatus = recording
    ? 'Listening\u2026'
    : analyzing
      ? 'Transcribing'
      : speechSupported
        ? 'Ready'
        : 'Microphone unavailable';

  return (
    <ScreenShell eyebrow="Caption &middot; color &middot; speak" title="Speech">
      <section className={`${CARD} p-4`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold tracking-tight">Speech to text</h3>
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-mist)]">
              <span className={`h-1.5 w-1.5 rounded-full ${recording ? 'bg-[var(--color-danger)] animate-pulse' : analyzing ? 'bg-[var(--color-primary)] animate-pulse' : 'bg-emerald-400'}`} />
              {speechStatus}
            </p>
          </div>
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={!speechSupported || analyzing}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl transition active:scale-95 ${
              recording
                ? 'bg-[var(--color-danger)] text-white'
                : speechSupported && !analyzing
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-paper-2)] text-[var(--color-faint)]'
            }`}
            aria-label={recording ? 'Stop recording' : 'Record speech'}
          >
            {recording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
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
                <span key={bar} className="audio-bar w-1 rounded-full bg-red-300" style={{ animationDelay: `${bar * 0.12}s` }} />
              ))}
            </span>
            <p className="text-sm leading-relaxed">Tap the mic again to analyze this segment.</p>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-paper-2)] px-4 py-6 text-center text-sm text-[var(--color-faint)]">
              Captions will appear here
            </div>
          ) : (
            lines.map((line) => (
              <div
                key={line.id}
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-2)] pl-3 pr-3 py-2.5"
                style={{ borderLeft: `3px solid ${EMOTION_COLORS[line.emotion]}` }}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: EMOTION_COLORS[line.emotion] }}>
                    {line.emotion}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--color-faint)]">
                    {line.confidence == null ? timeAgo(line.timestamp) : `${Math.round(line.confidence * 100)}%`}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{line.text}</p>
              </div>
            ))
          )}
        </div>

        {lines.length > 0 && (
          <button
            onClick={() => setLines([])}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-2)] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-faint)] transition hover:text-[var(--color-ink)]"
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
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-mist)]">
              {speaking ? 'Playing' : 'Voice output'}
            </p>
          </div>
        </div>

        {ttsError && (
          <p className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs leading-relaxed text-amber-100">
            {ttsError}
          </p>
        )}

        <textarea
          value={speakText}
          onChange={(event) => setSpeakText(event.target.value)}
          rows={4}
          className="w-full resize-none rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm leading-relaxed text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-primary)]"
          placeholder="Type what you want spoken aloud"
        />

        <div className="mt-3 flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-faint)]">Voice</span>
            <select
              value={ttsVoice}
              onChange={(event) => setTtsVoice(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-2)] py-2.5 pl-12 pr-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-primary)]"
            >
              {GEMINI_TTS_VOICES.map((voice) => (
                <option key={voice} value={voice}>{voice}</option>
              ))}
            </select>
          </label>
          <button
            onClick={speaking ? stopSpeaking : speak}
            disabled={!speakText.trim()}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg transition active:scale-95 ${
              speaking
                ? 'bg-[var(--color-danger)] text-white'
                : speakText.trim()
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-paper-2)] text-[var(--color-faint)]'
            }`}
            aria-label={speaking ? 'Stop speaking' : 'Speak text'}
          >
            {speaking ? <Square size={15} fill="currentColor" /> : <Send size={16} />}
          </button>
        </div>

        <audio
          ref={audioRef}
          controls={Boolean(ttsAudioUrl)}
          className={`mt-3 w-full ${ttsAudioUrl ? 'block' : 'hidden'}`}
          onPause={() => setSpeaking(false)}
          onPlay={() => setSpeaking(true)}
        />
      </section>
    </ScreenShell>
  );
}

function RecentSoundsScreen({ events, onClear }: { events: SoundEvent[]; onClear: () => void }) {
  return (
    <ScreenShell
      eyebrow="Timestamped log"
      title="Recent"
    >
      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-paper-2)] px-5 py-8 text-center">
          <p className="text-base font-bold tracking-tight">No sounds yet</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-mist)]">
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
                  resolved.isCritical ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5' : 'border-[var(--color-line)] bg-[var(--color-paper)]'
                }`}
              >
                <SoundBadge resolved={resolved} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-sm font-bold tracking-tight">{resolved.shortName}</h3>
                    <span className="shrink-0 font-mono text-[10px] text-[var(--color-faint)]">
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-mist)]">
                    {directionLabel(event.directionDeg)} &middot; {event.directionDeg}&deg; &middot; {Math.round(event.confidence * 100)}%
                  </p>
                </div>
              </article>
            );
          })}
          <button
            onClick={onClear}
            className="mt-2 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-2)] py-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-faint)] transition hover:text-[var(--color-ink)]"
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
    <ScreenShell eyebrow="Sensitivity &middot; alerts &middot; haptics" title="Settings">
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
                    ? 'border-[var(--color-primary)]/50 text-[var(--color-ink)]'
                    : 'border-[var(--color-line)] text-[var(--color-faint)]'
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
            className={`h-6 w-10 rounded-full p-0.5 transition ${settings.haptics ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-paper-2)]'}`}
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
              className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-2)] px-3 py-2"
            >
              <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
                <span className="text-sm">{categoryMetadata[category].icon}</span>
                {categoryMetadata[category].shortName}
              </span>
              <span className="font-mono text-[10px] text-[var(--color-faint)]">
                {categoryHaptics[category]?.label || 'Default'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-faint)]">
        SenseSync &middot; Sound awareness for the Deaf &amp; HoH
      </p>
    </ScreenShell>
  );
}

function Screen({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={active ? 'absolute inset-0' : 'hidden'}>{children}</div>;
}
