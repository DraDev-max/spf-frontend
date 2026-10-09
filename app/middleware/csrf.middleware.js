import crypto from 'node:crypto';

export function ensureCsrfToken(req, res, next) {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.locals.csrfToken = req.session?.csrfToken || '';
  next();
}

export function verificarCsrfToken(req, res, next) {
  const expectedToken = req.session?.csrfToken;
  const providedToken =
    req.body?._csrf ||
    req.body?.csrfToken ||
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'];

  if (!expectedToken || typeof providedToken !== 'string' || providedToken !== expectedToken) {
    const wantsJson =
      req.xhr ||
      req.headers['x-requested-with'] === 'XMLHttpRequest' ||
      String(req.headers.accept || '').includes('application/json') ||
      req.path === '/carrito' ||
      req.path === '/pedidos';

    if (wantsJson) {
      return res.status(403).json({ error: 'La sesión expiró o el formulario es inválido' });
    }

    return res.status(403).render('login', {
      error: 'La sesión expiró o el formulario es inválido',
      message: null,
      csrfToken: res.locals.csrfToken || '',
      usuario: '',
      dbStatus: { connected: false, database: '', host: '', checkedAt: '' }
    });
  }

  next();
}
