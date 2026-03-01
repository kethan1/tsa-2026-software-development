import React, { useEffect, useRef, useState } from 'react';
import { categoryMetadata } from '../data';
import { SoundEvent } from '../types';

interface AudioRadarProps {
  events: SoundEvent[];
  size?: number;
}

export default function AudioRadar({ events, size = 300 }: AudioRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeBlips, setActiveBlips] = useState<{ id: string; event: SoundEvent; opacity: number; scale: number; currentRadius: number }[]>([]);

  // Periodically update animations
  useEffect(() => {
    let animationFrameId: number;

    const updateFrame = () => {
      setActiveBlips((prev) => {
        const now = new Date().getTime();
        return prev
          .map((blip) => {
            const ageMs = now - blip.event.timestamp.getTime();
            const lifeSpan = 3000; // 3 seconds
            const opacity = Math.max(0, 1 - ageMs / lifeSpan);
            // expand radius fraction from 0.35 to 0.85 of max radius
            const scale = 0.35 + 0.5 * (ageMs / lifeSpan);
            return {
              ...blip,
              opacity,
              scale,
            };
          })
          .filter((blip) => blip.opacity > 0);
      });
      animationFrameId = requestAnimationFrame(updateFrame);
    };

    animationFrameId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Sync incoming events
  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[0];
    
    // Avoid double addition
    setActiveBlips((prev) => {
      if (prev.some((b) => b.event.id === latest.id)) return prev;
      return [
        {
          id: latest.id,
          event: latest,
          opacity: 1,
          scale: 0.35,
          currentRadius: 0,
        },
        ...prev,
      ];
    });
  }, [events]);

  // Draw the Radar Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    const center = size / 2;
    const maxRadius = (size / 2) - 15;

    // 1. Draw outer circle ring & radial indicators
    ctx.strokeStyle = 'rgba(79, 172, 254, 0.15)';
    ctx.lineWidth = 1;

    // Three concentric rings
    [0.35, 0.65, 1.0].forEach((fraction) => {
      ctx.beginPath();
      ctx.arc(center, center, maxRadius * fraction, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw Crosshair ticks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(center, center - maxRadius);
    ctx.lineTo(center, center + maxRadius);
    ctx.moveTo(center - maxRadius, center);
    ctx.lineTo(center + maxRadius, center);
    ctx.stroke();

    // 2. Draw Compass labels (N, E, S, W)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillText('N', center, center - maxRadius + 8);
    ctx.fillText('S', center, center + maxRadius - 8);
    ctx.fillText('E', center + maxRadius - 8, center);
    ctx.fillText('W', center - maxRadius + 8, center);

    // 3. Draw player center indicator (Glow ring + dot)
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(center, center, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(center, center, 10, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Draw Active Sound Blips on the Fortnite Compass
    activeBlips.forEach((blip) => {
      const angleRad = ((blip.event.directionDeg - 90) * Math.PI) / 180; // offset so 0 is North
      const radius = maxRadius * blip.scale;
      const x = center + radius * Math.cos(angleRad);
      const y = center + radius * Math.sin(angleRad);

      const metadata = categoryMetadata[blip.event.category] || { icon: '⏳', displayName: 'Sound' };

      // Set shadow glow effect based on category priority
      const isEmergency = blip.event.confidence > 0.5 && (blip.event.category === 'fireAlarm' || blip.event.category === 'siren');
      ctx.shadowColor = isEmergency ? 'rgba(239, 68, 68, 0.8)' : 'rgba(14, 165, 233, 0.6)';
      ctx.shadowBlur = isEmergency ? 12 : 6;

      // Draw expanding indicator ripple line
      ctx.strokeStyle = isEmergency 
        ? `rgba(239, 68, 68, ${blip.opacity * 0.4})` 
        : `rgba(14, 165, 233, ${blip.opacity * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 16 + (1 - blip.opacity) * 20, 0, Math.PI * 2);
      ctx.stroke();

      // Reset shadows for solid rendering
      ctx.shadowBlur = 0;

      // Solid color background dot for icon
      ctx.fillStyle = isEmergency ? 'rgba(220, 38, 38, 0.9)' : 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = isEmergency ? '#fca5a5' : '#0ea5e9';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Center the graphic emoji / icon
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(metadata.icon, x, y + 1);

      // Label description text pointing to direction
      ctx.fillStyle = isEmergency ? '#ef4444' : '#bae6fd';
      ctx.font = 'bold 9px system-ui, sans-serif';
      const heading = blip.event.locationContext || metadata.displayName;
      ctx.fillText(`${heading} (${Math.round(blip.event.confidence * 100)}%)`, x, y + 24);
    });
  }, [activeBlips, size]);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative rounded-full bg-slate-950 border border-slate-800 p-3 shadow-2xl">
        {/* Subtle grid background mask */}
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.06)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
        <canvas
          id="sound_compass_radar"
          ref={canvasRef}
          width={size}
          height={size}
          className="relative z-10 block"
        />
      </div>
      <div className="mt-2 text-center">
        <span className="text-[11px] font-mono tracking-wider uppercase text-sky-400">
          Fortnite HUD sound Radar Engine v3
        </span>
      </div>
    </div>
  );
}
