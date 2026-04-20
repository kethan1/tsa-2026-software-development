import React from 'react';
import { SoundEvent } from '../types';
import { resolveEvent } from '../data';
import { ringPoint, signedAngle } from '../geo';
import { SoundBadge } from './SoundBadge';

/* ===========================================================================
   SoundRing — the circular "sound radar" HUD.

   Egocentric: the top of the ring is straight ahead, clockwise to the right.
   Each active sound gets a directional ARC on the ring's edge (its width +
   thickness scale with loudness, its colour with urgency) and a floating
   sound-type BADGE pinned to that bearing. The newest sound is emphasised.
   =========================================================================== */

interface SoundRingProps {
  events: SoundEvent[]; // newest first
  size: number;
  heading?: number; // compass heading; 0 = facing ahead (desktop default)
  jitter?: number; // live localisation noise in degrees, applied to bearings
  max?: number; // how many sounds to plot
  showLabels?: boolean;
  reduceMotion?: boolean;
}

export default function SoundRing({
  events,
  size,
  heading = 0,
  jitter = 0,
  max = 5,
  showLabels = true,
  reduceMotion = false,
}: SoundRingProps) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.4;

  const plotted = events.slice(0, max);

  // Direction labels around the ring (ahead / right / behind / left).
  const cardinals: { deg: number; label: string }[] = [
    { deg: 0, label: 'AHEAD' },
    { deg: 90, label: 'RIGHT' },
    { deg: 180, label: 'BEHIND' },
    { deg: 270, label: 'LEFT' },
  ];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="absolute inset-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <defs>
          <filter id="ring-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <radialGradient id="ring-sweep-grad" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#5b9bff" stopOpacity="0" />
            <stop offset="100%" stopColor="#5b9bff" stopOpacity="0.18" />
          </radialGradient>
        </defs>

        {/* rotating scan beam */}
        {!reduceMotion && (
          <g opacity="0.85">
            <path
              d={`M ${cx} ${cy} L ${ringPoint(cx, cy, R, -32).join(' ')} A ${R} ${R} 0 0 1 ${ringPoint(
                cx,
                cy,
                R,
                32
              ).join(' ')} Z`}
              fill="url(#ring-sweep-grad)"
            />
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              type="rotate"
              from={`0 ${cx} ${cy}`}
              to={`360 ${cx} ${cy}`}
              dur="5s"
              repeatCount="indefinite"
            />
          </g>
        )}

        {/* concentric range rings */}
        {[1, 0.66, 0.34].map((f, i) => (
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

        {/* cardinal ticks */}
        {cardinals.map(({ deg }) => {
          const [x1, y1] = ringPoint(cx, cy, R - 6, deg);
          const [x2, y2] = ringPoint(cx, cy, R + 6, deg);
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(255,255,255,0.32)"
              strokeWidth={2}
            />
          );
        })}

        {/* per-sound directional arcs (width + thickness scale with loudness) */}
        {plotted.map((ev, i) => {
          const r = resolveEvent(ev);
          const bearing = signedAngle(ev.directionDeg - heading) + jitter;
          const halfDeg = 9 + ev.loudness * 22;
          const stroke = 4 + ev.loudness * 10;
          const opacity = Math.max(0.32, 1 - i * 0.2);
          const [p1x, p1y] = ringPoint(cx, cy, R, bearing - halfDeg);
          const [p2x, p2y] = ringPoint(cx, cy, R, bearing + halfDeg);
          const arcPath = `M ${p1x} ${p1y} A ${R} ${R} 0 0 1 ${p2x} ${p2y}`;
          return (
            <g key={ev.id} opacity={opacity} className={r.isCritical && !reduceMotion ? 'ar-arc-pulse' : ''}>
              {/* soft glow underlay */}
              <path
                d={arcPath}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke + 9}
                strokeLinecap="round"
                opacity={0.3}
                filter="url(#ring-glow)"
              />
              <path
                d={arcPath}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${r.color})` }}
              />
            </g>
          );
        })}

        {/* center "you" marker + sonar ping */}
        {!reduceMotion && (
          <circle cx={cx} cy={cy} r={6} fill="none" stroke="#5b9bff" strokeWidth={2}>
            <animate attributeName="r" values={`6;${R * 0.5}`} dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0" dur="2.6s" repeatCount="indefinite" />
          </circle>
        )}
        <circle cx={cx} cy={cy} r={4.5} fill="#eef3fb" />
      </svg>

      {/* direction labels (HTML so they read crisply) */}
      {cardinals.map(({ deg, label }) => {
        const [lx, ly] = ringPoint(cx, cy, R + 14, deg);
        return (
          <span
            key={label}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-mono text-[8px] font-bold tracking-widest text-white/45"
            style={{ left: lx, top: ly }}
          >
            {label}
          </span>
        );
      })}

      {/* floating sound-type badges pinned to each bearing */}
      {plotted.map((ev, i) => {
        const r = resolveEvent(ev);
        const bearing = signedAngle(ev.directionDeg - heading) + jitter;
        const [bx, by] = ringPoint(cx, cy, R, bearing);
        const badgeSize = i === 0 ? Math.min(52, size * 0.16) : Math.min(38, size * 0.12);
        return (
          <div
            key={ev.id}
            className={`pointer-events-none absolute flex flex-col items-center gap-0.5 ${
              reduceMotion ? '' : 'marker-bob'
            }`}
            style={{
              left: bx,
              top: by,
              transform: 'translate(-50%, -50%)',
              zIndex: i === 0 ? 20 : 10 - i,
              opacity: Math.max(0.5, 1 - i * 0.18),
            }}
          >
            <SoundBadge resolved={r} size={badgeSize} />
            {showLabels && i === 0 && (
              <span
                className="mt-0.5 whitespace-nowrap rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white backdrop-blur"
                style={{ borderBottom: `2px solid ${r.color}` }}
              >
                {r.shortName}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
