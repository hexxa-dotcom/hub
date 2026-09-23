'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY_SEC = 'hexxa_business_timer_sec';
const STORAGE_KEY_RUNNING = 'hexxa_business_timer_running';
const STORAGE_KEY_LAST_TIMESTAMP = 'hexxa_business_timer_last_timestamp';
const STORAGE_KEY_ENABLED = 'hexxa_time_tracker_enabled';
const STORAGE_KEY_TEAM_CONFIG = 'hexxa_time_tracker_team_config';
const EVENT_NAME = 'hexxa:time_tracker_sync';

export function isMemberTimeTrackerEnabled(userIdOrEmail: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEAM_CONFIG);
    if (!raw) return true;
    const map = JSON.parse(raw);
    return map[userIdOrEmail] !== false;
  } catch {
    return true;
  }
}

export function setMemberTimeTrackerEnabled(userIdOrEmail: string, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEAM_CONFIG);
    const map = raw ? JSON.parse(raw) : {};
    map[userIdOrEmail] = enabled;
    localStorage.setItem(STORAGE_KEY_TEAM_CONFIG, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { type: 'team' } }));
  } catch (err) {
    console.error('Erro ao salvar permissão de time tracker:', err);
  }
}

export function useTimeTracker(userIdOrEmail?: string) {
  const [seconds, setSeconds] = useState<number>(() => {
    if (typeof window === 'undefined') return 5048; // fallback 01:24:08
    const saved = localStorage.getItem(STORAGE_KEY_SEC);
    return saved ? parseInt(saved, 10) : 5048;
  });

  const [isRunning, setIsRunning] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(STORAGE_KEY_RUNNING);
    return saved !== null ? saved === 'true' : true;
  });

  const [isEnabled, setIsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (userIdOrEmail) {
      return isMemberTimeTrackerEnabled(userIdOrEmail);
    }
    const saved = localStorage.getItem(STORAGE_KEY_ENABLED);
    return saved !== null ? saved === 'true' : true;
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronização de tick quando rodando
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          try {
            localStorage.setItem(STORAGE_KEY_SEC, String(next));
            localStorage.setItem(STORAGE_KEY_LAST_TIMESTAMP, String(Date.now()));
          } catch {}
          return next;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Sincronização entre instâncias (UserMenu, Dashboard, Tabs)
  useEffect(() => {
    function handleStorageOrCustom(e?: Event) {
      try {
        const savedSec = localStorage.getItem(STORAGE_KEY_SEC);
        if (savedSec) setSeconds(parseInt(savedSec, 10));

        const savedRunning = localStorage.getItem(STORAGE_KEY_RUNNING);
        if (savedRunning !== null) setIsRunning(savedRunning === 'true');

        if (userIdOrEmail) {
          setIsEnabledState(isMemberTimeTrackerEnabled(userIdOrEmail));
        } else {
          const savedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);
          if (savedEnabled !== null) setIsEnabledState(savedEnabled === 'true');
        }
      } catch {}
    }

    window.addEventListener('storage', handleStorageOrCustom);
    window.addEventListener(EVENT_NAME, handleStorageOrCustom);
    return () => {
      window.removeEventListener('storage', handleStorageOrCustom);
      window.removeEventListener(EVENT_NAME, handleStorageOrCustom);
    };
  }, [userIdOrEmail]);

  const toggleRunning = useCallback(() => {
    setIsRunning((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_RUNNING, String(next));
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { isRunning: next } }));
      } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setSeconds(0);
    try {
      localStorage.setItem(STORAGE_KEY_RUNNING, 'false');
      localStorage.setItem(STORAGE_KEY_SEC, '0');
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { isRunning: false, seconds: 0 } }));
    } catch {}
  }, []);

  const setIsEnabled = useCallback((value: boolean) => {
    setIsEnabledState(value);
    try {
      if (userIdOrEmail) {
        setMemberTimeTrackerEnabled(userIdOrEmail, value);
      } else {
        localStorage.setItem(STORAGE_KEY_ENABLED, String(value));
      }
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { isEnabled: value } }));
    } catch {}
  }, [userIdOrEmail]);

  const formatTime = useCallback((totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  return {
    seconds,
    formattedTime: formatTime(seconds),
    isRunning,
    isEnabled,
    toggleRunning,
    reset,
    setIsEnabled,
  };
}
