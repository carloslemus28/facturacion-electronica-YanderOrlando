const cleanDigits = (value) => {
  if (value === undefined || value === null) return '';

  return String(value).replace(/\D/g, '');
};

const getSignerConfig = () => {
  const enabled = String(process.env.SIGNER_ENABLED || 'false').toLowerCase() === 'true';
  const signerUrl = process.env.SIGNER_URL || 'http://svfe-api-firmador:8113';
  const privateKeyPassword = process.env.SIGNER_PRIVATE_KEY_PASSWORD;

  if (!enabled) {
    const error = new Error('El firmador no está habilitado. Configure SIGNER_ENABLED=true en el .env');
    error.statusCode = 500;
    throw error;
  }

  if (!signerUrl) {
    const error = new Error('No se ha configurado SIGNER_URL en el .env');
    error.statusCode = 500;
    throw error;
  }

  if (!privateKeyPassword) {
    const error = new Error('No se ha configurado SIGNER_PRIVATE_KEY_PASSWORD en el .env');
    error.statusCode = 500;
    throw error;
  }

  return {
    signerUrl: signerUrl.replace(/\/+$/, ''),
    privateKeyPassword
  };
};

const parseSignerErrorMessage = (body) => {
  if (!body) return 'Error desconocido del firmador';

  if (typeof body === 'string') return body;

  if (body.mensaje) return body.mensaje;

  if (body.codigo && body.mensaje) {
    return `${body.codigo}: ${body.mensaje}`;
  }

  try {
    return JSON.stringify(body);
  } catch (error) {
    return 'Error desconocido del firmador';
  }
};

const signDteJson = async ({ nit, dteJson }) => {
  const config = getSignerConfig();

  const cleanNit = cleanDigits(nit);

  if (!cleanNit) {
    const error = new Error('El NIT del emisor es obligatorio para firmar el DTE');
    error.statusCode = 400;
    throw error;
  }

  if (!dteJson || typeof dteJson !== 'object') {
    const error = new Error('El JSON del DTE es obligatorio para firmar');
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch(`${config.signerUrl}/firmardocumento/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      nit: cleanNit,
      activo: true,
      passwordPri: config.privateKeyPassword,
      dteJson
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(`El firmador respondió con error HTTP ${response.status}`);
    error.statusCode = 502;
    error.signerResponse = data;
    throw error;
  }

  if (!data || data.status !== 'OK' || !data.body) {
    const error = new Error(`No se pudo firmar el DTE: ${parseSignerErrorMessage(data?.body || data)}`);
    error.statusCode = 502;
    error.signerResponse = data;
    throw error;
  }

  return {
    signedJws: data.body,
    signerResponse: data
  };
};

const checkSignerStatus = async () => {
  const config = getSignerConfig();

  const response = await fetch(`${config.signerUrl}/firmardocumento/status`);
  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    message: text
  };
};

module.exports = {
  signDteJson,
  checkSignerStatus
};