import { HapticPattern, LocationProfile, SenseSyncCategory } from './types';

export const categoryMetadata: Record<SenseSyncCategory, { displayName: string; icon: string; defaultColor: string }> = {
  fireAlarm: { displayName: 'Fire / Smoke Alarm', icon: '🔥', defaultColor: 'bg-red-500 text-red-100 hover:bg-red-600' },
  siren: { displayName: 'Emergency Siren', icon: '🚨', defaultColor: 'bg-rose-500 text-rose-100 hover:bg-rose-600' },
  doorbell: { displayName: 'Doorbell Ring', icon: '🔔', defaultColor: 'bg-amber-500 text-amber-100 hover:bg-amber-600' },
  babyCrying: { displayName: 'Baby Crying', icon: '👶', defaultColor: 'bg-teal-500 text-teal-100 hover:bg-teal-600' },
  dogBarking: { displayName: 'Dog Bark / Vehicle Horn', icon: '🐕', defaultColor: 'bg-violet-500 text-violet-100 hover:bg-violet-600' },
  knock: { displayName: 'Knock at Door', icon: '🚪', defaultColor: 'bg-purple-500 text-purple-100 hover:bg-purple-600' },
  phoneRinging: { displayName: 'Phone Ringing', icon: '📱', defaultColor: 'bg-sky-500 text-sky-100 hover:bg-sky-600' },
  alarm: { displayName: 'Timer / Beep Alarm', icon: '⏰', defaultColor: 'bg-orange-500 text-orange-100 hover:bg-orange-600' },
  applause: { displayName: 'Applause / Crowd', icon: '👏', defaultColor: 'bg-emerald-500 text-emerald-100 hover:bg-emerald-600' },
  speech: { displayName: 'Someone Speaking', icon: '💬', defaultColor: 'bg-indigo-500 text-indigo-100 hover:bg-indigo-600' },
  custom: { displayName: 'User Custom Sound', icon: '⭐', defaultColor: 'bg-slate-500 text-slate-100 hover:bg-slate-600' },
};

export const defaultHapticPatterns: Record<SenseSyncCategory, HapticPattern> = {
  fireAlarm: {
    name: 'Rapid Fire Danger',
    category: 'fireAlarm',
    pattern: [500, 100, 500, 100, 500],
    intensity: 1.0,
    color: '#ef4444',
    description: 'Extremely aggressive long pulses designed to wake up a sleeping user under direct urgency.'
  },
  siren: {
    name: 'Continuous Emergency Waves',
    category: 'siren',
    pattern: [800, 200, 800, 200],
    intensity: 1.0,
    color: '#f43f5e',
    description: 'Sustained emergency pulse wave mimicking sirens of nearby safety vehicles.'
  },
  doorbell: {
    name: 'Short Triple Bounce',
    category: 'doorbell',
    pattern: [150, 80, 150, 80, 150],
    intensity: 0.7,
    color: '#f59e0b',
    description: 'Quick cheerful triple bounce that mimics standard home chime bells.'
  },
  babyCrying: {
    name: 'Rapid Flutter Pulse',
    category: 'babyCrying',
    pattern: [100, 100, 100, 100, 100, 100, 100, 100],
    intensity: 0.85,
    color: '#14b8a6',
    description: 'Urgent fluttering alert that simulates high-frequency cries of building infants.'
  },
  dogBarking: {
    name: 'Double Bark Shock',
    category: 'dogBarking',
    pattern: [200, 100, 200],
    intensity: 0.6,
    color: '#8b5cf6',
    description: 'Double abrupt pulse mirroring localized sharp events like a canine alarm.'
  },
  knock: {
    name: 'Spaced Heavy Drum',
    category: 'knock',
    pattern: [300, 300, 300, 300],
    intensity: 0.75,
    color: '#a855f7',
    description: 'Measured, powerful single pulses mimicking physical knocks at the entry point.'
  },
  phoneRinging: {
    name: 'Cyclic Wave Vibration',
    category: 'phoneRinging',
    pattern: [400, 200, 400, 200, 400],
    intensity: 0.5,
    color: '#0ea5e9',
    description: 'Rhythmic, repeating buzz pattern resembling traditional standard mobile ringtones.'
  },
  alarm: {
    name: 'Strobe Beeping Pulse',
    category: 'alarm',
    pattern: [150, 150, 150, 150, 150, 150],
    intensity: 0.8,
    color: '#f97316',
    description: 'Uniform intervals of vibration to signal a microwave, stove, or clock alert.'
  },
  applause: {
    name: 'Gentle Noise Wave',
    category: 'applause',
    pattern: [60, 60, 60, 60, 60, 60, 120],
    intensity: 0.3,
    color: '#10b981',
    description: 'Very soft, irregular micro-bursts resembling localized speech cheers or applause.'
  },
  speech: {
    name: 'Single Tapping Nudge',
    category: 'speech',
    pattern: [100],
    intensity: 0.4,
    color: '#6366f1',
    description: 'A single, gentle tap to subtly notify that conversational speech is detected.'
  },
  custom: {
    name: 'Custom User Chime',
    category: 'custom',
    pattern: [200, 200, 400],
    intensity: 0.7,
    color: '#64748b',
    description: 'Your custom designed pattern saved to local device profiles.'
  },
};

export const defaultLocations: LocationProfile[] = [
  {
    id: 'home',
    name: 'Home Haven',
    description: 'Default environment. Prioritizes household alerts such as doorbells, baby cries, and entry knocks.',
    icon: '🏠',
    wifiSsid: 'MyHome_WiFi_5G',
    enabledAlerts: {
      fireAlarm: true, siren: true, doorbell: true, babyCrying: true,
      dogBarking: true, knock: true, phoneRinging: true, alarm: true,
      applause: false, speech: true, custom: true
    },
    priorityOverrides: {
      fireAlarm: 'emergency', siren: 'emergency', doorbell: 'high', babyCrying: 'emergency',
      dogBarking: 'normal', knock: 'high', phoneRinging: 'normal', alarm: 'high',
      applause: 'low', speech: 'low', custom: 'normal'
    }
  },
  {
    id: 'outdoor',
    name: 'City Outdoors',
    description: 'Boosts sensitivity of sirens and vehicles while filtering out household doorbells or timers completely.',
    icon: '🌳',
    wifiSsid: 'LTE_MUNICIPAL',
    enabledAlerts: {
      fireAlarm: true, siren: true, doorbell: false, babyCrying: false,
      dogBarking: true, knock: false, phoneRinging: true, alarm: false,
      applause: false, speech: true, custom: false
    },
    priorityOverrides: {
      fireAlarm: 'emergency', siren: 'emergency', doorbell: 'low', babyCrying: 'low',
      dogBarking: 'high', knock: 'low', phoneRinging: 'high', alarm: 'low',
      applause: 'low', speech: 'normal', custom: 'low'
    }
  },
  {
    id: 'school',
    name: 'School / Academic',
    description: 'Enters an eco-friendly quiet mode. Mutes secondary speech and appliances while strictly listening for emergency alarms.',
    icon: '🏫',
    wifiSsid: 'Campus_Guest_Secure',
    enabledAlerts: {
      fireAlarm: true, siren: true, doorbell: false, babyCrying: false,
      dogBarking: false, knock: true, phoneRinging: false, alarm: true,
      applause: true, speech: false, custom: false
    },
    priorityOverrides: {
      fireAlarm: 'emergency', siren: 'emergency', doorbell: 'low', babyCrying: 'low',
      dogBarking: 'low', knock: 'normal', phoneRinging: 'low', alarm: 'normal',
      applause: 'low', speech: 'low', custom: 'low'
    }
  }
];
