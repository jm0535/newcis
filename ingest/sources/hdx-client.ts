const HDX_PRIMARY_USER_AGENT = "curl/7.85.0";
const HDX_FALLBACK_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HDX_DEFAULT_HEADERS = {
  "user-agent": HDX_PRIMARY_USER_AGENT,
  accept: "application/json",
  "accept-language": "en-US,en;q=0.9",
  connection: "keep-alive",
};
const HDX_FALLBACK_HEADERS = {
  ...HDX_DEFAULT_HEADERS,
  "user-agent": HDX_FALLBACK_USER_AGENT,
};
const MAX_HDX_ATTEMPTS = 3;
const HDX_TIMEOUT_MS = 30_000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHeaders(base: Record<string, string>, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  for (const [name, value] of Object.entries(base)) {
    if (!headers.has(name)) {
      headers.set(name, value);
    }
  }
  return headers;
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

function shouldRetryError(error: unknown) {
  if (error instanceof Error) {
    return (
      error.name === "AbortError" ||
      /network|timed out|timeout|failed to fetch/i.test(error.message)
    );
  }
  return false;
}

export async function hdxFetch(url: string, options: RequestInit = {}) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_HDX_ATTEMPTS; attempt += 1) {
    const headers = buildHeaders(
      attempt === 1 ? HDX_DEFAULT_HEADERS : HDX_FALLBACK_HEADERS,
      options,
    );

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: options.signal ?? AbortSignal.timeout(HDX_TIMEOUT_MS),
      });

      if (res.ok) {
        return res;
      }

      if (res.status === 406 && attempt === 1) {
        lastError = new Error(`HDX 406 received; retrying with alternate user agent`);
      } else if (shouldRetryStatus(res.status) && attempt < MAX_HDX_ATTEMPTS) {
        lastError = new Error(`HDX HTTP ${res.status}`);
      } else {
        return res;
      }
    } catch (error) {
      lastError = error;
      if (!shouldRetryError(error) || attempt === MAX_HDX_ATTEMPTS) {
        throw error;
      }
    }

    const backoff = 500 * attempt + Math.floor(Math.random() * 300);
    await delay(Math.min(backoff, 2_000));
  }

  throw lastError instanceof Error ? lastError : new Error("HDX fetch failed after retries");
}
