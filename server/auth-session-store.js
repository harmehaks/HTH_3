// Adapter for the official SDK's server-side session store contract.
// Browser cookies contain a signed session ID; tokens stay in the database.
export function createAuthSessionStore(store) {
  const key = (sid) => `auth-session:${sid}`;
  return {
    get(sid, callback) {
      (async () => {
        const record = await store.get(key(sid));
        if (!record) return null;
        if (record.expiresAt <= Date.now()) {
          await store.delete(key(sid));
          return null;
        }
        return record.payload;
      })().then((session) => callback(null, session), callback);
    },
    set(sid, payload, callback) {
      store
        .put('auth-session', {
          id: key(sid),
          expiresAt: payload.cookie.expires,
          payload,
        })
        .then(
          () => callback?.(null),
          (error) => callback?.(error),
        );
    },
    destroy(sid, callback) {
      store.delete(key(sid)).then(
        () => callback?.(null),
        (error) => callback?.(error),
      );
    },
  };
}
