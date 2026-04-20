import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Square,
  Camera,
  Compass,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Crosshair,
} from 'lucide-react';
import { SenseSyncCategory, SoundEvent } from '../types';
import { resolveEvent } from '../data';

/* ===========================================================================
   AR mode — augmented-reality sound awareness.

   Hold up the phone: the rear camera fills the screen and a Fortnite-style
   "directional damage indicator" (a ring with a glowing arc) points toward the
   active sound. If the sound is outside the camera's field of view, a pulsing
   arrow pins to the screen edge that's closest to it.

   This is a hard-coded demo: the camera runs the whole time the view is open;
   pressing Start counts down 5s, then releases ONE predetermined event from ONE
   predetermined angle. A little jitter is added to the bearing so the
   localisation reads like a live sensor instead of a frozen value.
   =========================================================================== */

// ---- Hard-coded demo scenario: fired 5s after Start ----
const HARDCODED_SCENARIO: { category: SenseSyncCategory; label: string; angle: number } = {
  category: 'alarm', // an emergency sound so the alert is dramatic
  label: 'Fire Alarm',
  angle: 135, // degrees (0 = ahead, 90 = right, 180 = behind, 270 = left)
};
const COUNTDOWN_SECONDS = 5;

// Rear-camera horizontal field of view (approx). Inside this cone a sound is
// "on screen"; outside it we show the off-screen edge arrow.
const FOV_DEG = 64;
const HALF_FOV = FOV_DEG / 2;
const ARC_HALF_DEG = 22; // half-width of the red damage arc on the ring

// Localisation indicator tuning.
const NOISE_AMP_DEG = 5; // peak jitter added to the bearing (degrees)
const CONE_HALF_DEG = 30; // half-width of the translucent uncertainty cone
const SWEEP_HALF_DEG = 34; // half-width of the rotating scan beam

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const cardinal = (deg: number) => CARDINALS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// Normalize an angle into the (-180, 180] range.
const signedAngle = (deg: number) => {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
};

// A point on a ring, with 0° at the top and angle increasing clockwise.
const ringPoint = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
};

interface ARViewProps {
  /** Latest sound event in the app (drives the indicator). */
  activeEvent: SoundEvent | null;
  /** Fire the hard-coded scenario into the shared app state. */
  onFire: (category: SenseSyncCategory, label: string, angle: number) => void;
}

export default function ARView({ activeEvent, onFire }: ARViewProps) {
  const [running, setRunning] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [fired, setFired] = useState(false); // an event has been released this run
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [flash, setFlash] = useState(false); // red damage flash on a new event

  // Phone heading (compass). 0 = facing North. Defaults to 0 (works on desktop).
  const [heading, setHeading] = useState(0);
  const [compassOn, setCompassOn] = useState(false);

  // Measured render size, so the SVG overlay matches the camera box exactly.
  const [dims, setDims] = useState({ w: 380, h: 560 });

  // Live localisation jitter (degrees) + the user's reduced-motion preference.
  const [noiseDeg, setNoiseDeg] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const countdownTimer = useRef<number | null>(null);
  const orientHandler = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const lastEventId = useRef<string | null>(null);

  // ---- Track container size for the SVG overlay ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ---- Track the reduced-motion preference (disables jitter + decorative spin) ----
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // ---- Camera ----
  const startCamera = async () => {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
    } catch (err) {
      // Demo still works without the camera — we just show a dark backdrop.
      setCameraError('Camera unavailable — running the indicator over a dark backdrop.');
      setCameraOn(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  // ---- Compass / device orientation (optional; makes it truly AR on a phone) ----
  const enableCompass = async () => {
    const DOE = window.DeviceOrientationEvent as any;
    try {
      if (DOE && typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission();
        if (res !== 'granted') return;
      }
    } catch {
      return;
    }

    const handler = (e: DeviceOrientationEvent) => {
      const webkit = (e as any).webkitCompassHeading;
      let h: number | null = null;
      if (typeof webkit === 'number' && !Number.isNaN(webkit)) {
        h = webkit; // iOS: already a 0..360 compass heading
      } else if (e.alpha != null) {
        h = 360 - e.alpha; // Android: alpha is counter-clockwise from North
      }
      if (h != null) {
        setHeading(((h % 360) + 360) % 360);
        setCompassOn(true);
      }
    };
    orientHandler.current = handler;
    window.addEventListener('deviceorientationabsolute', handler as any, true);
    window.addEventListener('deviceorientation', handler, true);
  };

  const disableCompass = () => {
    if (orientHandler.current) {
      window.removeEventListener('deviceorientationabsolute', orientHandler.current as any, true);
      window.removeEventListener('deviceorientation', orientHandler.current, true);
      orientHandler.current = null;
    }
    setCompassOn(false);
    setHeading(0);
  };

  // ---- Start / Stop (event detection only — the camera runs independently) ----
  const handleStart = () => {
    setRunning(true);
    setFired(false);

    // Hard-coded: count down 5 seconds, then release the predetermined event.
    setCountdown(COUNTDOWN_SECONDS);
    let remaining = COUNTDOWN_SECONDS;
    countdownTimer.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        countdownTimer.current = null;
        setCountdown(null);
        setFired(true);
        onFire(HARDCODED_SCENARIO.category, HARDCODED_SCENARIO.label, HARDCODED_SCENARIO.angle);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  const handleStop = () => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    setRunning(false);
    setCountdown(null);
    setFired(false);
    setFlash(false);
  };

  // Camera + compass run for the whole life of the view, independent of the
  // Start/Stop button. Start them on mount, tear them down on unmount.
  useEffect(() => {
    startCamera();
    enableCompass();
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      stopCamera();
      disableCompass();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Alert the phone whenever a new event becomes active while running ----
  useEffect(() => {
    if (!running || !fired || !activeEvent) return;
    if (lastEventId.current === activeEvent.id) return;
    lastEventId.current = activeEvent.id;

    // Visual damage flash + a strong haptic buzz to the phone.
    setFlash(true);
    if ('vibrate' in navigator) navigator.vibrate([60, 40, 120, 40, 200]);
    const t = window.setTimeout(() => setFlash(false), 1100);
    return () => clearTimeout(t);
  }, [activeEvent, running, fired]);

  // ---- Live localisation jitter: nudge the bearing with smooth, organic noise ----
  useEffect(() => {
    const live = running && fired && !!activeEvent;
    if (!live || reduceMotion) {
      setNoiseDeg(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      // Layered sines of incommensurate frequencies → noise that wanders but never
      // jumps, so the arc trembles like a real direction-of-arrival estimate.
      const n =
        NOISE_AMP_DEG *
        (0.6 * Math.sin(t * 2.3) + 0.3 * Math.sin(t * 5.7 + 1.3) + 0.1 * Math.sin(t * 11 + 0.7));
      setNoiseDeg(n);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, fired, activeEvent, reduceMotion]);

  // ---------- Geometry of the active indicator ----------
  const showIndicator = running && fired && !!activeEvent;
  const resolved = activeEvent ? resolveEvent(activeEvent) : null;
  const isEmergency = resolved?.isCritical ?? false;
  const arcColor = isEmergency ? '#ef4444' : '#38bdf8';

  const { w, h } = dims;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.max(70, Math.min(w, h) * 0.34);

  // True bearing of the sound relative to where the phone is pointing…
  const relative = activeEvent ? signedAngle(activeEvent.directionDeg - heading) : 0;
  // …plus the live jitter, so the on-screen localisation never sits perfectly still.
  const displayRelative = relative + noiseDeg;
  const offScreen = Math.abs(relative) > HALF_FOV;
  const onRight = relative >= 0; // off-screen side / which way to turn

  // Damage arc on the ring, centered on the (jittered) bearing.
  const [ax1, ay1] = ringPoint(cx, cy, R, displayRelative - ARC_HALF_DEG);
  const [ax2, ay2] = ringPoint(cx, cy, R, displayRelative + ARC_HALF_DEG);
  const arcPath = `M ${ax1} ${ay1} A ${R} ${R} 0 0 1 ${ax2} ${ay2}`;
  // Chevron at the arc midpoint, pointing radially outward.
  const [mx, my] = ringPoint(cx, cy, R + 16, displayRelative);

  // Translucent uncertainty cone fanning from "you" out toward the bearing.
  const [cone1x, cone1y] = ringPoint(cx, cy, R, displayRelative - CONE_HALF_DEG);
  const [cone2x, cone2y] = ringPoint(cx, cy, R, displayRelative + CONE_HALF_DEG);
  const conePath = `M ${cx} ${cy} L ${cone1x} ${cone1y} A ${R} ${R} 0 0 1 ${cone2x} ${cone2y} Z`;

  // Rotating scan beam (drawn pointing up; spun continuously by SMIL).
  const [sweep1x, sweep1y] = ringPoint(cx, cy, R, -SWEEP_HALF_DEG);
  const [sweep2x, sweep2y] = ringPoint(cx, cy, R, SWEEP_HALF_DEG);
  const sweepPath = `M ${cx} ${cy} L ${sweep1x} ${sweep1y} A ${R} ${R} 0 0 1 ${sweep2x} ${sweep2y} Z`;

  // On-screen reticle: map the jittered bearing across the visible cone.
  const reticleX = cx + (displayRelative / HALF_FOV) * (w / 2 - 44);

  return (
    <div className="relative h-[calc(100dvh-9rem)] min-h-[440px] w-full overflow-hidden bg-black">
      {/* ===== Camera feed (or dark backdrop) ===== */}
      <div ref={containerRef} className="absolute inset-0">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            cameraOn ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {!cameraOn && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0c2550_0%,#05060c_100%)]" />
        )}

        {/* ===== SVG localisation indicator overlay ===== */}
        {showIndicator && (
          <svg
            className="pointer-events-none absolute inset-0"
            width="100%"
            height="100%"
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="ar-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
              <radialGradient id="ar-cone-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={arcColor} stopOpacity="0.34" />
                <stop offset="70%" stopColor={arcColor} stopOpacity="0.13" />
                <stop offset="100%" stopColor={arcColor} stopOpacity="0" />
              </radialGradient>
              <radialGradient id="ar-sweep-grad" cx="50%" cy="50%" r="50%">
                <stop offset="55%" stopColor={arcColor} stopOpacity="0" />
                <stop offset="100%" stopColor={arcColor} stopOpacity="0.22" />
              </radialGradient>
            </defs>

            {/* rotating scan beam, behind everything */}
            {!reduceMotion && (
              <g opacity="0.9">
                <path d={sweepPath} fill="url(#ar-sweep-grad)" />
                <animateTransform
                  attributeName="transform"
                  attributeType="XML"
                  type="rotate"
                  from={`0 ${cx} ${cy}`}
                  to={`360 ${cx} ${cy}`}
                  dur="4.5s"
                  repeatCount="indefinite"
                />
              </g>
            )}

            {/* concentric range rings */}
            {[1, 0.68, 0.36].map((f, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={R * f}
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth={i === 0 ? 1.5 : 1}
              />
            ))}

            {/* tick marks at front / right / back / left */}
            {[0, 90, 180, 270].map((d) => {
              const [tx1, ty1] = ringPoint(cx, cy, R - 7, d);
              const [tx2, ty2] = ringPoint(cx, cy, R + 7, d);
              return (
                <line
                  key={d}
                  x1={tx1}
                  y1={ty1}
                  x2={tx2}
                  y2={ty2}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={2}
                />
              );
            })}

            {/* uncertainty cone toward the sound, with dashed bearing limits */}
            <path d={conePath} fill="url(#ar-cone-grad)" />
            <line
              x1={cx}
              y1={cy}
              x2={cone1x}
              y2={cone1y}
              stroke={arcColor}
              strokeWidth={1}
              strokeDasharray="3 5"
              opacity={0.45}
            />
            <line
              x1={cx}
              y1={cy}
              x2={cone2x}
              y2={cone2y}
              stroke={arcColor}
              strokeWidth={1}
              strokeDasharray="3 5"
              opacity={0.45}
            />

            {/* soft glow underlay for the live arc */}
            <path
              d={arcPath}
              fill="none"
              stroke={arcColor}
              strokeWidth={18}
              strokeLinecap="round"
              opacity={0.35}
              filter="url(#ar-glow)"
            />

            {/* the live damage arc, pointing at the sound */}
            <g className="ar-arc-pulse">
              <path
                d={arcPath}
                fill="none"
                stroke={arcColor}
                strokeWidth={9}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 8px ${arcColor})` }}
              />
              {/* chevron at the arc midpoint, rotated to point outward */}
              <g transform={`translate(${mx} ${my}) rotate(${displayRelative})`}>
                <path
                  d="M -9 6 L 0 -8 L 9 6"
                  fill="none"
                  stroke={arcColor}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 6px ${arcColor})` }}
                />
              </g>
            </g>

            {/* center "you" marker with an expanding sonar ping */}
            {!reduceMotion && (
              <circle cx={cx} cy={cy} r={6} fill="none" stroke={arcColor} strokeWidth={2}>
                <animate
                  attributeName="r"
                  values={`6;${R * 0.5}`}
                  dur="2.4s"
                  repeatCount="indefinite"
                />
                <animate attributeName="opacity" values="0.5;0" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={cx} cy={cy} r={5} fill="white" opacity={0.9} />
          </svg>
        )}

        {/* ===== On-screen reticle (sound is within the camera cone) ===== */}
        {showIndicator && !offScreen && resolved && (
          <div
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${reticleX}px` }}
          >
            <div
              className={`flex flex-col items-center gap-1 ${
                isEmergency ? 'text-red-400' : 'text-sky-300'
              }`}
            >
              <Crosshair size={56} strokeWidth={1.5} className="animate-ping opacity-40 absolute" />
              <Crosshair size={56} strokeWidth={1.5} />
              <span className="mt-1 rounded-full bg-black/70 px-2.5 py-0.5 text-2xl shadow-lg backdrop-blur">
                {resolved.icon}
              </span>
            </div>
          </div>
        )}

        {/* ===== Off-screen edge arrow (Fortnite-style "turn this way") ===== */}
        {showIndicator && offScreen && resolved && (
          <div
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${
              onRight ? 'right-3' : 'left-3'
            }`}
          >
            <div
              className={`flex flex-col items-center gap-1.5 ${onRight ? 'ar-chev-right' : 'ar-chev-left'}`}
            >
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-[0_0_24px_rgba(0,0,0,0.6)] backdrop-blur ${
                  isEmergency
                    ? 'border-red-400 bg-red-500/30 text-red-200'
                    : 'border-sky-400 bg-sky-500/25 text-sky-100'
                }`}
              >
                {onRight ? (
                  <ChevronRight size={42} strokeWidth={3} />
                ) : (
                  <ChevronLeft size={42} strokeWidth={3} />
                )}
              </div>
              <span className="rounded-full bg-black/70 px-2 py-0.5 text-xl shadow backdrop-blur">
                {resolved.icon}
              </span>
            </div>
          </div>
        )}

        {/* ===== Red damage vignette on a fresh alert ===== */}
        {flash && (
          <div
            className="ar-damage-flash pointer-events-none absolute inset-0"
            style={{
              boxShadow: 'inset 0 0 140px 50px rgba(239,68,68,0.85)',
              background:
                'radial-gradient(ellipse at center, transparent 55%, rgba(239,68,68,0.28) 100%)',
            }}
          />
        )}

        {/* ===== Persistent emergency edge tint while an emergency is active ===== */}
        {showIndicator && isEmergency && !flash && (
          <div
            className="pointer-events-none absolute inset-0 animate-pulse"
            style={{ boxShadow: 'inset 0 0 90px 18px rgba(239,68,68,0.35)' }}
          />
        )}

        {/* ===== Top status banner ===== */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur">
            <span className={`h-2 w-2 rounded-full ${running ? 'animate-pulse bg-emerald-400' : 'bg-white/40'}`} />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
              AR {running ? 'Live' : 'Standby'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 font-mono text-[11px] text-white backdrop-blur">
            <Compass size={13} className={compassOn ? 'text-sky-300' : 'text-white/40'} />
            {compassOn ? `${Math.round(heading)}° heading` : 'no compass'}
          </div>
        </div>

        {/* ===== Active-sound caption ===== */}
        {showIndicator && resolved && activeEvent && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4">
            <div
              className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 backdrop-blur-md ${
                isEmergency
                  ? 'border-red-400/60 bg-red-950/70 text-red-50'
                  : 'border-sky-400/50 bg-slate-900/70 text-sky-50'
              }`}
            >
              <span className="text-3xl">{resolved.icon}</span>
              <div className="leading-tight">
                <p className="flex items-center gap-1.5 text-sm font-extrabold">
                  {isEmergency && <AlertTriangle size={15} className="text-red-300" />}
                  {resolved.name}
                </p>
                <p className="font-mono text-[11px] opacity-80">
                  {activeEvent.directionDeg}° · {cardinal(activeEvent.directionDeg)} ·{' '}
                  {offScreen ? (onRight ? 'turn right →' : '← turn left') : 'in view'} ·{' '}
                  {Math.round(activeEvent.confidence * 100)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== Countdown overlay ===== */}
        {countdown !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px]">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/70">
              Incoming sound in
            </p>
            <p className="font-display text-7xl font-bold text-white drop-shadow-lg">{countdown}</p>
            <p className="mt-1 font-mono text-[11px] text-white/60">
              Hold up your phone and look around
            </p>
          </div>
        )}

        {/* ===== Idle hint ===== */}
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <Camera size={48} className="text-white/40" />
            <h3 className="font-display text-lg font-bold text-white">AR Sound Radar</h3>
            <p className="max-w-xs text-xs leading-relaxed text-white/60">
              The camera is already live. Press{' '}
              <span className="font-bold text-white">Start</span> to begin detection — after 5
              seconds a sound is released, a glowing arc on the ring points toward it, and an arrow
              pins to the edge if it's behind you.
            </p>
          </div>
        )}

        {cameraError && running && (
          <div className="absolute inset-x-0 top-14 mx-auto w-fit rounded-lg bg-black/70 px-3 py-1.5 text-center font-mono text-[10px] text-amber-200 backdrop-blur">
            {cameraError}
          </div>
        )}
      </div>

      {/* ===== Start / Stop control (one button that morphs between states) ===== */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center p-4">
        <button
          onClick={running ? handleStop : handleStart}
          aria-label={running ? 'Stop detection' : 'Start detection'}
          className={`flex items-center gap-2.5 rounded-full px-8 py-3.5 text-base font-bold text-white transition-all duration-500 ease-out active:scale-95 ${
            running
              ? 'bg-danger shadow-[0_8px_30px_-6px_rgba(214,47,34,0.7)]'
              : 'bg-emerald-500 shadow-[0_8px_30px_-6px_rgba(16,185,129,0.7)]'
          }`}
        >
          {/* icons cross-fade in place so the button never jumps */}
          <span className="relative flex h-5 w-5 items-center justify-center">
            <Play
              size={20}
              fill="currentColor"
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                running ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
              }`}
            />
            <Square
              size={18}
              fill="currentColor"
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                running ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
            />
          </span>
          <span className="w-12 text-left">{running ? 'Stop' : 'Start'}</span>
        </button>
      </div>
    </div>
  );
}
