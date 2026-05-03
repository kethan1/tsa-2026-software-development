import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  History,
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
  sampleLog,
} from './data';
import ARView from './components/ARView';
import { SoundBadge, UrgencyTag } from './components/SoundBadge';
import { useInstallPrompt } from './pwa';

// One shared dark surface so every screen reads as the same product.
const CARD = 'rounded-2xl border border-white/10 bg-white/[0.05] shadow-[0_18px_60px_rgba(0,0,0,0.32)]';
const HISTORY_LIMIT = 40;

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

type GeminiAnalyzeAudioResponse = {
  isSpeech?: boolean;
  label?: string;
  icon?: string;
  urgency?: string;
  confidence?: number;
  description?: string;
  transcript?: string;
  speaker?: string;
  emotion?: string;
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
  // Live events currently on the radar (drive the critical popup on Surround).
  const [liveEvents, setLiveEvents] = useState<SoundEvent[]>([]);
  // Persistent, accumulating feed shown on the Recent screen.
  const [history, setHistory] = useState<SoundEvent[]>(() => sampleLog());
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [dismissedAlertId, setDismissedAlertId] = useState<string | null>(null);
  const { canInstall, installed, promptInstall } = useInstallPrompt();

  const critical = liveEvents.find((event) => resolveEvent(event).isCritical);
  const showCriticalPopup = screen === 'main' && critical != null && dismissedAlertId !== critical.id;

  const handleRadarEventsChange = (nextEvents: SoundEvent[]) => {
    setDismissedAlertId(null);
    setLiveEvents(nextEvents);
  };

  // Every fresh detection on Surround flows straight into the Recent log.
  const handleEventDetected = (event: SoundEvent) => {
    setHistory((prev) => [event, ...prev].slice(0, HISTORY_LIMIT));
  };

  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden bg-[#06090c] text-white shadow-2xl sm:my-5 sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] sm:border sm:border-white/10">
        <main className="relative flex-1 overflow-hidden">
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

        <nav
          className="z-30 grid shrink-0 grid-cols-4 gap-1 border-t border-white/10 bg-[#070d12]/95 px-3 pt-2 backdrop-blur-xl"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          {SCREENS.map(({ id, label, icon: Icon }) => {
            const active = screen === id;
            return (
              <button
                key={id}
                onClick={() => setScreen(id)}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-wide transition ${
                  active
                    ? 'bg-cyan-300 text-[#061015] shadow-[0_0_22px_rgba(103,232,249,0.30)]'
                    : 'text-white/50 hover:bg-white/10 hover:text-white'
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

/** Shared header so Speech / Recent / Settings open identically. */
function ScreenShell({
  eyebrow,
  title,
  icon: Icon,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto bg-[#06090c] text-white">
      <div
        className="px-5 pb-10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.35rem)' }}
      >
        <header className="mb-5 flex items-end justify-between gap-3 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300/70">
              {eyebrow}
            </p>
            <h2 className="mt-1.5 font-display text-[2rem] font-black leading-none tracking-tight">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-200/90">
              <Icon size={20} />
            </span>
          </div>
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
      style={{ top: 'calc(env(safe-area-inset-top) + 4.25rem)' }}
    >
      <section className="pointer-events-auto w-full max-w-sm animate-fade-in rounded-3xl border border-red-300/35 bg-[#1d0b0d]/94 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl">
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef('');
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

  const analyzeRecording = async (blob: Blob) => {
    if (blob.size < 800) {
      setSpeechError('The recording was too short to analyze.');
      return;
    }

    setAnalyzing(true);
    setSpeechError('');
    try {
      const audioBase64 = await blobToBase64(blob);
      const response = await fetch('/api/analyze-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType: blob.type || 'audio/webm' }),
      });
      const payload = (await response.json().catch(() => ({}))) as GeminiAnalyzeAudioResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Gemini could not analyze the recording.');

      const transcript = payload.transcript?.trim();
      const fallback = [payload.label, payload.description].filter(Boolean).join(': ');
      const text = transcript || fallback || 'Audio captured, but no clear speech was detected.';
      const speaker = payload.speaker ? `${payload.speaker}: ` : '';
      setLines((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          text: `${speaker}${text}`,
          emotion: normalizeGeminiEmotion(payload.emotion, text),
          confidence: typeof payload.confidence === 'number' ? payload.confidence : null,
          timestamp: new Date(),
        },
        ...prev,
      ].slice(0, 24));
    } catch (error) {
      setSpeechError(error instanceof Error ? error.message : 'Gemini speech analysis failed.');
    } finally {
      setAnalyzing(false);
    }
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
      if (!response.ok || !payload.audioBase64) throw new Error(payload.error || 'Gemini did not return speech audio.');

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
      setTtsError(error instanceof Error ? error.message : 'Gemini speech synthesis failed.');
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
    ? 'Listening…'
    : analyzing
      ? 'Transcribing with Gemini'
      : speechSupported
        ? 'Ready'
        : 'Microphone unavailable';

  return (
    <ScreenShell eyebrow="Caption · color · speak" title="Speech" icon={MessageSquareText}>
      <section className={`${CARD} p-4`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold tracking-tight">Speech to text</h3>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              <span className={`h-1.5 w-1.5 rounded-full ${recording ? 'bg-red-400 animate-pulse' : analyzing ? 'bg-cyan-300 animate-pulse' : 'bg-emerald-400'}`} />
              {speechStatus}
            </p>
          </div>
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={!speechSupported || analyzing}
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-full transition active:scale-95 ${
              recording
                ? 'bg-red-500 text-white shadow-[0_0_34px_rgba(239,68,68,0.5)]'
                : speechSupported && !analyzing
                  ? 'bg-cyan-300 text-[#061015] shadow-[0_0_34px_rgba(103,232,249,0.32)]'
                  : 'bg-white/10 text-white/30'
            }`}
            aria-label={recording ? 'Stop recording speech' : 'Record speech for Gemini analysis'}
          >
            {recording ? <MicOff size={24} /> : <Mic size={24} />}
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

        {recording && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-white/80">
            <span className="flex items-end gap-0.5" aria-hidden="true">
              {[0, 1, 2, 3].map((bar) => (
                <span key={bar} className="audio-bar w-1 rounded-full bg-red-300" style={{ animationDelay: `${bar * 0.12}s` }} />
              ))}
            </span>
            <p className="text-sm leading-relaxed">Tap the mic again to send this clip to Gemini.</p>
          </div>
        )}

        <div className="mt-4 space-y-2.5">
          {lines.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/14 bg-black/18 px-4 py-7 text-center text-sm text-white/45">
              Captions will appear here
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

      <section className={`mt-4 ${CARD} p-4`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold tracking-tight">Text to speech</h3>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              {speaking ? 'Playing Gemini audio' : 'Gemini voice output'}
            </p>
          </div>
          <Volume2 size={22} className="text-cyan-200/90" />
        </div>

        {ttsError && (
          <p className="mb-3 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
            {ttsError}
          </p>
        )}

        <textarea
          value={speakText}
          onChange={(event) => setSpeakText(event.target.value)}
          rows={4}
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/28 px-4 py-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/50"
          placeholder="Type what you want spoken aloud"
        />

        <div className="mt-3 flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">Voice</span>
            <select
              value={ttsVoice}
              onChange={(event) => setTtsVoice(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/35 py-2.5 pl-14 pr-3 text-sm text-white outline-none focus:border-cyan-300/50"
            >
              {GEMINI_TTS_VOICES.map((voice) => (
                <option key={voice} value={voice}>{voice}</option>
              ))}
            </select>
          </label>
          <button
            onClick={speaking ? stopSpeaking : speak}
            disabled={!speakText.trim()}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition active:scale-95 ${
              speaking
                ? 'bg-red-500 text-white'
                : speakText.trim()
                  ? 'bg-cyan-300 text-[#061015] shadow-[0_0_26px_rgba(103,232,249,0.28)]'
                  : 'bg-white/10 text-white/30'
            }`}
            aria-label={speaking ? 'Stop speaking' : 'Speak text with Gemini'}
          >
            {speaking ? <Square size={17} fill="currentColor" /> : <Send size={18} />}
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
  const criticalCount = events.filter((event) => resolveEvent(event).isCritical).length;

  return (
    <ScreenShell
      eyebrow="Timestamped log"
      title="Recent"
      icon={History}
      action={
        events.length > 0 ? (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/65 transition hover:bg-white/12 hover:text-white"
          >
            <Trash2 size={13} />
            Clear
          </button>
        ) : undefined
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <div className={`${CARD} p-3.5`}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Detected</p>
          <p className="mt-1 font-display text-2xl font-black">{events.length}</p>
        </div>
        <div className={`${CARD} p-3.5`}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Critical</p>
          <p className={`mt-1 font-display text-2xl font-black ${criticalCount > 0 ? 'text-[#ff5247]' : 'text-white'}`}>
            {criticalCount}
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/14 bg-white/[0.03] px-5 py-10 text-center">
          <p className="font-display text-lg font-bold tracking-tight">No sounds yet</p>
          <p className="mt-2 text-sm leading-relaxed text-white/45">
            Detections from Surround Sound land here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {events.map((event) => {
            const resolved = resolveEvent(event);
            return (
              <article
                key={event.id}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${
                  resolved.isCritical ? 'border-[#ff5247]/35 bg-[#ff5247]/[0.07]' : 'border-white/10 bg-white/[0.05]'
                }`}
              >
                <SoundBadge resolved={resolved} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate font-display text-base font-bold tracking-tight">{resolved.name}</h3>
                    <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-white/40">
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <p className="truncate font-mono text-[11px] uppercase tracking-[0.1em] text-white/45">
                      {directionLabel(event.directionDeg)} · {event.directionDeg}° · {Math.round(event.confidence * 100)}%
                    </p>
                    <UrgencyTag resolved={resolved} />
                  </div>
                </div>
              </article>
            );
          })}
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
    <ScreenShell eyebrow="Sensitivity · alerts · haptics" title="Settings" icon={Settings}>
      <section className={`${CARD} p-4`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-300/12 text-cyan-200">
              <Download size={19} />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold tracking-tight">Install app</h3>
              <p className="text-xs leading-relaxed text-white/45">
                {installed ? 'SenseSync is installed on this device.' : 'Add SenseSync to your home screen.'}
              </p>
            </div>
          </div>
          <button
            onClick={onInstall}
            disabled={!canInstall}
            className={`shrink-0 rounded-full px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] transition ${
              canInstall ? 'bg-cyan-300 text-[#061015] active:scale-95' : 'bg-white/8 text-white/35'
            }`}
          >
            {installed ? 'Installed' : canInstall ? 'Install' : 'Unavailable'}
          </button>
        </div>
      </section>

      <section className={`mt-4 ${CARD} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal size={18} className="text-cyan-200/90" />
            <h3 className="font-display text-lg font-bold tracking-tight">Sensitivity</h3>
          </div>
          <span className="font-mono text-sm font-black text-cyan-200">{Math.round(settings.sensitivity * 100)}%</span>
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
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
          Higher picks up quieter, more distant sounds
        </p>
      </section>

      <section className={`mt-4 ${CARD} p-4`}>
        <div className="mb-3 flex items-center gap-2.5">
          <Volume2 size={18} className="text-cyan-200/90" />
          <h3 className="font-display text-lg font-bold tracking-tight">Alert types</h3>
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
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition ${
                  enabled
                    ? 'border-cyan-300/50 bg-cyan-300/12 text-white'
                    : 'border-white/10 bg-white/[0.03] text-white/40'
                }`}
              >
                <span className={`text-lg transition ${enabled ? '' : 'opacity-40 grayscale'}`}>
                  {categoryMetadata[category].icon}
                </span>
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em]">
                  {categoryMetadata[category].shortName}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`mt-4 ${CARD} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Watch size={18} className="text-cyan-200/90" />
            <h3 className="font-display text-lg font-bold tracking-tight">Haptics</h3>
          </div>
          <button
            onClick={() => onSettingsChange((prev) => ({ ...prev, haptics: !prev.haptics }))}
            className={`h-7 w-12 rounded-full p-1 transition ${settings.haptics ? 'bg-cyan-300' : 'bg-white/15'}`}
            aria-label="Toggle haptics"
            aria-pressed={settings.haptics}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white shadow transition ${settings.haptics ? 'translate-x-5' : ''}`}
            />
          </button>
        </div>
        <div className={`space-y-1.5 transition ${settings.haptics ? '' : 'pointer-events-none opacity-40'}`}>
          {CATEGORY_ORDER.slice(0, 4).map((category) => (
            <div
              key={category}
              className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2"
            >
              <span className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.1em]">
                <span className="text-sm">{categoryMetadata[category].icon}</span>
                {categoryMetadata[category].shortName}
              </span>
              <span className="font-mono text-[10px] text-white/45">
                {categoryHaptics[category]?.label || 'Default rhythm'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">
        SenseSync · Sound awareness for the Deaf &amp; HoH
      </p>
    </ScreenShell>
  );
}

function Screen({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={active ? 'h-full' : 'hidden'}>{children}</div>;
}
