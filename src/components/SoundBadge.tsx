import React from 'react';
import { ResolvedEvent } from '../types';

export function SoundBadge({
  resolved,
  size = 36,
}: {
  resolved: ResolvedEvent;
  size?: number;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{
          border: `2px solid ${resolved.color}`,
          background: 'rgba(13,13,13,0.8)',
        }}
      >
        <span style={{ fontSize: size * 0.45, lineHeight: 1 }} aria-hidden="true">
          {resolved.icon}
        </span>
      </div>
    </div>
  );
}
