import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, MessageSquare, AlertCircle } from 'lucide-react';
import { SoundEvent } from '../types';

interface MicVisualizerProps {
  onVolumeTrigger: (db: number) => void;
  onLiveCaption: (text: string) => void;
}

export default function MicVisualizer({ onVolumeTrigger, onLiveCaption }: MicVisualizerProps) {
  const [isListening, setIsListening] = useState(false);
  const [dbLevel, setDbLevel] = useState(0);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<string[]>([]);
  const [recognitionActive, setRecognitionActive] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          const cleanText = finalTranscript.trim();
          onLiveCaption(cleanText);
          setTranscriptSegments((prev) => [cleanText, ...prev].slice(0, 5));
        }
      };

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
      };

      rec.onend = () => {
        if (isListening) {
          try {
            rec.start();
          } catch (_) {}
        } else {
          setRecognitionActive(false);
        }
      };

      recognitionRef.current = rec;
    }
  }, [isListening]);

  // Start Mic and Visualizer
  const startMic = async () => {
    try {
      setHasPermissionError(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      
      // Start browser Speech Recognition if available
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setRecognitionActive(true);
        } catch (e) {
          console.warn('Recognition start failed:', e);
        }
      }

      // Start animation loop
      drawOscilloscope();
    } catch (err) {
      console.error('Mic access denied:', err);
      setHasPermissionError(true);
      setIsListening(false);
    }
  };

  // Stop Mic and Visualizer
  const stopMic = () => {
    setIsListening(false);
    setRecognitionActive(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().ignore();
    }

    setDbLevel(0);
  };

  // Sound Wave Drawing Loop
  const drawOscilloscope = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      // Raw Amplitude volume conversion (RMS)
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128;
        sumSquares += val * val;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);
      const db = Math.round(rms * 120); // Scale up for demo aesthetic
      
      setDbLevel(Math.min(db, 110));
      if (db > 20) {
        onVolumeTrigger(db);
      }

      // Render oscilloscope waveform
      ctx.fillStyle = '#0f172a'; // slate-900 background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = db > 50 ? '#f43f5e' : '#0ea5e9'; // Red when loud, blue normal
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Horizontal reference centerline
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left shadow-xl h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Volume2 className="text-sky-400" size={24} />
            <h3 className="text-lg font-bold text-white">Core Mic Classification Stream</h3>
          </div>
          
          <button
            onClick={isListening ? stopMic : startMic}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow ${
              isListening
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105'
            }`}
          >
            {isListening ? (
              <>
                <MicOff size={16} />
                <span>Disable Mic</span>
              </>
            ) : (
              <>
                <Mic size={16} />
                <span>Enable Mic Live</span>
              </>
            )}
          </button>
        </div>

        {hasPermissionError && (
          <div className="bg-red-950/40 border border-red-900/50 p-4 rounded-xl flex gap-3 text-red-200 text-xs mb-4">
            <AlertCircle size={18} className="shrink-0 text-red-400" />
            <p>
              Microphone permission denied. Click raw triggers on the panel or enable device hardware permissions in your URL address bar.
            </p>
          </div>
        )}

        {/* Dynamic Canvas Oscilloscope */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-inner h-24 mb-4">
          <canvas id="sound_oscilloscope_raw" ref={canvasRef} width={400} height={96} className="w-full h-full block" />
          <div className="absolute top-2 right-3 flex items-center gap-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${isListening ? 'bg-emerald-500 animate-ping' : 'bg-slate-600'}`} />
            <span>{isListening ? '16kHz Streaming' : 'Offline'}</span>
          </div>
        </div>

        {/* Live Decibel Tracker */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block font-medium">Input Volume level</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-bold font-mono transition-colors ${dbLevel > 55 ? 'text-red-400' : 'text-emerald-400'}`}>
                {dbLevel}
              </span>
              <span className="text-xs text-slate-500">dB</span>
            </div>
            {/* Decibel progress indicator */}
            <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${dbLevel > 55 ? 'bg-gradient-to-r from-orange-400 to-red-500' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'}`}
                style={{ width: `${Math.min(dbLevel, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block font-medium">Auto Translation Engine</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-base font-bold text-sky-300 font-mono">
                {recognitionActive ? 'Real-Time Transcribing' : 'Web Speech Offline'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 lines-clamp-2 leading-tight">
              Uses speech-to-text to print captions for spoken dialogue instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Subtitles & Transcription Segment Logs */}
      <div>
        <div className="border-t border-slate-800/60 pt-4 flex gap-2 items-center">
          <MessageSquare className="text-indigo-400 shrink-0" size={16} />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
            Hearing Subtitle Log (Dialogue)
          </span>
        </div>

        <div className="mt-2 text-sm text-slate-300 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50 min-h-[50px] font-mono text-[11px] leading-relaxed">
          {transcriptSegments.length > 0 ? (
            <div className="space-y-1">
              {transcriptSegments.map((segment, idx) => (
                <p key={idx} className={idx === 0 ? 'text-indigo-300 font-semibold' : 'text-slate-500'}>
                  &gt; "{segment}"
                </p>
              ))}
            </div>
          ) : (
            <span className="text-slate-600">
              [Dialogue transcripts appear here in real-time when Speech is enabled and spoken into mic]
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
