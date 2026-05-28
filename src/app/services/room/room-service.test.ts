import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClientId } from './room-utils';

const STORAGE_KEY = 'parches_client_id';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  });
});

describe('getClientId', () => {
  it('should generate a UUID on first call', () => {
    const id = getClientId();
    expect(id).toBeTruthy();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('should persist the generated ID in localStorage', () => {
    const id = getClientId();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(id);
  });

  it('should return the same ID on subsequent calls', () => {
    const first = getClientId();
    const second = getClientId();
    expect(second).toBe(first);
  });

  it('should reuse an existing ID from localStorage', () => {
    const existingId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, existingId);
    const id = getClientId();
    expect(id).toBe(existingId);
  });

  it('should not overwrite an existing ID in localStorage', () => {
    const existingId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, existingId);
    getClientId();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(existingId);
  });
});
