const cleanDigits = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\D/g, '');
};

const getTimeoutMs = () => {
  const value = Number(process.env.MH_TIMEOUT_MS || 30000);
  return Number.isFinite(value) && value > 0 ? value : 30000;
};

const getHaciendaAuthConfig = () => {
  const authUrl = process.env.MH_AUTH_URL;
  const user = process.env.MH_USER || process.env.MH_NIT;
  const password = process.env.MH_PASSWORD;

  if (!authUrl) {
    const error = new Error('No se ha configurado MH_AUTH_URL en el .env');
    error.statusCode = 500;
    throw error;
  }

  if (!user) {
    const error = new Error('No se ha configurado MH_USER o MH_NIT en el .env');
    error.statusCode = 500;
    throw error;
  }

  if (!password) {
    const error = new Error('No se ha configurado MH_PASSWORD en el .env');
    error.statusCode = 500;
    throw error;
  }

  return {
    authUrl,
    user: cleanDigits(user) || user,
    password,
    timeoutMs: getTimeoutMs()
  };
};

let tokenCache = {
  token: null,
  expiresAt: 0,
  rawResponse: null
};

const clearHaciendaAuthCache = () => {
  tokenCache = {
    token: null,
    expiresAt: 0,
    rawResponse: null
  };
};

const parseJsonSafely = async (response) => {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      raw: text
    };
  }
};

const extractToken = (data) => {
  const body = data?.body || data;

  return body?.token
    || body?.access_token
    || body?.accessToken
    || data?.token
    || data?.access_token
    || data?.accessToken
    || null;
};

const normalizeAuthorizationHeader = (token) => {
  const cleanToken = String(token || '').trim();

  if (!cleanToken) return null;

  return /^Bearer\s+/i.test(cleanToken) ? cleanToken : `Bearer ${cleanToken}`;
};

const buildAuthorizationVariants = (token) => {
  const raw = String(token || '').trim();

  if (!raw) return [];

  const stripped = raw.replace(/^Bearer\s+/i, '').trim();
  const bearer = stripped ? `Bearer ${stripped}` : raw;

  return [...new Set([
    bearer,
    raw,
    stripped
  ].filter(Boolean))];
};

const requestHaciendaToken = async () => {
  const config = getHaciendaAuthConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  const form = new URLSearchParams();
  form.set('user', config.user);
  form.set('pwd', config.password);

  let response;
  let data;

  try {
    response = await fetch(config.authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: form.toString(),
      signal: controller.signal
    });

    data = await parseJsonSafely(response);
  } catch (error) {
    const requestError = new Error(
      error.name === 'AbortError'
        ? 'Tiempo de espera agotado al autenticar contra Hacienda'
        : `No fue posible autenticar contra Hacienda: ${error.message}`
    );
    requestError.statusCode = 502;
    throw requestError;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = new Error(`Hacienda respondió con error HTTP ${response.status} al autenticar`);
    error.statusCode = 502;
    error.mhResponse = data;
    throw error;
  }

  const token = extractToken(data);
  const authorization = normalizeAuthorizationHeader(token);

  if (!authorization) {
    const error = new Error('Hacienda no devolvió token de autenticación');
    error.statusCode = 502;
    error.mhResponse = data;
    throw error;
  }

    const rawToken = String(token || '').trim();
const authVariants = buildAuthorizationVariants(rawToken);

tokenCache = {
  token: authorization,
  authorization,
  rawToken,
  authVariants,
  expiresAt: Date.now() + (20 * 60 * 1000),
  rawResponse: data
};

  return tokenCache;
};

const getHaciendaAuthorization = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache;
  }

  return requestHaciendaToken();
};

module.exports = {
  getHaciendaAuthorization,
  clearHaciendaAuthCache
};
