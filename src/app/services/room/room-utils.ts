const CLIENT_ID_KEY = 'parches_client_id';

/**
 * Returns a persistent client ID stored in localStorage.
 * Generates and persists a new UUID on first visit.
 */
export function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}
