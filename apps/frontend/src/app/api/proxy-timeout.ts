export const API_PROXY_TIMEOUT_MS = Number.parseInt(process.env.API_PROXY_TIMEOUT_MS || '20000', 10);

export const createProxyAbortSignal = (): AbortSignal | undefined => {
  if (!Number.isFinite(API_PROXY_TIMEOUT_MS) || API_PROXY_TIMEOUT_MS <= 0) {
    return undefined;
  }

  return AbortSignal.timeout(API_PROXY_TIMEOUT_MS);
};
