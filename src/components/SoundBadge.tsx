import React from 'react';
import { ResolvedEvent, UrgencyShape } from '../types';

/* ===========================================================================
   Component-library primitives for redundant, colourblind-safe encoding.

   Every sound is shown as: ICON (what) + a coloured ring (urgency colour) +
   an URGENCY SHAPE glyph (urgency without colour) — and callers always add a
   TEXT label too. No single channel is load-bearing on its own.
   =========================================================================== */

/** Colour-independent urgency glyph: triangle = critical, diamond = alert,
    square = heads-up, dot = info. Dark outline keeps it legible on any bg. */
export function UrgencyGlyph({
  shape,
  color,
  size = 16,
}: {
  shape: UrgencyShape;
  color: string;
  size?: number;
}) {
  const s = size;
  const c = s / 2;
  let node: React.ReactNode;
  switch (shape) {
    case 'triangle':
      node = <polygon points={`${c},${s * 0.14} ${s * 0.88},${s * 0.84} ${s * 0.12},${s * 0.84}`} />;
      break;
    case 'diamond':
      node = <polygon points={`${c},${s * 0.1} ${s * 0.9},${c} ${c},${s * 0.9} ${s * 0.1},${c}`} />;
      break;
    case 'square':
      node = <rect x={s * 0.18} y={s * 0.18} width={s * 0.64} height={s * 0.64} rx={s * 0.12} />;
      break;
    default: // dot
      node = <circle cx={c} cy={c} r={s * 0.28} />;
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      <g fill={color} stroke="#0a0e16" strokeWidth={s * 0.09} strokeLinejoin="round">
        {node}
      </g>
    </svg>
  );
}

/** The reusable circular sound chip: icon + urgency-coloured ring + shape glyph. */
export function SoundBadge({
  resolved,
  size = 44,
  glow = true,
}: {
  resolved: ResolvedEvent;
  size?: number;
  glow?: boolean;
}) {
  const glyph = Math.round(size * 0.42);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full border-2"
        style={{
          borderColor: resolved.color,
          background: 'rgba(10,14,22,0.82)',
          boxShadow: glow ? `0 0 16px ${resolved.color}66` : 'none',
        }}
      >
        <span style={{ fontSize: size * 0.5, lineHeight: 1 }} aria-hidden="true">
          {resolved.icon}
        </span>
      </div>
      <span className="absolute -bottom-1 -right-1 drop-shadow">
        <UrgencyGlyph shape={resolved.shape} color={resolved.color} size={glyph} />
      </span>
    </div>
  );
}

/** Small inline pill carrying the urgency word + glyph (text + shape + colour). */
export function UrgencyTag({ resolved, size = 'sm' }: { resolved: ResolvedEvent; size?: 'sm' | 'md' }) {
  const pad = size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono font-bold uppercase tracking-wider ${pad}`}
      style={{ color: resolved.color, background: `${resolved.color}1f`, border: `1px solid ${resolved.color}55` }}
    >
      <UrgencyGlyph shape={resolved.shape} color={resolved.color} size={size === 'md' ? 13 : 11} />
      {resolved.urgencyLabel}
    </span>
  );
}
