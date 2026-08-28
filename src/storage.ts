import type { EvenAppBridge } from "@evenrealities/even_hub_sdk";

const TOKEN_KEY = "lo:session-token";
const TIMEOUT_MS = 1500;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("storage timeout")), TIMEOUT_MS)),
  ]);
}

export async function loadToken(bridge: EvenAppBridge): Promise<string> {
  try {
    const token = await withTimeout(bridge.getLocalStorage(TOKEN_KEY));
    if (token) return token;
  } catch {
    // The native store is best-effort; localStorage keeps browser simulation usable.
  }
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

export async function saveToken(bridge: EvenAppBridge, token: string): Promise<void> {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private WebViews can deny localStorage; the native store remains available.
  }
  try {
    await withTimeout(bridge.setLocalStorage(TOKEN_KEY, token));
  } catch {
    // The session still works until this WebView closes.
  }
}

