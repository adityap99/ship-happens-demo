/**
 * Ship Happens SDK — Phase 0 (minimal)
 *
 * Captures uncaught JS errors and unhandled promise rejections.
 * Transmits a FailureEnvelope to the backend via navigator.sendBeacon.
 *
 * Phase 1 will add: DOM snapshots, ring buffer, full network log,
 * PII scrubbing, and the ShipHappens.capture() manual trigger API.
 */

const ENDPOINT =
  (import.meta.env.VITE_SHIP_HAPPENS_ENDPOINT as string | undefined) ??
  'http://localhost:8000';

// Stable session ID across page loads within the same tab session.
let sessionId = sessionStorage.getItem('sh_session_id');
if (!sessionId) {
  sessionId = crypto.randomUUID();
  sessionStorage.setItem('sh_session_id', sessionId);
}

// Lightweight interaction recorder — captures clicks with data-testid selectors.
// Phase 1 will extend this to the full interaction sequence with timing.
const interactionSequence: Array<Record<string, unknown>> = [];

document.addEventListener(
  'click',
  (event) => {
    const target = event.target as HTMLElement;
    if (!target) return;
    const testId = target.closest('[data-testid]')?.getAttribute('data-testid');
    interactionSequence.push({
      type: 'click',
      selector: testId ? `[data-testid="${testId}"]` : target.tagName.toLowerCase(),
      timestamp: new Date().toISOString(),
    });
  },
  true,
);

function buildEnvelope(message: string, stack: string) {
  return {
    id: crypto.randomUUID(),
    sessionId,
    timestamp: new Date().toISOString(),
    appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.1.0',
    deploymentHash: (import.meta.env.VITE_DEPLOYMENT_HASH as string | undefined) ?? 'dev',
    browser: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    url: window.location.href,
    error: {
      message,
      stackTrace: stack,
      sourceMapsRef: null,
    },
    interactionSequence: [...interactionSequence],
    networkLog: [],
    consoleLog: [],
    domSnapshot: { initial: '', atFailure: '' },
  };
}

function transmit(envelope: object) {
  // fetch with keepalive is more reliable than sendBeacon for CORS + application/json.
  // keepalive ensures the request completes even if the page navigates away.
  fetch(`${ENDPOINT}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
    keepalive: true,
  }).catch(() => {
    // Network failure — silently swallow; never break the app
  });
}

/**
 * Explicit capture — call this directly from try/catch blocks inside React
 * event handlers, where window.onerror may not fire (React 17+ event delegation).
 * Also pushes to window.__shipHappensCaptured so Playwright can read it.
 */
export function capture(err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err));
  // Expose to Playwright reproduction runner via a global buffer
  const w = window as Record<string, unknown>;
  if (!Array.isArray(w.__shipHappensCaptured)) w.__shipHappensCaptured = [];
  (w.__shipHappensCaptured as unknown[]).push({ message: e.message, stack: e.stack });
  transmit(buildEnvelope(e.message, e.stack ?? ''));
}

window.addEventListener('error', (event) => {
  if (!event.error) return;
  transmit(buildEnvelope(event.message, event.error.stack ?? ''));
});

window.addEventListener('unhandledrejection', (event) => {
  const err = event.reason as { message?: string; stack?: string } | null;
  transmit(buildEnvelope(err?.message ?? String(event.reason), err?.stack ?? ''));
});
