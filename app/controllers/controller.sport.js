import crypto from 'node:crypto';

const API_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:3000/api';

function getSessionUser(req) {
  if (req.session?.usuario && typeof req.session.usuario === 'object') {
    return req.session.usuario;
  }

  return {
    id: null,
    usuario: req.session?.usuario || 'usuario',
    nombre: req.session?.usuario || 'usuario',
    rol: req.session?.rol || 'cliente'
  };
}

function getSessionName(req) {
  const sessionUser = getSessionUser(req);
  return sessionUser.nombre || sessionUser.usuario || 'usuario';
}

function getSessionRole(req) {
  return req.session?.rol || req.session?.usuario?.rol || 'cliente';
}

function requireLogin(req, res) {
  if (!req.session?.token) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }

  return true;
}

function requireAdmin(req, res) {
  if (!requireLogin(req, res)) {
    return false;
  }

  if (getSessionRole(req) !== 'admin') {
    res.status(403).render('login', {
      error: 'No tienes permisos para entrar a esta seccion',
      message: null,
      csrfToken: res.locals.csrfToken || '',
      usuario: req.session?.usuario?.usuario || req.session?.usuario || '',
      dbStatus: req.dbStatus || { connected: false, database: '', host: '', checkedAt: '' }
    });
    return false;
  }

  return true;
}

function requireModerator(req, res) {
  if (!requireLogin(req, res)) return false;
  if (!['admin', 'mod'].includes(getSessionRole(req))) {
    res.status(403).send('Permisos insuficientes');
    return false;
  }
  return true;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }

  const text = String(value).trim();
  return text === '' ? fallback : text;
}

function normalizeCategoryLabel(value) {
  if (!value) {
    return '';
  }

  const label = String(value).replace(/-/g, ' ').trim();
  return label.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapProductForCatalog(product) {
  return {
    id: product.id,
    title: product.nombre,
    description: product.descripcion || '',
    sku: product.sku || '',
    brand: product.marca || 'Sport Family',
    price: toNumber(product.precio_final ?? product.precio, 0),
    basePrice: toNumber(product.precio, 0),
    discountPercent: toNumber(product.descuento_final_porcentaje ?? product.descuento_porcentaje, 0),
    commentsCount: toInteger(product.comentarios_count, 0),
    stock: toInteger(product.stock, 0),
    categoryId: product.categoria_id,
    category: product.categoria_nombre || product.categoria || 'general',
    thumbnail: product.imagen_url || product.thumbnail || ''
  };
}

function mapProductForInventory(product) {
  return {
    id: product.id,
    nombre: product.nombre,
    precio: toNumber(product.precio, 0),
    precio_final: toNumber(product.precio_final ?? product.precio, 0),
    descuento_porcentaje: toNumber(product.descuento_porcentaje, 0),
    descuento_final_porcentaje: toNumber(product.descuento_final_porcentaje ?? product.descuento_porcentaje, 0),
    comentarios_count: toInteger(product.comentarios_count, 0),
    stock: toInteger(product.stock, 0),
    categoria: normalizeCategoryLabel(product.categoria_nombre || product.categoria || 'general'),
    marca: product.marca || 'Sport Family'
  };
}

function mapCartItem(item) {
  return {
    id: item.id,
    nombre: item.producto_nombre ?? item.nombre ?? '',
    precio: toNumber(item.precio ?? item.precio_unitario, 0),
    cantidad: toInteger(item.cantidad, 0),
    subtotal: toNumber(item.subtotal, 0)
  };
}

function buildCartSummary(payload) {
  const items = Array.isArray(payload.items) ? payload.items.map(mapCartItem) : [];
  const itemsCount = Number.isFinite(Number(payload.items_count))
    ? Number(payload.items_count)
    : items.reduce((total, item) => total + item.cantidad, 0);
  const total = Number.isFinite(Number(payload.total))
    ? Number(payload.total)
    : items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    success: payload.success !== false,
    items_count: itemsCount,
    total,
    items
  };
}

async function backendRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const text = await response.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message = data && typeof data === 'object' && data.error
      ? data.error
      : `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function fetchBackendHealth() {
  try {
    const data = await backendRequest('/health/mysql');
    return {
      connected: Boolean(data?.mysqlConnected ?? data?.ok),
      database: data?.database || '',
      host: data?.host || '',
      checkedAt: data?.checkedAt || ''
    };
  } catch (error) {
    return {
      connected: false,
      database: '',
      host: '',
      checkedAt: '',
      error: error.message || 'No se pudo verificar MySQL'
    };
  }
}

async function apiRequest(req, path, options = {}) {
  return backendRequest(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${req.session.token}`,
      ...(options.headers || {})
    }
  });
}

function ensureCatalogSession(req) {
  const user = getSessionUser(req);
  const stableUserId = user.id || user.email || user.usuario || user.nombre;
  if (stableUserId) {
    req.session.catalogoSessionId = `user-${stableUserId}`;
    return req.session.catalogoSessionId;
  }

  if (!req.session.catalogoSessionId) {
    req.session.catalogoSessionId = req.session.id;
  }

  return req.session.catalogoSessionId;
}

async function leerCarritoBackend(req) {
  const sessionId = ensureCatalogSession(req);
  const data = await backendRequest(`/carrito?session_id=${encodeURIComponent(sessionId)}&estado=activo`);
  return buildCartSummary(data);
}

function renderLogin(req, res, error = null, message = null) {
  return res.render('login', {
    error,
    message,
    csrfToken: res.locals.csrfToken || '',
    usuario: req.session?.usuario?.usuario || req.session?.usuario || '',
    dbStatus: req.dbStatus || { connected: false, database: '', host: '', checkedAt: '' }
  });
}

function renderAdmin(view, req, res, locals = {}) {
  return res.render(view, {
    usuario: getSessionName(req),
    rol: getSessionRole(req),
    csrfToken: res.locals.csrfToken || '',
    dbStatus: req.dbStatus || { connected: false, database: '', host: '', checkedAt: '' },
    ...locals
  });
}

async function fetchCategorias(req) {
  const categorias = await apiRequest(req, '/categorias?activo=1');
  return Array.isArray(categorias) ? categorias : [];
}

function defaultProducto() {
  return {
    id: '',
    categoria_id: '',
    nombre: '',
    descripcion: '',
    marca: '',
    sku: '',
    size: 'U',
    color: 'default',
    low_stock_threshold: 5,
    warehouse_location: '',
    stock_adjustment: 0,
    precio: 0,
    descuento_porcentaje: 0,
    stock: 0,
    imagen_url: '',
    activo: 1
  };
}

function defaultUsuario() {
  return {
    id: '',
    nombre: '',
    email: '',
    password: '',
    rol: 'cliente',
    residence: '',
    province: '',
    municipality: '',
    postal_code: '',
    address: '',
    cardholder_name: '',
    card_number: '',
    card_expiration: '',
    card_cvv: '',
    identification_number: ''
  };
}

function readProfileForm(body, includeAdminOnly = false) {
  const form = {
    nombre: toText(body.nombre, ''),
    email: toText(body.email, ''),
    residence: toText(body.residence ?? body.residencia, ''),
    province: toText(body.province ?? body.provincia, ''),
    municipality: toText(body.municipality ?? body.municipio, ''),
    postal_code: toText(body.postal_code ?? body.codigo_postal, ''),
    address: toText(body.address ?? body.direccion, ''),
    cardholder_name: toText(body.cardholder_name ?? body.tarjeta_nombre, ''),
    card_number: toText(body.card_number ?? body.tarjeta_numero, ''),
    card_expiration: toText(body.card_expiration ?? body.tarjeta_vencimiento, ''),
    card_cvv: toText(body.card_cvv ?? body.tarjeta_cvv, '')
  };
  if (includeAdminOnly) form.identification_number = toText(body.identification_number ?? body.numero_identificacion, '');
  return form;
}

export async function getLogin(req, res) {
  req.dbStatus = await fetchBackendHealth();

  if (req.session?.token) {
    return res.redirect('/menu');
  }

  return renderLogin(req, res);
}

export function getRegister(req, res) {
  if (req.session?.token) return res.redirect('/menu');
  return res.render('register', { error: null, csrfToken: res.locals.csrfToken || '' });
}

export async function postLogin(req, res) {
  req.dbStatus = await fetchBackendHealth();

  try {
    const usuario = toText(req.body.usuario, '');
    const password = toText(req.body.password ?? req.body.contraseña, '');

    const data = await backendRequest('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ usuario, password })
    });

    req.session.token = data.token;
    req.session.usuario = data.usuario || {
      id: null,
      usuario,
      nombre: data.usuario?.nombre || usuario,
      email: data.usuario?.email || '',
      rol: data.rol || data.usuario?.rol || 'cliente'
    };
    req.session.rol = data.rol || data.usuario?.rol || 'cliente';
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    req.session.loginMessage = `Welcome, ${getSessionName(req)}`;
    req.session.catalogoSessionId = null;
    ensureCatalogSession(req);

    return res.redirect('/menu');
  } catch (error) {
    return renderLogin(req, res, error.message || 'Credenciales incorrectas');
  }
}

export async function postRegister(req, res) {
  req.dbStatus = await fetchBackendHealth();

  try {
    await backendRequest('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: toText(req.body.nombre ?? req.body.usuario, ''),
        email: toText(req.body.email, ''),
        password: toText(req.body.password, '')
      })
    });

    return renderLogin(req, res, null, 'Cuenta creada. Ya puedes iniciar sesión.');
  } catch (error) {
    return res.render('register', {
      error: error.message || 'No se pudo crear la cuenta',
      csrfToken: res.locals.csrfToken || ''
    });
  }
}

export function getIndex(req, res) {
  if (req.session?.token) {
    return res.redirect('/menu');
  }

  return res.redirect('/login');
}

export async function getMenu(req, res) {
  req.dbStatus = await fetchBackendHealth();

  if (!req.session?.token) {
    return res.redirect('/login');
  }

  const loginMessage = req.session.loginMessage || '';
  req.session.loginMessage = null;

  return res.render('menu', {
    usuario: getSessionName(req),
    rol: getSessionRole(req),
    csrfToken: res.locals.csrfToken || '',
    isAdmin: getSessionRole(req) === 'admin',
    isModerator: ['admin', 'mod'].includes(getSessionRole(req)),
    dbStatus: req.dbStatus,
    loginMessage
  });
}

export function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar sesion:', err);
    }

    res.redirect('/login');
  });
}

export async function getUsuarios(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const usuarios = await apiRequest(req, '/usuarios');
    return renderAdmin('listar', req, res, {
      usuarios: Array.isArray(usuarios) ? usuarios : []
    });
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    return renderAdmin('listar', req, res, {
      usuarios: [],
      error: error.message || 'No se pudieron cargar los usuarios'
    });
  }
}

export function getNuevoUsuario(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  return renderAdmin('crear', req, res, {
    error: null,
    usuarioForm: defaultUsuario()
  });
}

export async function postCrearUsuario(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const usuarioForm = {
    nombre: toText(req.body.nombre, ''),
    email: toText(req.body.email, ''),
    password: toText(req.body.password, ''),
    rol: toText(req.body.rol, 'cliente')
  };

  try {
    await apiRequest(req, '/usuarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(usuarioForm)
    });

    return res.redirect('/usuarios');
  } catch (error) {
    return renderAdmin('crear', req, res, {
      error: error.message || 'Error al crear usuario',
      usuarioForm
    });
  }
}

export async function getEditarUsuario(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const id = toInteger(req.params.id, null);
  if (id === null) {
    return res.redirect('/usuarios');
  }

  try {
    const usuarioForm = await apiRequest(req, `/usuarios/${id}`);
    return renderAdmin('editar', req, res, {
      error: null,
      usuarioForm,
      usuarioId: id,
      sesionUsuario: getSessionName(req)
    });
  } catch (error) {
    console.error('Error al cargar usuario:', error);
    return res.redirect('/usuarios');
  }
}

export async function postEditarUsuario(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const id = toInteger(req.body.id, null);
  const usuarioForm = {
    id,
    nombre: toText(req.body.nombre, ''),
    email: toText(req.body.email, ''),
    password: toText(req.body.password, ''),
    rol: toText(req.body.rol, 'cliente'),
    ...readProfileForm(req.body, true)
  };

  if (usuarioForm.password === '') {
    delete usuarioForm.password;
  }

  try {
    await apiRequest(req, `/usuarios/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(usuarioForm)
    });

    return res.redirect('/usuarios');
  } catch (error) {
    return renderAdmin('editar', req, res, {
      error: error.message || 'Error al actualizar usuario',
      usuarioForm,
      sesionUsuario: getSessionName(req)
    });
  }
}

export async function getPerfil(req, res) {
  if (!requireLogin(req, res)) return;

  try {
    const perfil = await apiRequest(req, '/perfil');
    return res.render('perfil', {
      usuario: getSessionName(req),
      csrfToken: res.locals.csrfToken || '',
      error: null,
      message: null,
      perfil
    });
  } catch (error) {
    return res.render('perfil', {
      usuario: getSessionName(req),
      csrfToken: res.locals.csrfToken || '',
      error: error.message || 'No se pudo cargar el perfil',
      message: null,
      perfil: defaultUsuario()
    });
  }
}

export async function postPerfil(req, res) {
  if (!requireLogin(req, res)) return;

  const perfil = readProfileForm(req.body, false);
  const password = toText(req.body.password, '');
  if (password) perfil.password = password;

  try {
    const actualizado = await apiRequest(req, '/perfil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(perfil)
    });

    req.session.usuario = { ...req.session.usuario, nombre: actualizado.nombre, email: actualizado.email };
    return res.render('perfil', {
      usuario: getSessionName(req),
      csrfToken: res.locals.csrfToken || '',
      error: null,
      message: 'Perfil actualizado',
      perfil: actualizado
    });
  } catch (error) {
    return res.render('perfil', {
      usuario: getSessionName(req),
      csrfToken: res.locals.csrfToken || '',
      error: error.message || 'No se pudo actualizar el perfil',
      message: null,
      perfil
    });
  }
}

export async function postEliminarUsuario(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const id = toInteger(req.body.id, null);
  if (id === null) {
    return res.redirect('/usuarios');
  }

  try {
    await apiRequest(req, `/usuarios/${id}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
  }

  return res.redirect('/usuarios');
}


export async function getCuponesAdmin(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const cupones = await apiRequest(req, '/cupones');
    return renderAdmin('cupones-listar', req, res, { cupones: Array.isArray(cupones) ? cupones : [], error: null });
  } catch (error) {
    return renderAdmin('cupones-listar', req, res, { cupones: [], error: error.message || 'No se pudieron cargar los cupones' });
  }
}

export async function postCrearCupon(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    await apiRequest(req, '/cupones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo: toText(req.body.codigo, ''),
        descripcion: toText(req.body.descripcion, ''),
        descuento_porcentaje: toNumber(req.body.descuento_porcentaje, 0),
        activo: toInteger(req.body.activo, 1)
      })
    });
  } catch (error) {
    console.error('Error al crear cupon:', error);
  }
  return res.redirect('/admin/cupones');
}

export async function postEditarCupon(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    await apiRequest(req, `/cupones/${toInteger(req.body.id, 0)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo: toText(req.body.codigo, ''),
        descripcion: toText(req.body.descripcion, ''),
        descuento_porcentaje: toNumber(req.body.descuento_porcentaje, 0),
        activo: toInteger(req.body.activo, 1)
      })
    });
  } catch (error) {
    console.error('Error al editar cupon:', error);
  }
  return res.redirect('/admin/cupones');
}

export async function postEliminarCupon(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    await apiRequest(req, `/cupones/${toInteger(req.body.id, 0)}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Error al eliminar cupon:', error);
  }
  return res.redirect('/admin/cupones');
}

export async function getProductosAdmin(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const [productos, categorias] = await Promise.all([
      apiRequest(req, '/productos'),
      fetchCategorias(req)
    ]);

    return renderAdmin('productos-listar', req, res, {
      productos: Array.isArray(productos) ? productos : [],
      categorias
    });
  } catch (error) {
    console.error('Error al cargar inventario:', error);
    return renderAdmin('productos-listar', req, res, {
      productos: [],
      categorias: [],
      error: error.message || 'No se pudo cargar el inventario'
    });
  }
}

export async function getPedidosAdmin(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const params = new URLSearchParams(); ['q','estado','fecha','cliente_email'].forEach(k => { if (req.query[k]) params.set(k, req.query[k]); }); const pedidos = await apiRequest(req, `/pedidos?${params.toString()}`);
    return renderAdmin('pedidos-listar', req, res, {
      pedidos: Array.isArray(pedidos) ? pedidos : [],
      titulo: 'Pedidos de usuarios',
      descripcion: 'Todas las ordenes creadas desde el carrito.',
      adminView: true,
      query: req.query || {}
    });
  } catch (error) {
    console.error('Error al cargar pedidos:', error);
    return renderAdmin('pedidos-listar', req, res, {
      pedidos: [],
      titulo: 'Pedidos de usuarios',
      descripcion: 'Todas las ordenes creadas desde el carrito.',
      adminView: true,
      query: req.query || {},
      error: error.message || 'No se pudieron cargar los pedidos'
    });
  }
}

export async function getPedidosUsuario(req, res) {
  if (!requireLogin(req, res)) {
    return;
  }

  if (getSessionRole(req) === 'admin') {
    return getPedidosAdmin(req, res);
  }

  try {
    const sessionId = ensureCatalogSession(req);
    const email = req.session?.usuario?.email || '';
    const params = new URLSearchParams(email ? { cliente_email: email } : { session_id: sessionId });
    const pedidos = await apiRequest(req, `/pedidos?${params.toString()}`);
    return res.render('pedidos-listar', {
      usuario: getSessionName(req),
      rol: getSessionRole(req),
      csrfToken: res.locals.csrfToken || '',
      pedidos: Array.isArray(pedidos) ? pedidos : [],
      titulo: 'Mis pedidos',
      descripcion: 'Ordenes creadas desde tu carrito.',
      adminView: false,
      query: {}
    });
  } catch (error) {
    console.error('Error al cargar pedidos del usuario:', error);
    return res.render('pedidos-listar', {
      usuario: getSessionName(req),
      rol: getSessionRole(req),
      csrfToken: res.locals.csrfToken || '',
      pedidos: [],
      titulo: 'Mis pedidos',
      descripcion: 'Ordenes creadas desde tu carrito.',
      adminView: false,
      query: {},
      error: error.message || 'No se pudieron cargar tus pedidos'
    });
  }
}

export async function getNuevoProducto(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const categorias = await fetchCategorias(req);
    return renderAdmin('productos-crear', req, res, {
      error: null,
      categorias,
      producto: defaultProducto()
    });
  } catch (error) {
    console.error('Error al abrir formulario de producto:', error);
    return renderAdmin('productos-crear', req, res, {
      error: error.message || 'No se pudo abrir el formulario',
      categorias: [],
      producto: defaultProducto()
    });
  }
}

export async function postCrearProducto(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const producto = {
    categoria_id: req.body.categoria_id || '',
    nombre: toText(req.body.nombre, ''),
    descripcion: toText(req.body.descripcion, ''),
    marca: toText(req.body.marca, ''),
    sku: toText(req.body.sku, ''),
    size: toText(req.body.size, 'U'),
    color: toText(req.body.color, 'default'),
    low_stock_threshold: toInteger(req.body.low_stock_threshold, 5),
    warehouse_location: toText(req.body.warehouse_location, ''),
    precio: toNumber(req.body.precio, 0),
    descuento_porcentaje: toNumber(req.body.descuento_porcentaje, 0),
    stock: toInteger(req.body.stock, 0),
    imagen_url: toText(req.body.imagen_url, ''),
    activo: toInteger(req.body.activo, 1)
  };

  try {
    await apiRequest(req, '/productos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(producto)
    });

    return res.redirect('/admin/productos');
  } catch (error) {
    const categorias = await fetchCategorias(req).catch(() => []);
    return renderAdmin('productos-crear', req, res, {
      error: error.message || 'Error al crear producto',
      categorias,
      producto
    });
  }
}

export async function getEditarProducto(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const id = toInteger(req.params.id, null);
  if (id === null) {
    return res.redirect('/admin/productos');
  }

  try {
    const [producto, categorias] = await Promise.all([
      apiRequest(req, `/productos/${id}`),
      fetchCategorias(req)
    ]);

    return renderAdmin('productos-editar', req, res, {
      error: null,
      categorias,
      producto: producto || defaultProducto()
    });
  } catch (error) {
    console.error('Error al cargar producto:', error);
    return res.redirect('/admin/productos');
  }
}

export async function postEditarProducto(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const id = toInteger(req.body.id, null);
  const producto = {
    id,
    categoria_id: req.body.categoria_id || '',
    nombre: toText(req.body.nombre, ''),
    descripcion: toText(req.body.descripcion, ''),
    marca: toText(req.body.marca, ''),
    sku: toText(req.body.sku, ''),
    size: toText(req.body.size, 'U'),
    color: toText(req.body.color, 'default'),
    low_stock_threshold: toInteger(req.body.low_stock_threshold, 5),
    warehouse_location: toText(req.body.warehouse_location, ''),
    stock_adjustment: toInteger(req.body.stock_adjustment, 0),
    precio: toNumber(req.body.precio, 0),
    descuento_porcentaje: toNumber(req.body.descuento_porcentaje, 0),
    stock: toInteger(req.body.stock, 0),
    imagen_url: toText(req.body.imagen_url, ''),
    activo: toInteger(req.body.activo, 1)
  };

  try {
    await apiRequest(req, `/productos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(producto)
    });

    return res.redirect('/admin/productos');
  } catch (error) {
    const categorias = await fetchCategorias(req).catch(() => []);
    return renderAdmin('productos-editar', req, res, {
      error: error.message || 'Error al actualizar producto',
      categorias,
      producto
    });
  }
}

export async function postEliminarProducto(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const id = toInteger(req.body.id, null);
  if (id === null) {
    return res.redirect('/admin/productos');
  }

  try {
    await apiRequest(req, `/productos/${id}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
  }

  return res.redirect('/admin/productos');
}


export async function postImportarProductos(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    await apiRequest(req, '/productos/importar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv: req.body.csv }) });
  } catch (error) {
    console.error('Error al importar productos:', error);
  }
  return res.redirect('/admin/productos');
}

export async function postActualizarPedidoAdmin(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    await apiRequest(req, `/pedidos/${toInteger(req.body.id, 0)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: req.body.estado }) });
  } catch (error) {
    console.error('Error al actualizar pedido:', error);
  }
  return res.redirect('/admin/pedidos');
}

export async function getReportesAdmin(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const reportes = await apiRequest(req, '/reportes');
    return renderAdmin('reportes', req, res, { reportes });
  } catch (error) {
    return renderAdmin('reportes', req, res, { reportes: { salesByProduct: [], inventory: [], financial: {} }, error: error.message || 'No se pudieron cargar los reportes' });
  }
}

export async function getProductos(req, res) {
  if (!requireLogin(req, res)) {
    return;
  }

  try {
    const params = new URLSearchParams({ activo: '1' });
    ['q', 'categoria_id', 'marca', 'min_price', 'max_price', 'in_stock'].forEach((key) => {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        params.set(key, req.query[key]);
      }
    });
    const products = await backendRequest(`/productos?${params.toString()}`);
    res.json({ products: products.map(mapProductForCatalog) });
  } catch (error) {
    console.error('Error al cargar productos:', error);
    res.status(502).json({ error: 'No se pudieron cargar los productos del backend' });
  }
}

export async function getProductoDetalle(req, res) {
  if (!requireLogin(req, res)) {
    return;
  }

  try {
    const product = mapProductForCatalog(await backendRequest(`/productos/${req.params.id}`));
    const params = new URLSearchParams({
      exclude_id: String(product.id),
      limit: '4'
    });
    if (product.categoryId) params.set('categoria_id', product.categoryId);
    if (product.brand) params.set('marca', product.brand);
    const recommended = await backendRequest(`/productos/recomendados?${params.toString()}`);
    res.json({ product, recommended: recommended.map(mapProductForCatalog) });
  } catch (error) {
    console.error('Error al cargar detalle de producto:', error);
    res.status(502).json({ error: 'No se pudo cargar el detalle del producto' });
  }
}

export async function getProductoPagina(req, res) {
  if (!req.session?.token) {
    return res.redirect('/login');
  }

  try {
    const product = mapProductForCatalog(await backendRequest(`/productos/${req.params.id}`));
    const params = new URLSearchParams({ exclude_id: String(product.id), limit: '4' });
    if (product.categoryId) params.set('categoria_id', product.categoryId);
    if (product.brand) params.set('marca', product.brand);
    const recommended = await backendRequest(`/productos/recomendados?${params.toString()}`);
    const [publicRatings, ownRatings] = await Promise.all([
      backendRequest(`/calificaciones?producto_id=${product.id}&estado=aprobada`),
      apiRequest(req, `/calificaciones/mias?producto_id=${product.id}`).catch(() => [])
    ]);
    const ownIds = new Set((ownRatings || []).map((rating) => rating.id));
    const ratings = [
      ...(ownRatings || []),
      ...(publicRatings || []).filter((rating) => !ownIds.has(rating.id))
    ];

    return res.render('producto-detalle', {
      usuario: getSessionName(req),
      csrfToken: res.locals.csrfToken || '',
      product,
      recommended: recommended.map(mapProductForCatalog),
      ratings
    });
  } catch (error) {
    console.error('Error al abrir detalle de producto:', error);
    return res.redirect('/menu');
  }
}

export async function postCalificacion(req, res) {
  if (!requireLogin(req, res)) return;
  try {
    await apiRequest(req, '/calificaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        producto_id: req.body.producto_id,
        puntuacion: req.body.puntuacion,
        comentario: req.body.comentario
      })
    });
  } catch (error) {
    console.error('Error al crear calificacion:', error);
  }
  return res.redirect(`/producto/${req.body.producto_id}`);
}

export async function getCalificacionesAdmin(req, res) {
  if (!requireModerator(req, res)) return;
  try {
    const ratings = await apiRequest(req, '/calificaciones/moderacion');
    return renderAdmin('calificaciones-listar', req, res, {
      ratings: Array.isArray(ratings) ? ratings : []
    });
  } catch (error) {
    return renderAdmin('calificaciones-listar', req, res, {
      ratings: [],
      error: error.message || 'No se pudieron cargar las calificaciones'
    });
  }
}

export async function postModerarCalificacion(req, res) {
  if (!requireModerator(req, res)) return;
  try {
    await apiRequest(req, `/calificaciones/${req.body.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: req.body.estado })
    });
  } catch (error) {
    console.error('Error al moderar calificacion:', error);
  }
  return res.redirect('/admin/calificaciones');
}

export async function getInventario(req, res) {
  if (!requireLogin(req, res)) {
    return;
  }
  if (getSessionRole(req) !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores pueden consultar el inventario local' });
  }

  try {
    const products = await backendRequest('/productos?activo=1');
    res.json({ productos: products.map(mapProductForInventory) });
  } catch (error) {
    console.error('Error al cargar inventario:', error);
    res.status(502).json({ error: 'No se pudo cargar el inventario del backend' });
  }
}

export async function getCarrito(req, res) {
  if (!requireLogin(req, res)) {
    return;
  }

  try {
    const carrito = await leerCarritoBackend(req);
    res.json(carrito);
  } catch (error) {
    console.error('Error al cargar carrito:', error);
    res.status(502).json({ error: 'No se pudo cargar el carrito del backend' });
  }
}

export async function postCarrito(req, res) {
  if (!requireLogin(req, res)) {
    return;
  }

  try {
    const sessionId = ensureCatalogSession(req);
    const accion = req.body.accion;

    if (!accion) {
      return res.json(await leerCarritoBackend(req));
    }

    if (accion === 'agregar') {
      const productoId = toInteger(req.body.id, null);
      const cantidad = Math.max(1, toInteger(req.body.cantidad, 1));
      const nombre = String(req.body.nombre ?? '').trim();
      const precio = toNumber(req.body.precio, 0);

      await backendRequest('/carrito', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          producto_id: productoId,
          producto_nombre: nombre,
          precio_unitario: precio,
          cantidad
        })
      });
    } else if (accion === 'actualizar') {
      const id = toInteger(req.body.id, null);
      const cantidad = toInteger(req.body.cantidad, 0);

      if (id === null) {
        return res.status(400).json({ error: 'ID de carrito invalido' });
      }

      if (cantidad <= 0) {
        await backendRequest(`/carrito/${id}`, { method: 'DELETE' });
      } else {
        await backendRequest(`/carrito/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ cantidad })
        });
      }
    } else if (accion === 'eliminar') {
      const id = toInteger(req.body.id, null);

      if (id === null) {
        return res.status(400).json({ error: 'ID de carrito invalido' });
      }

      await backendRequest(`/carrito/${id}`, { method: 'DELETE' });
    } else if (accion === 'vaciar') {
      await backendRequest(`/carrito?session_id=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      });
    } else {
      return res.status(400).json({ error: 'Accion de carrito no soportada' });
    }

    res.json(await leerCarritoBackend(req));
  } catch (error) {
    console.error('Error al modificar carrito:', error);
    res.status(502).json({ error: 'No se pudo sincronizar el carrito con el backend' });
  }
}

export async function postPedido(req, res) {
  if (!requireLogin(req, res)) {
    return;
  }

  try {
    const sessionId = ensureCatalogSession(req);
    const pedido = await backendRequest('/pedidos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sessionId,
        estado: 'enviado'
      })
    });

    const carrito = await leerCarritoBackend(req);
    res.json({
      success: true,
      pedido,
      carrito
    });
  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(502).json({ error: 'No se pudo crear el pedido en el backend' });
  }
}

export async function getCheckout(req, res) {
  if (!req.session?.token) {
    return res.redirect('/login');
  }

  return res.render('checkout', {
    usuario: getSessionName(req),
    csrfToken: res.locals.csrfToken || '',
    error: null,
    pedido: null,
    form: {}
  });
}

export async function postCheckout(req, res) {
  if (!requireLogin(req, res)) {
    return;
  }

  const form = {
    postal_code: toText(req.body.postal_code, ''),
    location: toText(req.body.location, ''),
    province: toText(req.body.province, ''),
    municipality: toText(req.body.municipality, ''),
    address: toText(req.body.address, ''),
    card_name: toText(req.body.card_name, ''),
    card_number: toText(req.body.card_number, ''),
    coupon_code: toText(req.body.coupon_code, ''),
    card_expiry: toText(req.body.card_expiry, ''),
    card_cvv: toText(req.body.card_cvv, '')
  };

  try {
    const sessionId = ensureCatalogSession(req);
    const direccion = [
      form.address,
      form.location,
      form.municipality,
      form.province,
      form.postal_code
    ].filter(Boolean).join(', ');

    const pedido = await backendRequest('/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        cliente_nombre: getSessionName(req),
        cliente_email: req.session?.usuario?.email || null,
        direccion,
        cupon_codigo: form.coupon_code || null,
        estado: 'enviado'
      })
    });

    return res.render('checkout', {
      usuario: getSessionName(req),
      csrfToken: res.locals.csrfToken || '',
      error: null,
      pedido,
      form: {}
    });
  } catch (error) {
    console.error('Error al finalizar checkout:', error);
    return res.render('checkout', {
      usuario: getSessionName(req),
      csrfToken: res.locals.csrfToken || '',
      error: error.message || 'No se pudo crear el pedido',
      pedido: null,
      form
    });
  }
}

export function getDashboardAlias(req, res) {
  return getMenu(req, res);
}

export function getLoginAlias(req, res) {
  return getLogin(req, res);
}
