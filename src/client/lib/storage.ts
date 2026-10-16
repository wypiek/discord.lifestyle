// localStorage can throw (private mode, blocked site data); treat that as "nothing saved".

export function load(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function save(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch {}
}
