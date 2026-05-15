import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Camera,
  CameraOff,
  Crosshair,
  Radar,
  X,
} from 'lucide-react';
import { SoundEvent } from '../types';
import { resolveEvent } from '../data';
import { notifySoundEvent, requestSoundNotificationPermission } from '../pwa';

const NEXT_EVENT_DELAY_MS = 2500;

const HARD_CODED_EVENTS: SoundEvent[] = [
  {
    id: 'demo-appliance-front',
    category: 'appliance',
    rawLabel: 'Appliance beep',
    icon: '\u{1F50A}',
    urgency: 'normal',
    confidence: 0.9,
    loudness: 0.58,
    directionDeg: 18,
    timestamp: new Date(0),
    source: 'demo',
  },
  {
    id: 'demo-glass-breaking-behind-right',
    category: 'glass',
    rawLabel: 'Glass breaking',
    icon: '\u{1FA9F}',
    urgency: 'emergency',
    confidence: 0.94,
    loudness: 0.96,
    directionDeg: 142,
    timestamp: new Date(0),
    source: 'demo',
  },
];

const instantiateEvent = (event: SoundEvent, sequence: number): SoundEvent => ({
  ...event,
  id: `${event.id}-${sequence}-${Date.now()}`,
  timestamp: new Date(),
});
const FOV_DEG = 64;
const HALF_FOV = FOV_DEG / 2;
const ARC_HALF_DEG = 22;

const NOISE_AMP_DEG = 5;
const CONE_HALF_DEG = 30;
const SWEEP_HALF_DEG = 34;

const RING_STEPS = 84;
const POINT_MAX = 26;
const POINT_GROW_S = 0.5;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

// Builds the living compass outline: an ambient wriggle + breathing pulse,
// plus a pointed bulge that grows toward `pointDeg` (the sound source).
const wobbleRingPath = (
  cx: number,
  cy: number,
  R: number,
  t: number,
  ambient: number,
  pointDeg: number | null,
  pointAmp: number,
): string => {
  const pts: [number, number][] = [];
  const pulse = ambient * 2.4 * Math.sin(t * 1.5);
  for (let i = 0; i < RING_STEPS; i += 1) {
    const a = (i / RING_STEPS) * 360;
    const rad = (a * Math.PI) / 180;
    const wriggle =
      ambient *
      (1.8 * Math.sin(rad * 3 + t * 1.6) +
        1.1 * Math.sin(rad * 5 - t * 2.3) +
        0.6 * Math.sin(rad * 8 + t * 3.1));
    let bump = 0;
    if (pointDeg != null && pointAmp > 0) {
      const d = ((a - pointDeg + 540) % 360) - 180;
      // wide rounded base + narrow tip = a soft pointed spike
      bump =
        pointAmp *
        (0.7 * Math.exp(-(d * d) / (2 * 17 * 17)) + 0.3 * Math.exp(-(d * d) / (2 * 7 * 7)));
    }
    pts.push(ringPoint(cx, cy, R + pulse + wriggle + bump, a));
  }

  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(
      2,
    )} ${p2[1].toFixed(2)}`;
  }
  return `${d} Z`;
};

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const cardinal = (deg: number) => CARDINALS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

const signedAngle = (deg: number) => {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
};

const ringPoint = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
};

interface ARViewProps {
  onEventsChange?: (events: SoundEvent[]) => void;
  onEventDetected?: (event: SoundEvent) => void;
}

export default function ARView({ onEventsChange, onEventDetected }: ARViewProps) {
  const [events, setEvents] = useState<SoundEvent[]>([]);
  const [nextIndex, setNextIndex] = useState(0);
  const [pendingNext, setPendingNext] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [flash, setFlash] = useState(false);

  const [heading, setHeading] = useState(0);
  const [compassOn, setCompassOn] = useState(false);

  const [dims, setDims] = useState({ w: 380, h: 560 });

  const [tick, setTick] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextTimer = useRef<number | null>(null);
  const orientHandler = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const lastEventId = useRef<string | null>(null);
  const tickRef = useRef(0);
  const eventStartRef = useRef(0);

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

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

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
      setCameraError('Camera unavailable \u2014 running the indicator over a dark backdrop.');
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
        h = webkit;
      } else if (e.alpha != null) {
        h = 360 - e.alpha;
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

  const toggleNextEvent = () => {
    if (pendingNext) return;

    if (events.length > 0) {
      setEvents([]);
      onEventsChange?.([]);
      return;
    }

    void requestSoundNotificationPermission();
    setPendingNext(true);
    if (nextTimer.current) window.clearTimeout(nextTimer.current);
    nextTimer.current = window.setTimeout(() => {
      const nextEvent = instantiateEvent(HARD_CODED_EVENTS[nextIndex], nextIndex);
      const nextEvents = [nextEvent];
      setEvents(nextEvents);
      onEventsChange?.(nextEvents);
      onEventDetected?.(nextEvent);
      void notifySoundEvent(nextEvent);
      setNextIndex((index) => (index + 1) % HARD_CODED_EVENTS.length);
      setPendingNext(false);
      nextTimer.current = null;
    }, NEXT_EVENT_DELAY_MS);
  };

  useEffect(() => {
    startCamera();
    enableCompass();
    return () => {
      if (nextTimer.current) window.clearTimeout(nextTimer.current);
      onEventsChange?.([]);
      stopCamera();
      disableCompass();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeEvent = events[0] || null;

  useEffect(() => {
    if (!activeEvent) return;
    if (lastEventId.current === activeEvent.id) return;
    lastEventId.current = activeEvent.id;
    eventStartRef.current = tickRef.current;

    setFlash(true);
    if ('vibrate' in navigator) navigator.vibrate([60, 40, 120, 40, 200]);
    const t = window.setTimeout(() => setFlash(false), 1100);
    return () => clearTimeout(t);
  }, [activeEvent]);

  useEffect(() => {
    if (reduceMotion) {
      tickRef.current = 0;
      setTick(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      tickRef.current = t;
      setTick(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  const showIndicator = !!activeEvent;
  const resolved = activeEvent ? resolveEvent(activeEvent) : null;
  const isEmergency = resolved?.isCritical ?? false;
  const arcColor = !resolved ? '#6366f1' : isEmergency ? '#ef4444' : '#6366f1';

  const { w, h } = dims;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.max(70, Math.min(w, h) * 0.34);

  const noiseDeg =
    activeEvent && !reduceMotion
      ? NOISE_AMP_DEG *
        (0.6 * Math.sin(tick * 2.3) + 0.3 * Math.sin(tick * 5.7 + 1.3) + 0.1 * Math.sin(tick * 11 + 0.7))
      : 0;
  const relative = activeEvent ? signedAngle(activeEvent.directionDeg - heading) : 0;
  const displayRelative = relative + noiseDeg;

  const ambient = reduceMotion ? 0 : 1;
  const grow = activeEvent
    ? reduceMotion
      ? 1
      : easeOutCubic(Math.min(1, Math.max(0, (tick - eventStartRef.current) / POINT_GROW_S)))
    : 0;
  const pointAmp = activeEvent ? grow * POINT_MAX * (1 + (reduceMotion ? 0 : 0.12 * Math.sin(tick * 3))) : 0;
  const ringPath = wobbleRingPath(cx, cy, R, tick, ambient, activeEvent ? displayRelative : null, pointAmp);
  const offScreen = Math.abs(relative) > HALF_FOV;
  const onRight = relative >= 0;

  const [ax1, ay1] = ringPoint(cx, cy, R, displayRelative - ARC_HALF_DEG);
  const [ax2, ay2] = ringPoint(cx, cy, R, displayRelative + ARC_HALF_DEG);
  const arcPath = `M ${ax1} ${ay1} A ${R} ${R} 0 0 1 ${ax2} ${ay2}`;
  const [mx, my] = ringPoint(cx, cy, R + 16, displayRelative);

  const [cone1x, cone1y] = ringPoint(cx, cy, R, displayRelative - CONE_HALF_DEG);
  const [cone2x, cone2y] = ringPoint(cx, cy, R, displayRelative + CONE_HALF_DEG);
  const conePath = `M ${cx} ${cy} L ${cone1x} ${cone1y} A ${R} ${R} 0 0 1 ${cone2x} ${cone2y} Z`;

  const [point0x, point0y] = ringPoint(cx, cy, 12, displayRelative);
  const [point1x, point1y] = ringPoint(cx, cy, R - 6, displayRelative);

  const [sweep1x, sweep1y] = ringPoint(cx, cy, R, -SWEEP_HALF_DEG);
  const [sweep2x, sweep2y] = ringPoint(cx, cy, R, SWEEP_HALF_DEG);
  const sweepPath = `M ${cx} ${cy} L ${sweep1x} ${sweep1y} A ${R} ${R} 0 0 1 ${sweep2x} ${sweep2y} Z`;

  const [reticleX, reticleY] = ringPoint(cx, cy, R + 16, displayRelative);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
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
          <div className="absolute inset-0 bg-black" />
        )}

        <svg
            className="pointer-events-none absolute inset-0"
            width="100%"
            height="100%"
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
          >
            <defs>
              <radialGradient id="ar-cone-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={arcColor} stopOpacity="0.42" />
                <stop offset="70%" stopColor={arcColor} stopOpacity="0.14" />
                <stop offset="100%" stopColor={arcColor} stopOpacity="0" />
              </radialGradient>
              <radialGradient id="ar-sweep-grad" cx="50%" cy="50%" r="50%">
                <stop offset="55%" stopColor={arcColor} stopOpacity="0" />
                <stop offset="100%" stopColor={arcColor} stopOpacity="0.15" />
              </radialGradient>
              <filter id="ar-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={arcColor} floodOpacity="0.9" />
              </filter>
            </defs>

            {!reduceMotion && (
              <g opacity="0.7">
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

            <path d={ringPath} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={5} strokeLinejoin="round" />
            <path
              d={ringPath}
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />

            {([
              [0, 'FRONT'],
              [90, 'RIGHT'],
              [180, 'BACK'],
              [270, 'LEFT'],
            ] as const).map(([d, label]) => {
              const [tx1, ty1] = ringPoint(cx, cy, R - 7, d);
              const [tx2, ty2] = ringPoint(cx, cy, R + 7, d);
              const [lx, ly] = ringPoint(cx, cy, R + 18, d);
              return (
                <g key={d}>
                  <line
                    x1={tx1}
                    y1={ty1}
                    x2={tx2}
                    y2={ty2}
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={2.5}
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={11}
                    fontWeight="bold"
                    letterSpacing="1.5"
                    fill="white"
                    stroke="rgba(0,0,0,0.5)"
                    strokeWidth={0.6}
                    paintOrder="stroke"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {showIndicator && (
              <>
                <path d={conePath} fill="url(#ar-cone-grad)" />
                <line
                  x1={cx}
                  y1={cy}
                  x2={cone1x}
                  y2={cone1y}
                  stroke={arcColor}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                  opacity={0.5}
                />
                <line
                  x1={cx}
                  y1={cy}
                  x2={cone2x}
                  y2={cone2y}
                  stroke={arcColor}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                  opacity={0.5}
                />

                <g className="ar-arc-pulse" filter="url(#ar-glow)">
                  <line
                    x1={point0x}
                    y1={point0y}
                    x2={point1x}
                    y2={point1y}
                    stroke={arcColor}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                  <path
                    d={arcPath}
                    fill="none"
                    stroke={arcColor}
                    strokeWidth={9}
                    strokeLinecap="round"
                  />
                  <g transform={`translate(${mx} ${my}) rotate(${displayRelative})`}>
                    <path
                      d="M -13 9 L 0 -12 L 13 9 Z"
                      fill={arcColor}
                      stroke="white"
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                    />
                  </g>
                </g>
              </>
            )}

            {!reduceMotion && (
              <circle cx={cx} cy={cy} r={4} fill="none" stroke={arcColor} strokeWidth={1.5}>
                <animate
                  attributeName="r"
                  values={`4;${R * 0.35}`}
                  dur="2.4s"
                  repeatCount="indefinite"
                />
                <animate attributeName="opacity" values="0.4;0" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={cx} cy={cy} r={3.5} fill="white" opacity={0.8} />
          </svg>

        {showIndicator && resolved && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${reticleX}px`, top: `${reticleY}px` }}
          >
            <span className="rounded-lg bg-black/70 px-2 py-0.5 text-2xl">
              {resolved.icon}
            </span>
          </div>
        )}

        {flash && (
          <div
            className="ar-damage-flash pointer-events-none absolute inset-0"
            style={{
              boxShadow: 'inset 0 0 100px 30px rgba(239,68,68,0.6)',
            }}
          />
        )}

        {showIndicator && isEmergency && !flash && (
          <div
            className="pointer-events-none absolute inset-0 animate-pulse"
            style={{ boxShadow: 'inset 0 0 60px 10px rgba(239,68,68,0.2)' }}
          />
        )}

        <div
          className="absolute inset-x-0 top-0 flex items-start justify-end gap-2 px-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <button
            onClick={cameraOn ? stopCamera : startCamera}
            className={`z-30 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition active:scale-95 ${
              cameraOn
                ? 'border-white/10 bg-black/60 text-white/80 hover:bg-black/80'
                : 'border-primary/40 bg-black/60 text-primary hover:bg-black/80'
            }`}
            aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            aria-pressed={cameraOn}
          >
            {cameraOn ? <Camera size={13} /> : <CameraOff size={13} />}
            {cameraOn ? 'Cam' : 'Off'}
          </button>
        </div>

        {showIndicator && resolved && activeEvent && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4">
            <div
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                isEmergency
                  ? 'border-red-400/40 bg-black/70 text-red-50'
                  : 'border-primary/30 bg-black/70 text-ink'
              }`}
            >
              <span className="text-2xl">{resolved.icon}</span>
              <div className="leading-tight">
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  {isEmergency && <AlertTriangle size={14} className="text-red-300" />}
                  {resolved.name}
                </p>
                <p
                  className={`mt-0.5 flex items-center gap-1 text-base font-bold ${
                    isEmergency ? 'text-red-300' : 'text-primary'
                  }`}
                >
                  {offScreen ? (
                    onRight ? (
                      <ChevronRight size={18} strokeWidth={3} />
                    ) : (
                      <ChevronLeft size={18} strokeWidth={3} />
                    )
                  ) : (
                    <Crosshair size={15} strokeWidth={3} />
                  )}
                  {offScreen ? (onRight ? 'Turn right' : 'Turn left') : 'In view'}
                </p>
                <p className="mt-0.5 font-mono text-[10px] opacity-70">
                  {cardinal(activeEvent.directionDeg)} &middot; {activeEvent.directionDeg}&deg; &middot;{' '}
                  {Math.round(activeEvent.confidence * 100)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-x-0 top-14 mx-auto w-fit rounded-lg bg-black/70 px-3 py-1.5 text-center font-mono text-[10px] text-amber-200">
            {cameraError}
          </div>
        )}
      </div>

      <button
        onClick={toggleNextEvent}
        disabled={pendingNext}
        className={`absolute left-3 z-30 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition active:scale-95 ${
          pendingNext
            ? 'border-white/10 bg-black/50 text-white/50'
            : events.length > 0
              ? 'border-white/10 bg-black/60 text-white/70 hover:bg-black/80'
              : 'border-primary/40 bg-black/60 text-primary hover:bg-black/80'
        }`}
        style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        aria-label={events.length > 0 ? 'Clear detected sound' : 'Simulate a detected sound'}
      >
        {pendingNext ? (
          <>
            <Radar size={13} className="animate-spin" />
            S
          </>
        ) : events.length > 0 ? (
          <>
            <X size={13} />
            C
          </>
        ) : (
          <>
            <Radar size={13} />
            D
          </>
        )}
      </button>
    </div>
  );
}
