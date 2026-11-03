let resolveReady: (() => void) | null = null;
let readyPromise = createReadyPromise();

function createReadyPromise() {
  return new Promise<void>((resolve) => { resolveReady = resolve; });
}

export function markBackendReady() {
  resolveReady?.();
  resolveReady = null;
}

export function resetBackendReadyGate() {
  if (!resolveReady) readyPromise = createReadyPromise();
}

export async function waitForBackendReady() {
  if (typeof window !== 'undefined') await readyPromise;
}
