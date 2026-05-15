import React from 'react';
import { SoundEvent } from '../types';
import { resolveEvent } from '../data';
import { ringPoint, signedAngle } from '../geo';
import { SoundBadge } from './SoundBadge';

interface SoundRingProps {
  events: SoundEvent[];
  size: number;
  heading?: number;
  jitter?: number;
  max?: number;
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
          <radialGradient id="ring-sweep-grad" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#6366f1" stopOpacity="0" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.12" />
          </radialGradient>
        </defs>

        {!reduceMotion && (
          <g opacity="0.7">
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

        {[1, 0.66, 0.34].map((f, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={R * f}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={i === 0 ? 1 : 0.8}
          />
        ))}

        {cardinals.map(({ deg }) => {
          const [x1, y1] = ringPoint(cx, cy, R - 4, deg);
          const [x2, y2] = ringPoint(cx, cy, R + 4, deg);
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1.5}
            />
          );
        })}

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
              <path
                d={arcPath}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                opacity={0.85}
              />
            </g>
          );
        })}

        {!reduceMotion && (
          <circle cx={cx} cy={cy} r={4} fill="none" stroke="#6366f1" strokeWidth={1.5}>
            <animate attributeName="r" values={`4;${R * 0.4}`} dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0" dur="2.6s" repeatCount="indefinite" />
          </circle>
        )}
        <circle cx={cx} cy={cy} r={3.5} fill="#e2e8f0" />
      </svg>

      {cardinals.map(({ deg, label }) => {
        const [lx, ly] = ringPoint(cx, cy, R + 12, deg);
        return (
          <span
            key={label}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-mono text-[7px] font-bold tracking-widest text-white/30"
            style={{ left: lx, top: ly }}
          >
            {label}
          </span>
        );
      })}

      {plotted.map((ev, i) => {
        const r = resolveEvent(ev);
        const bearing = signedAngle(ev.directionDeg - heading) + jitter;
        const [bx, by] = ringPoint(cx, cy, R, bearing);
        const badgeSize = i === 0 ? Math.min(48, size * 0.14) : Math.min(34, size * 0.1);
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
                className="mt-0.5 whitespace-nowrap rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[8px] font-bold text-white"
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
