// A cold Edge request may include authentication and RPC time. Keep a bounded
// budget without exposing the browser's raw AbortError or retrying mutations.
export async function requestJson(url, options, {fetchImpl = fetch, timeoutMs = 30000} = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {timedOut = true; controller.abort();}, timeoutMs);
  try {
    const response = await fetchImpl(url, {...options, signal: controller.signal});
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error ?? 'SERVER_ERROR');
      error.definitive = response.status < 500;
      throw error;
    }
    const serverTime = Number(response.headers.get('x-server-time'));
    return {data, serverTime: serverTime > 0 ? serverTime : null};
  } catch (error) {
    if (timedOut) throw new Error('CONNECTION_TIMEOUT');
    throw error;
  } finally {clearTimeout(timer);}
}
