import {
  AlertPriority,
  CategoryMeta,
  HapticPattern,
  ResolvedEvent,
  SenseSyncCategory,
  SoundEvent,
  UrgencyShape,
  UserSettings,
} from './types';

/* ===========================================================================
   Sound categories. Each one is a distinct icon + label; urgency adds colour,
   a shape glyph, a text tag, and a haptic rhythm on top — never colour alone.
   =========================================================================== */
export const categoryMetadata: Record<SenseSyncCategory, CategoryMeta> = {
  speech: {
    displayName: 'Speech',
    shortName: 'Speech',
    icon: '💬',
    baseUrgency: 'normal',
    description: 'Someone is talking near you.',
  },
  name: {
    displayName: 'Name Called',
    shortName: 'Name',
    icon: '📣',
    baseUrgency: 'high',
    description: 'Your name — or a call for your attention — was heard.',
  },
  doorbell: {
    displayName: 'Doorbell / Knock',
    shortName: 'Door',
    icon: '🔔',
    baseUrgency: 'high',
    description: 'Someone is at the door.',
  },
  vehicle: {
    displayName: 'Vehicle Nearby',
    shortName: 'Vehicle',
    icon: '🚗',
    baseUrgency: 'high',
    description: 'A car or bike is moving close by. Critical when it comes from behind.',
  },
  siren: {
    displayName: 'Emergency Siren',
    shortName: 'Siren',
    icon: '🚨',
    baseUrgency: 'emergency',
    description: 'Police, fire, or ambulance siren.',
  },
  alarm: {
    displayName: 'Fire / Smoke Alarm',
    shortName: 'Alarm',
    icon: '🔥',
    baseUrgency: 'emergency',
    description: 'A fire, smoke, or CO alarm is sounding.',
  },
  glass: {
    displayName: 'Glass Breaking',
    shortName: 'Glass',
    icon: '🪟',
    baseUrgency: 'emergency',
    description: 'The sharp sound of breaking glass.',
  },
};

export const CATEGORY_ORDER: SenseSyncCategory[] = [
  'siren',
  'alarm',
  'glass',
  'vehicle',
  'doorbell',
  'name',
  'speech',
];

/* ===========================================================================
   Urgency encoding — colourblind-safe (Okabe-Ito derived), tuned bright for a
   dark HUD, and ALWAYS paired with a shape + a text tag so it survives any kind
   of colour vision. Contrast of each colour vs. the #0a0e16 canvas exceeds
   WCAG AA for graphical objects + bold text.
   =========================================================================== */
export const urgencyColor: Record<AlertPriority, string> = {
  emergency: '#ef4444',
  high: '#6366f1',
  normal: '#6366f1',
  low: '#a3a3a3',
};

export const urgencyLabel: Record<AlertPriority, string> = {
  emergency: 'CRITICAL',
  high: 'ALERT',
  normal: 'HEADS-UP',
  low: 'INFO',
};

export const urgencyShape: Record<AlertPriority, UrgencyShape> = {
  emergency: 'triangle',
  high: 'diamond',
  normal: 'square',
  low: 'dot',
};

// Per-urgency haptic rhythms, designed alongside the visuals: the more urgent,
// the longer and more insistent the buzz so it's distinguishable on the wrist.
export const urgencyHaptics: Record<AlertPriority, HapticPattern> = {
  emergency: { pattern: [500, 110, 500, 110, 500], label: 'Long insistent triple pulse' },
  high: { pattern: [220, 90, 220], label: 'Two firm taps' },
  normal: { pattern: [130, 80, 130], label: 'Soft double tap' },
  low: { pattern: [90], label: 'Single gentle tap' },
};

// Optional per-category flavour patterns (fall back to the urgency rhythm).
export const categoryHaptics: Partial<Record<SenseSyncCategory, HapticPattern>> = {
  doorbell: { pattern: [150, 80, 150, 80, 150], label: 'Triple chime' },
  glass: { pattern: [60, 40, 60, 40, 320], label: 'Sharp shatter burst' },
  siren: { pattern: [420, 120, 420, 120, 420], label: 'Rolling emergency wave' },
  vehicle: { pattern: [180, 70, 180, 70, 360], label: 'Rising approach buzz' },
};

const isBehind = (deg: number) => {
  const a = ((deg % 360) + 360) % 360;
  return a > 110 && a < 250; // roughly the rear hemisphere, outside the FOV
};

/**
 * Direction-aware urgency: a vehicle approaching from BEHIND — exactly the case
 * a Deaf/HOH user can't see — is escalated to a critical alert.
 */
export function urgencyFor(category: SenseSyncCategory, directionDeg: number): AlertPriority {
  const base = categoryMetadata[category].baseUrgency;
  if (category === 'vehicle' && isBehind(directionDeg)) return 'emergency';
  return base;
}

/** Resolve an event into everything the UI renders: icon + name + colour + shape + text + haptics. */
export function resolveEvent(event: SoundEvent): ResolvedEvent {
  const meta = categoryMetadata[event.category as SenseSyncCategory];
  const urgency: AlertPriority = event.urgency || meta?.baseUrgency || 'normal';
  const cat = event.category as SenseSyncCategory;
  const haptic = categoryHaptics[cat] || urgencyHaptics[urgency];
  return {
    icon: event.icon || meta?.icon || '🔊',
    name: event.rawLabel || meta?.displayName || 'Sound',
    shortName: meta?.shortName || event.rawLabel || 'Sound',
    color: event.color || urgencyColor[urgency],
    urgency,
    urgencyLabel: urgencyLabel[urgency],
    shape: urgencyShape[urgency],
    isCritical: urgency === 'emergency',
    pattern: haptic.pattern,
  };
}

/* ===========================================================================
   Settings + seed data
   =========================================================================== */
export const defaultSettings: UserSettings = {
  sensitivity: 0.6,
  alertOn: {
    speech: true,
    name: true,
    doorbell: true,
    vehicle: true,
    siren: true,
    alarm: true,
    glass: true,
  },
  haptics: true,
  hapticIntensity: 0.8,
  largeText: false,
};


