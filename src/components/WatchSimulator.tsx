import React, { useEffect, useState } from 'react';
import { Watch, Wifi, BatteryCharging, Heart, ShieldAlert } from 'lucide-react';
import { SoundEvent } from '../types';
import { categoryMetadata } from '../data';

interface WatchSimulatorProps {
  activeEvent: SoundEvent | null;
}

export default function WatchSimulator({ activeEvent }: WatchSimulatorProps) {
  const [pulseCount, setPulseCount] = useState(0);
  const [isVibrating, setIsVibrating] = useState(false);

  // Animate dynamic watch ring expansions when event changes
  useEffect(() => {
    if (!activeEvent) return;

    setIsVibrating(true);
    setPulseCount((prev) => prev + 1);

    const timer = setTimeout(() => {
      setIsVibrating(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeEvent]);

  const metadata = activeEvent ? categoryMetadata[activeEvent.category] : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left shadow-xl h-full flex flex-col items-center justify-between">
      <div className="w-full">
        <div className="flex items-center gap-3 mb-6">
          <Watch className="text-pink-400" size={24} />
          <h3 className="text-lg font-bold text-white">WatchOS Tactile bridge Simulator</h3>
        </div>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          The watch app connects using WCSession `watch_connectivity` to deliver offline tactile bursts.
        </p>
      </div>

      {/* Styled Apple Watch Frame */}
      <div className="relative flex justify-center items-center my-4 py-2">
        {/* Apple Watch Band Strap (Background vertical bar) */}
        <div className="absolute top-0 bottom-0 w-16 bg-slate-800/80 rounded-2xl border-x border-slate-700/50 pointer-events-none" />

        {/* Watch Body */}
        <div className="relative bg-[#121214] border-4 border-[#2c2c31] w-48 h-56 rounded-[42px] p-3 shadow-[0_24px_50px_rgba(0,0,0,0.8)] z-10 flex flex-col justify-between overflow-hidden">
          {/* Subtle metal body side action / Crown knob illustration */}
          <div className="absolute right-[-4px] top-1/4 h-12 w-1.5 bg-[#404047] rounded-l" />

          {/* Watch OS Top Bar Status Indicators */}
          <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 px-1 font-mono">
            <span className="text-amber-500 font-bold">11:58 am</span>
            <div className="flex gap-1 items-center">
              <Wifi size={9} className="text-sky-400" />
              <Heart size={9} className="text-red-500 fill-red-500 animate-pulse" />
              <span>94%</span>
            </div>
          </div>

          {/* Watch OS Screen Body Content */}
          <div className="flex-1 flex flex-col justify-center items-center relative my-2">
            {isVibrating && activeEvent ? (
              <>
                {/* Visual ripple bands outward */}
                <div className="absolute inset-0 rounded-full border-2 border-red-500/40 animate-ping" />
                <div className="absolute inset-2 rounded-full border border-purple-500/30 animate-pulse" />
              </>
            ) : null}

            {activeEvent && metadata ? (
              <div className="flex flex-col items-center justify-center text-center p-2 z-10 animate-bounce">
                <div className="text-3xl mb-1 filter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                  {metadata.icon}
                </div>
                <div className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-red-400">
                  {metadata.displayName}
                </div>
                <div className="text-[9px] font-mono text-slate-300 mt-1 uppercase">
                  TAP: {activeEvent.rawLabel}
                </div>
                <div className="text-[8px] font-mono text-slate-500 mt-1 uppercase">
                  Taptic: {activeEvent.directionDeg}°
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-2 z-10">
                <span className="text-emerald-400 text-2xl animate-pulse mb-1">👂</span>
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-300 font-bold">
                  Listening
                </span>
                <span className="text-[7px] font-mono text-slate-500">
                  SenseSync Bridge Active
                </span>
              </div>
            )}
          </div>

          {/* Watch Status Footnote Area */}
          <div className="text-center text-[9px] font-mono px-1 pb-1">
            {isVibrating ? (
              <span className="text-fuchsia-400 font-bold animate-pulse uppercase">
                ⚙️ HAPTIC TAP (SEQ)
              </span>
            ) : (
              <span className="text-slate-500">APPLE WATCH PROUT</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-800/60 w-full text-center">
        <div className="flex gap-2 items-center justify-center text-[10px] font-mono text-slate-500">
          <ShieldAlert size={12} className="text-slate-400" />
          <span>SIMULATED COMPANION VIBRATION ENGINE</span>
        </div>
      </div>
    </div>
  );
}
