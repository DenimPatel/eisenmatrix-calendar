export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  key: string;
  value: unknown;
}

export interface AppSettings {
  theme: ThemePreference;
  weekStartsOn: 0 | 1;
  digestEnabled: boolean;
  /** `HH:mm` local time for the daily digest. */
  digestTime: string;
  notificationsEnabled: boolean;
  defaultView: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  weekStartsOn: 1,
  digestEnabled: false,
  digestTime: '08:00',
  notificationsEnabled: false,
  defaultView: 'today',
};

export interface SettingsKey {
  app: AppSettings;
  migration: { completedAt: number; version: number; legacyCount: number };
}
