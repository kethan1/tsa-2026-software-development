export type SenseSyncCategory =
  | 'fireAlarm'
  | 'siren'
  | 'doorbell'
  | 'babyCrying'
  | 'dogBarking'
  | 'knock'
  | 'phoneRinging'
  | 'alarm'
  | 'applause'
  | 'speech'
  | 'custom';

export type AlertPriority = 'low' | 'normal' | 'high' | 'emergency';

export interface SoundEvent {
  id: string;
  category: SenseSyncCategory;
  rawLabel: string;
  confidence: number;
  timestamp: Date;
  directionDeg: number; // 0 is ahead, 90 right, 180 behind, 270 left
  locationContext?: string;
  customName?: string;
  isSimulated?: boolean;
}

export interface HapticPattern {
  name: string;
  category: SenseSyncCategory;
  pattern: number[]; // pairs of [vibrateMs, pauseMs, vibrateMs...]
  intensity: number; // 0.0 to 1.0
  color: string;
  description: string;
}

export interface LocationProfile {
  id: string;
  name: string;
  description: string;
  icon: string;
  wifiSsid?: string;
  enabledAlerts: Record<SenseSyncCategory, boolean>;
  priorityOverrides: Record<SenseSyncCategory, AlertPriority>;
}
