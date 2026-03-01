import React, { useState } from 'react';
import { Sparkles, Play, Download, Save, Plus, Trash, Wand2 } from 'lucide-react';
import { HapticPattern, SenseSyncCategory } from '../types';
import { categoryMetadata, defaultHapticPatterns } from '../data';

interface VibrationEditorProps {
  onSavePattern: (pattern: HapticPattern) => void;
}

export default function VibrationEditor({ onSavePattern }: VibrationEditorProps) {
  const [activeCategory, setActiveCategory] = useState<SenseSyncCategory>('custom');
  const [patternName, setPatternName] = useState('My Custom Knock');
  const [pulseSequence, setPulseSequence] = useState<number[]>([200, 100, 250, 100, 300]); // alternating [vibeMs, pauseMs, ...]
  const [intensity, setIntensity] = useState(0.8);
  const [color, setColor] = useState('#a855f7');
  const [description, setDescription] = useState('Double quick bursts followed by one long intense pulse.');
  const [isVibratingSim, setIsVibratingSim] = useState(false);

  // Play pattern utilizing browser gamepad / navigator vibration sequence
  const playVibration = () => {
    setIsVibratingSim(true);
    
    // Check if device vibration is supported
    if ('vibrate' in navigator) {
      navigator.vibrate(pulseSequence);
    }

    // Calculate total duration to turn off simulation wave
    const totalDuration = pulseSequence.reduce((sum, current) => sum + current, 0);
    setTimeout(() => {
      setIsVibratingSim(false);
    }, totalDuration);
  };

  const handleAddPulse = () => {
    setPulseSequence((prev) => [...prev, 200, 100]);
  };

  const handleRemovePulse = (index: number) => {
    if (pulseSequence.length <= 1) return;
    setPulseSequence((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePulseChange = (index: number, val: number) => {
    setPulseSequence((prev) => {
      const copy = [...prev];
      copy[index] = Math.max(10, Math.min(2000, val));
      return copy;
    });
  };

  const handleGenerateAlchemicalPattern = () => {
    // Generate organic patterns based on theme algorithms
    const choices = [
      { name: 'SOSS Urgent', seq: [400, 100, 400, 100, 400, 200, 150, 150, 150], desc: 'Classic SOS Morse sequence styled with heavy onset weight.' },
      { name: 'Runic Step', seq: [100, 80, 100, 80, 300, 100, 100], desc: 'Light introductory tapping transitioning into a prolonged alert chime.' },
      { name: 'Crying Warning', seq: [200, 50, 200, 50, 200, 50, 400], desc: 'Rapid, uneven, organic frequencies designed for baby indicators.' },
    ];
    const picked = choices[Math.floor(Math.random() * choices.length)];
    setPatternName(picked.name);
    setPulseSequence(picked.seq);
    setDescription(picked.desc);
  };

  const handleSave = () => {
    const fresh: HapticPattern = {
      name: patternName,
      category: activeCategory,
      pattern: pulseSequence,
      intensity,
      color,
      description,
    };
    onSavePattern(fresh);
    alert(`Success: Savable Profile "${patternName}" has been synchronized with Core Taptic Assets!`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left shadow-xl h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="text-purple-400" size={24} />
            <h3 className="text-lg font-bold text-white">Custom Taptic Vibrations Mixer</h3>
          </div>
          <button
            onClick={handleGenerateAlchemicalPattern}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-700 transition"
          >
            <Wand2 size={13} />
            <span className="text-[11px] font-mono">Roll Pattern</span>
          </button>
        </div>

        {/* Input variables */}
        <div className="space-y-4 mb-4">
          <div>
            <label className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400 block mb-1">
              Alert Trigger Variable Target
            </label>
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as SenseSyncCategory)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-purple-500"
            >
              {Object.entries(categoryMetadata).map(([cat, met]) => (
                <option key={cat} value={cat}>
                  {met.icon} {met.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400 block mb-1">
                Taptic Profile Label Name
              </label>
              <input
                type="text"
                value={patternName}
                onChange={(e) => setPatternName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400 block mb-1">
                Haptic Girth Intensity
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={intensity}
                  onChange={(e) => setIntensity(parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <span className="text-xs font-mono text-purple-300">{(intensity * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Sequence Bars & Milliseconds sliders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400 block">
                Vibration Sequence Interval (Pairs of Vibe / Silence)
              </label>
              <button
                onClick={handleAddPulse}
                className="text-[10px] bg-slate-800 border border-slate-700 text-purple-400 hover:text-purple-300 font-semibold px-2 py-0.5 rounded flex items-center gap-1 transition"
              >
                <Plus size={10} /> Add Gap
              </button>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto pr-1 border border-slate-800/60 p-2 bg-slate-950/40 rounded-xl">
              {pulseSequence.map((val, idx) => {
                const isVibrateStep = idx % 2 === 0;
                return (
                  <div key={idx} className="flex items-center gap-3 bg-slate-950 p-2 rounded-lg border border-slate-900">
                    <span className="text-[10px] font-mono w-14 shrink-0 text-slate-500">
                      Step {idx + 1}:
                    </span>
                    <span className={`text-[10px] uppercase font-mono w-14 font-bold ${isVibrateStep ? 'text-purple-400' : 'text-slate-400'}`}>
                      {isVibrateStep ? '⚡ Vibe' : '⏳ Pause'}
                    </span>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="25"
                      value={val}
                      onChange={(e) => handlePulseChange(idx, parseInt(e.target.value))}
                      className={`w-full accent-purple-500`}
                    />
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => handlePulseChange(idx, parseInt(e.target.value))}
                      className="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] font-mono text-right text-slate-200 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">ms</span>
                    <button
                      onClick={() => handleRemovePulse(idx)}
                      disabled={pulseSequence.length <= 1}
                      className="text-slate-500 hover:text-red-400 disabled:opacity-30 transition"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tactile Demo Waveform Visualization */}
        <div className="relative rounded-xl border border-slate-800/80 bg-slate-950 p-3 h-16 flex items-center justify-center overflow-hidden mb-4">
          {isVibratingSim ? (
            <div className="absolute inset-0 z-0 bg-gradient-to-r from-purple-900/10 via-fuchsia-900/20 to-purple-900/10 animate-pulse" />
          ) : null}
          
          <div className="relative z-10 flex gap-2 overflow-x-auto w-full items-center justify-center">
            {pulseSequence.map((val, idx) => {
              const isVibe = idx % 2 === 0;
              const widthWeight = Math.min(60, Math.max(10, val / 10));
              return (
                <div
                  key={idx}
                  className={`h-4 rounded transition-all ${
                    isVibe
                      ? isVibratingSim
                        ? 'bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.8)] scale-y-125'
                        : 'bg-purple-600/80'
                      : 'bg-slate-800 border border-slate-700/50'
                  }`}
                  style={{ width: `${widthWeight}px` }}
                  title={`${isVibe ? 'Vibration' : 'Pause'}: ${val}ms`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Control Actions buttons */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <button
          onClick={playVibration}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-indigo-700 transition"
        >
          <Play size={14} />
          <span>Test Haptics</span>
        </button>

        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 bg-purple-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-purple-700 transition"
        >
          <Save size={14} />
          <span>Save Pattern preset</span>
        </button>
      </div>
    </div>
  );
}
