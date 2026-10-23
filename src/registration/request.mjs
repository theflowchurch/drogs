// Safe reads may recover from the host's non-JSON bot-check response. Writes
// are never replayed automatically. Every attempt, including its body read,
// has a deadline so a stalled connection cannot leave a form waiting forever.
export function createRegistrationRequest({ fetcher = (...args) => fetch(...args), getDoor = () => 'member', wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  return async function request(path, body, options = {}) {
    const { timeoutMs = body === undefined ? 8000 : 30000, attempts = body === undefined ? 2 : 1, ...fetchOptions } = options;
    const reads = body === undefined && (!fetchOptions.method || fetchOptions.method === 'GET');
    const tries = reads ? Math.min(2, Math.max(1, attempts)) : 1;
    for (let attempt = 0; attempt < tries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let failure;
      try {
        const response = await fetcher(`/api/registration/${path}`, {
          credentials: 'same-origin', cache: 'no-store',
          ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
          ...fetchOptions,
          headers: { 'X-Kc-Door': getDoor(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...fetchOptions.headers },
          signal: controller.signal,
        });
        let data;
        try { data = await response.json(); } catch { /* A proxy page is not an API response. */ }
        if (data !== undefined) {
          if (!response.ok) {
            const error = Error(data?.error || 'Unable to complete the request.');
            error.status = response.status;
            throw error;
          }
          return data;
        }
        failure = Error('The registration server is unavailable. Please try again shortly.');
      } catch (error) {
        if (error.status) throw error; // permission/validation errors are final
        failure = controller.signal.aborted
          ? Error('The connection is taking too long. Please try again.')
          : Error('The registration server is unavailable. Please try again shortly.');
      } finally { clearTimeout(timer); }
      if (attempt + 1 === tries) throw failure;
      await wait(350);
    }
  };
}
