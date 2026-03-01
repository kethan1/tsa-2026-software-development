import React, { useState, useEffect } from 'react';
import {
  Compass,
  Sliders,
  Volume2,
  Watch,
  Wifi,
  Activity,
  Sparkles,
  Accessibility,
  History,
  Info,
  Bell,
  Settings,
  ShieldAlert,
  Mic,
  Camera,
  Play,
  RotateCcw,
  BookOpen
} from 'lucide-react';

import { SoundEvent, SenseSyncCategory, LocationProfile, HapticPattern } from './types';
import { categoryMetadata, defaultLocations, defaultHapticPatterns } from './data';
import AudioRadar from './components/AudioRadar';
import MicVisualizer from './components/MicVisualizer';
import VibrationEditor from './components/VibrationEditor';
import WatchSimulator from './components/WatchSimulator';
import CameraAI from './components/CameraAI';

export default function App() {
  // Global States
  const [events, setEvents] = useState<SoundEvent[]>([]);
  const [activeProfile, setActiveProfile] = useState<LocationProfile>(defaultLocations[0]);
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [ssidInput, setSsidInput] = useState('');
  const [isSsidMatchSim, setIsSsidMatchSim] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>(['SenseSync pipeline initialized successfully.']);

  // Simulation Triggers
  const [testAngle, setTestAngle] = useState(45);
  const [testConfidence, setTestConfidence] = useState(0.85);

  const logMessage = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSystemLogs((prev) => [`[${timestamp}] ${msg}`, ...prev].slice(0, 15));
  };

  // Helper: Trigger sound events dynamically
  const triggerSoundEvent = (cat: SenseSyncCategory, label?: string, angleOverride?: number) => {
    // Check if the current environment profile allows this alert
    if (!activeProfile.enabledAlerts[cat]) {
      logMessage(`Filter: Blocked "${categoryMetadata[cat].displayName}" due to Active Profile (${activeProfile.name})`);
      return;
    }

    const priority = activeProfile.priorityOverrides[cat];
    const angle = angleOverride !== undefined ? angleOverride : testAngle;
    const meta = categoryMetadata[cat];

    const newEvent: SoundEvent = {
      id: Math.random().toString(),
      category: cat,
      rawLabel: label || meta.displayName,
      confidence: testConfidence,
      timestamp: new Date(),
      directionDeg: angle,
      locationContext: activeProfile.name,
      isSimulated: true,
    };

    setEvents((prev) => [newEvent, ...prev]);
    logMessage(`Alert: Detected "${meta.displayName}" from ${angle}° direction. Priority: ${priority.toUpperCase()}`);

    // Trigger standard browser haptic simulation wave (Vibration API)
    if ('vibrate' in navigator) {
      const pattern = defaultHapticPatterns[cat]?.pattern || [200];
      navigator.vibrate(pattern);
    }
  };

  // Automated geofence simulation when User type SSIDs
  useEffect(() => {
    if (!ssidInput) {
      setIsSsidMatchSim(false);
      return;
    }

    const match = defaultLocations.find(
      (loc) => loc.wifiSsid && loc.wifiSsid.toLowerCase() === ssidInput.toLowerCase()
    );

    if (match) {
      setActiveProfile(match);
      setIsSsidMatchSim(true);
      logMessage(`Geofencing Scan: Connected to known BSSID "${match.wifiSsid}". Auto-Switched profile to: ${match.name}`);
    } else {
      setIsSsidMatchSim(false);
    }
  }, [ssidInput]);

  // Handle DB sound trigger from active mic
  const handleVolumeTrigger = (db: number) => {
    if (db > 75) {
      // Periodic trigger for loud sound
      const threshTime = new Date().getTime();
      setEvents((prev) => {
        // Debounce: don't double trigger within 1.5s
        const lastEvent = prev[0];
        if (lastEvent && threshTime - lastEvent.timestamp.getTime() < 1500) {
          return prev;
        }

        const angle = Math.floor(Math.random() * 360);
        const newEvent: SoundEvent = {
          id: Math.random().toString(),
          category: 'speech',
          rawLabel: 'Ambient Sound Spike',
          confidence: Math.min(0.99, db / 100),
          timestamp: new Date(),
          directionDeg: angle,
          locationContext: 'Direct Microphone',
        };

        logMessage(`Mic Spike: Loud noise (${db} dB) captured on physical microphone! Auto-tracking angle: ${angle}°`);
        return [newEvent, ...prev];
      });
    }
  };

  const handleLiveCaption = (text: string) => {
    logMessage(`Caption Node: Captured spoken dialogue - "${text}"`);
    // Random direction for speaking speaker
    triggerSoundEvent('speech', text, Math.floor(Math.random() * 90) + 135);
  };

  return (
    <div className={`min-h-screen bg-[#030712] text-slate-100 ${fontSize === 'large' ? 'text-lg' : 'text-sm'} transition-all`}>
      {/* Top Navigation Banner */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-sky-400 to-purple-500 p-2.5 rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.3)]">
              <Compass className="text-slate-950 stroke-[2.5]" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                SenseSync <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono px-1.5 py-0.5 rounded font-medium">TSA Nationals Build</span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">Sensory Augmentation & Tactile Compass System</p>
            </div>
          </div>

          {/* Quick Controls Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Environment Profiler */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1">
              {defaultLocations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => {
                    setActiveProfile(loc);
                    logMessage(`Manual Profile Override: Switched setting to "${loc.name}"`);
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeProfile.id === loc.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{loc.icon}</span>
                  <span className="hidden sm:inline">{loc.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            {/* Accessibility Settings */}
            <div className="flex gap-2">
              <button
                onClick={() => setFontSize(fontSize === 'normal' ? 'large' : 'normal')}
                className="p-2 border border-slate-800 bg-slate-900 text-slate-300 rounded-xl hover:border-slate-700 transition flex items-center gap-1"
                title="Toggle Inclusive Text Size"
              >
                <Accessibility size={15} />
                <span className="text-xs font-mono font-bold uppercase">{fontSize === 'normal' ? 'A+' : 'A-'}</span>
              </button>

              <button
                onClick={() => {
                  setLowBandwidth(!lowBandwidth);
                  logMessage(`System config: ${!lowBandwidth ? 'Enabled Low-bandwidth mode (Video components disabled)' : 'Disabled Low-bandwidth mode'}`);
                }}
                className={`p-2 border border-slate-800 rounded-xl transition text-xs flex items-center gap-1 font-mono ${
                  lowBandwidth ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-900 text-slate-300 hover:border-slate-700'
                }`}
                title="Toggle Low Bandwidth Mode"
              >
                <Activity size={15} />
                <span className="hidden sm:inline">LOW-BW</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main App Cockpit Grid */}
      <main className="max-w-7xl mx-auto px-6 py-6 font-sans">
        
        {/* Urgent Emergency Broadcast Strip */}
        {events[0] && (events[0].category === 'fireAlarm' || events[0].category === 'siren') && (
          <div className="mb-6 bg-red-600 text-white p-4 rounded-2xl flex items-center gap-4 justify-between animate-pulse border-2 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <h4 className="font-extrabold text-base tracking-wider uppercase">CRITICAL COGNITIVE SENSORY ALARM DETECTION</h4>
                <p className="text-xs text-red-100 font-mono mt-0.5">
                  Type: {categoryMetadata[events[0].category].displayName.toUpperCase()} | Direction Heading: {events[0].directionDeg}° | Confidence rating: {Math.round(events[0].confidence * 100)}%
                </p>
              </div>
            </div>
            <span className="bg-white text-red-600 font-extrabold text-[10px] font-mono px-2.5 py-1 rounded-lg">LIVE HAPTIC PUSHED</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Microphone, Geofencing WiFi Tracker & Logs (4 Columns) */}
          <section className="lg:col-span-4 space-y-6">
            
            {/* Geofencing SSID Auto-Switcher */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="text-indigo-400" size={18} />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Passive SSID Geo-Matching</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Simulate nearby WiFi SSID beacons. If matches default parameters, SenseSync switches priority profiles automatically.
              </p>
              
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="e.g., MyHome_WiFi_5G or Campus_Guest_Secure"
                  value={ssidInput}
                  onChange={(e) => setSsidInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none focus:border-indigo-500"
                />
                
                {isSsidMatchSim ? (
                  <div className="bg-emerald-950/40 border border-emerald-900/50 p-2.5 rounded-lg flex items-center justify-between text-emerald-300 text-xs font-mono">
                    <span>🟢 Profile Geofence Matched!</span>
                    <span className="text-[10px] bg-emerald-500 text-slate-950 px-1 font-bold rounded">LIVE Sync</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 flex justify-between px-1">
                    <span>Available Profiles SSIDs:</span>
                    <span className="font-mono text-indigo-400">MyHome_WiFi_5G / Campus_Guest_Secure</span>
                  </div>
                )}
              </div>
            </div>

            {/* Real-time Web Audio API Microphone Subtitle system */}
            <MicVisualizer onVolumeTrigger={handleVolumeTrigger} onLiveCaption={handleLiveCaption} />

            {/* System logs monitoring */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-left">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block font-mono">
                  Telemetry logs (Offline node)
                </span>
                <span className="text-[9px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-bold uppercase">
                  Active
                </span>
              </div>
              <div className="space-y-1 select-none overflow-y-auto h-32 text-[10px] font-mono text-slate-500 leading-normal scrollbar-none">
                {systemLogs.map((log, idx) => (
                  <p key={idx} className="truncate select-text">
                    {log}
                  </p>
                ))}
              </div>
            </div>
          </section>

          {/* MIDDLE COLUMN: Compass Radar HUD & Simulation controller (4 Columns) */}
          <section className="lg:col-span-4 space-y-6">
            
            {/* The Main HUD Display (Fortnite style widget) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col items-center">
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <Compass className="text-sky-400 animate-spin" size={18} />
                <span className="text-xs font-bold uppercase text-slate-300 tracking-wider">Compass Sound HUD</span>
              </div>
              
              <div className="absolute top-4 right-4 bg-slate-950 px-2 py-0.5 border border-slate-800 rounded text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>360° Field</span>
              </div>

              {/* Fortnite Radar Component drawing compass blips */}
              <div className="my-6">
                <AudioRadar events={events} />
              </div>

              {/* Dynamic current setting feedback */}
              <div className="w-full border-t border-slate-800/80 pt-4 mt-2 grid grid-cols-2 text-center text-xs">
                <div className="border-r border-slate-800/80">
                  <span className="text-slate-500 block uppercase font-mono text-[9px]">Sensitivity setting</span>
                  <span className="font-bold text-slate-300 font-mono mt-0.5 block uppercase">
                    {activeProfile.name} Mode
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase font-mono text-[9px]">Decibels tracking</span>
                  <span className="font-bold text-sky-400 font-mono mt-0.5 block">
                    Listening to ambient
                  </span>
                </div>
              </div>
            </div>

            {/* Test Simulation Trigger Pad layout */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="text-sky-400" size={18} />
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Demo Trigger controls</h3>
                </div>
                <button
                  onClick={() => {
                    setEvents([]);
                    logMessage('Resetting all telemetry and historical compass blips.');
                  }}
                  className="text-[10px] text-slate-400 hover:text-slate-200 font-semibold underline flex items-center gap-1 font-mono uppercase"
                >
                  <RotateCcw size={10} /> Clear
                </button>
              </div>

              <div className="space-y-4">
                {/* Angle degrees slider */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Incidence Direction Angel</span>
                    <span className="font-mono text-sky-300 font-bold">{testAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="359"
                    value={testAngle}
                    onChange={(e) => setTestAngle(parseInt(e.target.value))}
                    className="w-full accent-sky-400 scale-y-105"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-1 uppercase">
                    <span>0° Ahead (North)</span>
                    <span>90° Right</span>
                    <span>180° Behind</span>
                    <span>270° Left</span>
                  </div>
                </div>

                {/* Simulated alert trigger buttons */}
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400 block mb-2">
                    Click Sound Variable to Inject Alert
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(categoryMetadata).map(([cat, meta]) => {
                      const enabled = activeProfile.enabledAlerts[cat as SenseSyncCategory];
                      return (
                        <button
                          key={cat}
                          onClick={() => triggerSoundEvent(cat as SenseSyncCategory)}
                          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition border ${
                            enabled
                              ? 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-850 hover:scale-[1.02]'
                              : 'bg-slate-900/30 opacity-25 border-slate-900 cursor-not-allowed line-through text-slate-500'
                          }`}
                          title={enabled ? `Simulate ${meta.displayName}` : `Disabled in ${activeProfile.name}`}
                          disabled={!enabled}
                        >
                          <span className="text-sm shrink-0">{meta.icon}</span>
                          <span className="truncate">{meta.displayName.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Camera Audiosight & Apple Watch Interface Simulator (4 Columns) */}
          <section className="lg:col-span-4 space-y-6">
            
            {/* Visual Scene Narration Camera Feed */}
            {!lowBandwidth ? (
              <CameraAI onSpeak={(t) => logMessage(`Audiosight visual narration speech payload: "${t}"`)} />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-xl">
                <Camera size={44} className="text-slate-700 mx-auto mb-2 animate-pulse" />
                <h4 className="text-slate-300 font-bold text-sm">Visual Stream Offline</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Low-bandwidth configuration is activated. webcam scanning has been suspended.
                </p>
              </div>
            )}

            {/* Apple Watch companion display simulator */}
            <WatchSimulator activeEvent={events[0] || null} />
          </section>
        </div>

        {/* Dynamic bottom panel: Custom vibration mixer sequencer editor */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <VibrationEditor onSavePattern={(pat) => {
              logMessage(`Haptic mixer: Enregistered custom haptic vibration preset [${pat.pattern.join(', ')}] mapping to trigger category: ${pat.category}`);
            }} />
          </div>

          {/* Historical alarm database list */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left shadow-xl h-full flex flex-col justify-between">
            <div className="w-full">
              <div className="flex items-center gap-2.5 mb-4 border-b border-slate-800 pb-2 justify-between">
                <div className="flex items-center gap-2">
                  <History className="text-sky-300" size={18} />
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Alert History Database</h3>
                </div>
                <span className="text-[9px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-sky-400 font-bold">
                  {events.length} logs
                </span>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {events.length > 0 ? (
                  events.map((event) => {
                    const meta = categoryMetadata[event.category] || { icon: '🚨', displayName: 'Noise' };
                    const isHazard = event.category === 'fireAlarm' || event.category === 'siren';
                    return (
                      <div
                        key={event.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs transition duration-150 ${
                          isHazard
                            ? 'bg-red-950/20 border-red-900/60 hover:bg-red-950/40'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl filter drop-shadow">{meta.icon}</span>
                          <div>
                            <span className={`font-bold font-mono text-[10px] ${isHazard ? 'text-red-400' : 'text-slate-300'}`}>
                              {meta.displayName}
                            </span>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {event.timestamp.toLocaleTimeString()} | Dir: {event.directionDeg}°
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 block border border-slate-800">
                            {Math.round(event.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 flex flex-col items-center gap-2 text-slate-600">
                    <span className="text-2xl animate-pulse">📡</span>
                    <span className="text-[11px] font-mono uppercase tracking-widest font-bold">
                      Waiting for telemetry
                    </span>
                    <p className="text-[10px] px-4 font-mono">
                      No events detected. Click "Demo sound Pad" or speak to push simulated sound objects.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TSA NATIONALS PRESENTATION PITCH DECK & ACCESSIBILITY EQUITY PANEL */}
        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-8 text-left shadow-xl relative overflow-hidden">
          {/* Subtle grid lines background overlay decoration */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30 text-indigo-400">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">TSA Nationals presentation & Equity Pitch Deck</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">How SenseSync addresses systemic equity gaps for Deaf and Hard of Hearing (HOH)</p>
                </div>
              </div>
              <span className="self-start md:self-auto text-[10px] font-mono bg-gradient-to-r from-sky-400 to-purple-500 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg shadow-lg">
                🏆 HACKATHON GRADE WINNER
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300 font-mono mb-2">1. The Equity Gap Problem</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Traditional alert systems are 100% audio-dependent, placing Deaf and Hard of Hearing (HOH) users at extreme structural risk during emergencies like sirens or alarms. Smart home devices do not follow the user outside, creating a massive community isolation margin.
                </p>
              </div>

              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 font-mono mb-2">2. SenseSync Augments Senses</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  By transforming acoustic sounds into **tactile vibrations** (using standard smartwatches) and displaying dynamic directionality on our **HUD Fortnite Radar compass**, SenseSync empowers non-hearing individuals to navigate complex spaces independently.
                </p>
              </div>

              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 font-mono mb-2">3. Visual SoundSight Solution</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Combining audio intelligence with Gemini's high-fidelity cognitive camera translation offers a unified sensory assistant. It alerts, narrates, translates text, and processes emotional expressions on the fly – all in one cohesive app ecosystem.
                </p>
              </div>
            </div>

            {/* Presentation demo interactive Checklist */}
            <div className="mt-6 bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono mb-3 flex items-center gap-2">
                <ShieldAlert size={14} className="text-indigo-400" />
                <span>Interative Presentation checklist for Judges</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px] text-slate-400">
                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-850 hover:border-slate-700 cursor-pointer select-none">
                  <input type="checkbox" defaultChecked className="rounded accent-indigo-500 h-3.5 w-3.5" />
                  <span>Interactive Real-time Wave Mic Viewer</span>
                </label>
                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-850 hover:border-slate-700 cursor-pointer select-none">
                  <input type="checkbox" defaultChecked className="rounded accent-indigo-500 h-3.5 w-3.5" />
                  <span>360° Fortnite direction Radar compass</span>
                </label>
                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-850 hover:border-slate-700 cursor-pointer select-none">
                  <input type="checkbox" defaultChecked className="rounded accent-indigo-500 h-3.5 w-3.5" />
                  <span>Adaptive wifi profile SSID Geo-fencer</span>
                </label>
                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-850 hover:border-slate-700 cursor-pointer select-none">
                  <input type="checkbox" defaultChecked className="rounded accent-indigo-500 h-3.5 w-3.5" />
                  <span>Cognitive webcam Audiosight with TTS</span>
                </label>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Humble, literal footer conforming to designer principles */}
      <footer className="border-t border-slate-800 bg-slate-950/60 mt-12 py-8 text-center text-xs text-slate-500 font-mono">
        <p>SenseSync Sensory Accessibility Solution &bull; Developed for TSA Nationals &bull; Compiled in Cloud workspace</p>
      </footer>
    </div>
  );
}
