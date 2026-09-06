const getApiBaseUrl = () => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  return (env.VITE_API_BASE_URL || '').replace(/\/$/, '');
};

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
};

