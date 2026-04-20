/* ===========================================================================
   SenseSync data model — AR sound awareness for Deaf / Hard-of-Hearing users.

   Accessibility rule baked into the model: no piece of information is ever
   carried by colour alone. Every sound resolves to colour + SHAPE + ICON + TEXT
   (see `resolveEvent` in data.ts), and every alert ships a haptic pattern.
   =========================================================================== */

export type SenseSyncCategory =
  | 'speech' // someone talking nearby
  | 'name' // your name / being called
  | 'doorbell' // doorbell or knock
  | 'vehicle' // car / bike approaching (critical from behind)
  | 'siren' // emergency vehicle siren
  | 'alarm' // fire / smoke / CO alarm
  | 'glass'; // glass breaking

export type AlertPriority = 'low' | 'normal' | 'high' | 'emergency';

// Colour-independent shape token, so urgency reads without relying on hue.
// Rendered as an SVG badge next to every sound (colourblind-safe redundancy).
export type UrgencyShape = 'dot' | 'square' | 'diamond' | 'triangle';

export interface SoundEvent {
  // A SenseSyncCategory for known sounds; free-form for anything classified live.
  category: string;
  id: string;
  rawLabel: string;
  confidence: number; // 0..1 classifier confidence
  loudness: number; // 0..1 — scales the directional arc's size + intensity
  timestamp: Date;
  directionDeg: number; // 0 = ahead, 90 = right, 180 = behind, 270 = left

  // Self-describing presentation (filled from category metadata for known sounds).
  urgency?: AlertPriority;
  icon?: string;
  color?: string;

  isSimulated?: boolean;
  source?: 'manual' | 'demo' | 'live';

  // Optional speech enrichment.
  transcript?: string;
  speaker?: string;
}

export interface CategoryMeta {
  displayName: string; // full label, e.g. "Emergency Siren"
  shortName: string; // compact label for chips, e.g. "Siren"
  icon: string; // emoji glyph
  baseUrgency: AlertPriority; // urgency before context (e.g. direction) is applied
  description: string;
}

export interface HapticPattern {
  // Pairs of [vibrateMs, pauseMs, …] passed straight to navigator.vibrate().
  pattern: number[];
  label: string; // human description of the rhythm, shown in Settings
}

/** Everything the four screens need to read for "what / where / how urgent". */
export interface ResolvedEvent {
  icon: string;
  name: string;
  shortName: string;
  color: string; // urgency colour (always paired with shape + text below)
  urgency: AlertPriority;
  urgencyLabel: string; // CRITICAL / ALERT / HEADS-UP / INFO
  shape: UrgencyShape; // colour-independent urgency glyph
  isCritical: boolean;
  pattern: number[]; // haptic pattern for this urgency
}

export interface UserSettings {
  sensitivity: number; // 0..1 — lower threshold = picks up quieter sounds
  alertOn: Record<SenseSyncCategory, boolean>;
  haptics: boolean;
  hapticIntensity: number; // 0..1 — scales pattern duration
  fullScreenAlerts: boolean; // full-screen takeover for critical sounds
  largeText: boolean;
}
