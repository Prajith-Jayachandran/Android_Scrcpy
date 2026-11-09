'use client';

import { useEffect } from 'react';

export function useSecurityShield() {
  useEffect(() => {
    // Only enforce active lock-down in browser runtime
    if (typeof window === 'undefined') return;

    // 1. Neutralize Console logging in production to prevent leaking runtime states
    if (process.env.NODE_ENV === 'production') {
      const noop = () => {};
      console.log = noop;
      console.debug = noop;
      console.info = noop;
      console.warn = noop;
      console.table = noop;
    }

    // 2. Prevent right-click context menu (blocks "Inspect Element")
    const handleContextMenu = (e: MouseEvent) => {
      // Allow context menu only if user is holding Shift (safe backdoor if ever needed) or disable entirely
      e.preventDefault();
    };

    // 3. Prevent DevTools & Source Inspection Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 key
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + Shift + I/J/C or Cmd + Option + I/J/C (Developer Tools)
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Cmd + Option + I/J on macOS
      if (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + U or Cmd + U (View Source)
      if (isCtrlOrMeta && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + S (Save webpage)
      if (isCtrlOrMeta && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 4. Anti-Debugger Tripwire (runs only in production)
    let tripwireTimer: NodeJS.Timeout | null = null;
    if (process.env.NODE_ENV === 'production') {
      tripwireTimer = setInterval(() => {
        const start = performance.now();
        // Inline debugger statement: If devtools is attached, execution freezes here
        Function('debugger')();
        const elapsed = performance.now() - start;

        // If execution paused longer than 150ms, DevTools is actively open
        if (elapsed > 150) {
          try {
            document.body.innerHTML =
              '<div style="background:#030712;color:#ef4444;display:flex;align-items:center;justify-content:center;height:100vh;font-family:monospace;font-size:14px;letter-spacing:1px;font-weight:bold;">[AETHER SECURITY SHIELD]: Inspection and debugging are disabled.</div>';
          } catch (_) {}
        }
      }, 2000);
    }

    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (tripwireTimer) clearInterval(tripwireTimer);
    };
  }, []);
}
