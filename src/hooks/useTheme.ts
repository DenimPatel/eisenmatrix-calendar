import { useEffect, useRef } from 'react';
import { settingsRepo } from '@/db/repository';
import { useUiStore } from '@/store/useUiStore';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types';
import { reportBootFailure, STORAGE_UNAVAILABLE_MESSAGE } from '@/lib/bootFailure';

export function useTheme() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const loaded = useRef(false);

  useEffect(() => {
    void settingsRepo
      .get<AppSettings>('app', DEFAULT_SETTINGS)
      .then((settings) => {
        loaded.current = true;
        setTheme(settings.theme ?? 'system');
      })
      .catch((error: unknown) => {
        reportBootFailure(STORAGE_UNAVAILABLE_MESSAGE, error);
      });
  }, [setTheme]);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      root.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    if (!loaded.current) return;
    void settingsRepo
      .get<AppSettings>('app', DEFAULT_SETTINGS)
      .then((settings) => settingsRepo.set('app', { ...settings, theme }))
      .catch((error: unknown) => {
        reportBootFailure(STORAGE_UNAVAILABLE_MESSAGE, error);
      });
  }, [theme]);
}
