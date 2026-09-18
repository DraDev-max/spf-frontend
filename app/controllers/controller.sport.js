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
    res.status(403).render('login', { error: 'No tienes permisos para entrar a esta seccion' });
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
    brand: product.marca || 'Sport Family',
    price: toNumber(product.precio, 0),
    stock: toInteger(product.stock, 0),
    category: product.categoria_nombre || product.categoria || 'general',
    thumbnail: product.imagen_url || product.thumbnail || ''
  };
}

function mapProductForInventory(product) {
  return {
    id: product.id,
    nombre: product.nombre,
    precio: toNumber(product.precio, 0),
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

function renderLogin(req, res, error = null) {
  return res.render('login', {
    error,
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
    precio: 0,
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
    rol: 'cliente'
  };
}

export async function getLogin(req, res) {
  req.dbStatus = await fetchBackendHealth();

  if (req.session?.token) {
    return res.redirect('/menu');
  }

  return renderLogin(req, res);
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
    req.session.cookie.maxAge = 30 * 60 * 1000;
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    ensureCatalogSession(req);

    return res.redirect('/menu');
  } catch (error) {
    return renderLogin(req, res, error.message || 'Credenciales incorrectas');
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

  return res.render('menu', {
    usuario: getSessionName(req),
    rol: getSessionRole(req),
    csrfToken: res.locals.csrfToken || '',
    isAdmin: getSessionRole(req) === 'admin',
    dbStatus: req.dbStatus
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
    rol: toText(req.body.rol, 'cliente')
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
    precio: toNumber(req.body.precio, 0),
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
    precio: toNumber(req.body.precio, 0),
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

export async function getProductos(req, res) {
  if (!requireLogin(req, res)) {
    return;
  }

  try {
    const products = await backendRequest('/productos?activo=1');
    res.json({ products: products.map(mapProductForCatalog) });
  } catch (error) {
    console.error('Error al cargar productos:', error);
    res.status(502).json({ error: 'No se pudieron cargar los productos del backend' });
  }
}

export async function getInventario(req, res) {
  if (!requireLogin(req, res)) {
    return;
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

export function getDashboardAlias(req, res) {
  return getMenu(req, res);
}

export function getLoginAlias(req, res) {
  return getLogin(req, res);
}
