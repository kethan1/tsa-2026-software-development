import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Eye, Sparkles, HelpCircle, AlertTriangle, FileText, Smile } from 'lucide-react';

interface CameraAIProps {
  onSpeak: (text: string) => void;
}

export default function CameraAI({ onSpeak }: CameraAIProps) {
  const [streamActive, setStreamActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<'scene' | 'ocr' | 'hazard' | 'faces'>('scene');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup streaming webcam
  const startCamera = async () => {
    try {
      setErrorMessage('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamActive(true);
      }
    } catch (err) {
      console.error('Webcam access error:', err);
      setErrorMessage('Could not open webcam. Try uploading a saved photo below instead.');
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setStreamActive(false);
    }
  };

  const speakText = (text: string) => {
    onSpeak(text);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // Clean markdown tags
      const plainText = text.replace(/[\*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Capture frame from stream and call server Gemini API
  const handleAnalyze = async (base64Image?: string) => {
    setIsLoading(true);
    setErrorMessage('');
    setAnalysisResult('Engaging Gemini cognitive visual analysis... please standby.');

    try {
      let finalBase64 = base64Image || '';

      if (!finalBase64) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamActive) {
          throw new Error('Webcam stream is inactive. Please upload an image or turn on camera.');
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D rendering buffer failed.');

        // Copy video frame to canvas
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Export as Base64 jpeg string
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        finalBase64 = dataUrl.split(',')[1];
      }

      // Call our Express proxy endpoint
      const response = await fetch('/api/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBuffer: finalBase64,
          mode: selectedTask,
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      const textResult = data.result || 'No description returned.';
      setAnalysisResult(textResult);

      // Speak result aloud to replicate the fully audio-narrated workspace
      speakText(textResult);
    } catch (err: any) {
      console.error('Frame analysis failed:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during visual processing.');
      setAnalysisResult('');
    } finally {
      setIsLoading(false);
    }
  };

  // Handling file drag drop / manual file select upload as fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result && typeof reader.result === 'string') {
        const b64 = reader.result.split(',')[1];
        handleAnalyze(b64);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left shadow-xl h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Eye className="text-emerald-400" size={24} />
            <h3 className="text-lg font-bold text-white">SoundSight Vision AI</h3>
          </div>
          
          <button
            onClick={streamActive ? stopCamera : startCamera}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow ${
              streamActive
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            <Camera size={16} />
            <span>{streamActive ? 'Shut Camera' : 'Turn On Camera'}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="bg-red-950/40 border border-red-900/40 p-3 rounded-lg text-red-200 text-xs mb-3">
            {errorMessage}
          </div>
        )}

        {/* Task Selection Selector */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { id: 'scene', label: 'Narration', icon: Eye },
            { id: 'ocr', label: 'OCR Read', icon: FileText },
            { id: 'hazard', label: 'Hazard', icon: AlertTriangle },
            { id: 'faces', label: 'Expressions', icon: Smile },
          ].map((task) => {
            const Icon = task.icon;
            return (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task.id as any)}
                className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                  selectedTask === task.id
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Icon size={14} />
                <span className="text-[10px]">{task.label}</span>
              </button>
            );
          })}
        </div>

        {/* Camera Feed Stream Element */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-52 flex items-center justify-center">
          {streamActive ? (
            <video
              ref={videoRef}
              id="webcam_sight_stream"
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-6 flex flex-col items-center gap-2">
              <Camera size={44} className="text-slate-600 animate-pulse" />
              <p className="text-xs text-slate-500">Camera view is offline.</p>
              <p className="text-[10px] text-slate-600">Activate of camera stream or trigger custom photo analysis below.</p>
            </div>
          )}

          {/* Invisible drawing Canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanning Animation bar when loading */}
          {isLoading && (
            <div className="absolute inset-x-0 top-0 h-1.5 bg-emerald-400 animate-bounce" />
          )}
        </div>

        {/* Capture or trigger analysis */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => handleAnalyze()}
            disabled={!streamActive || isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 transition disabled:opacity-40 disabled:pointer-events-none shadow"
          >
            <Sparkles size={14} className="animate-spin" />
            <span>Process Frame now</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs hover:bg-slate-700 transition"
          >
            Upload Photo
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
      </div>

      {/* Analysis Spoken Output Section */}
      <div>
        <div className="border-t border-slate-800/60 pt-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest block font-mono">
              Visual Audiosight Transcript
            </span>
            <button
              onClick={() => speakText(analysisResult)}
              disabled={!analysisResult}
              className="text-[10px] text-emerald-400 hover:underline disabled:opacity-30 disabled:no-underline"
            >
              Replay Audio 🔊
            </button>
          </div>
          <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl min-h-[90px] text-xs text-slate-300 leading-relaxed font-mono">
            {analysisResult ? (
              <p className="text-emerald-300 animate-fade-in">&gt; "{analysisResult}"</p>
            ) : (
              <span className="text-slate-600">
                [Audio text narration generated by Gemini matches active visual obstacles or sign translations]
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
