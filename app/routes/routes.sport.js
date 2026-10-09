import { Router } from 'express';
import {
  getIndex,
  getLogin,
  getRegister,
  postLogin,
  postRegister,
  getMenu,
  logout,
  getUsuarios,
  getNuevoUsuario,
  postCrearUsuario,
  getEditarUsuario,
  postEditarUsuario,
  postEliminarUsuario,
  getProductosAdmin,
  getPedidosAdmin,
  getPedidosUsuario,
  getPerfil,
  postPerfil,
  getNuevoProducto,
  postCrearProducto,
  getEditarProducto,
  postEditarProducto,
  postEliminarProducto,
  postImportarProductos,
  postActualizarPedidoAdmin,
  getReportesAdmin,
  getCuponesAdmin,
  postCrearCupon,
  postEditarCupon,
  postEliminarCupon,
  getProductos,
  getProductoDetalle,
  getProductoPagina,
  postCalificacion,
  getCalificacionesAdmin,
  postModerarCalificacion,
  getInventario,
  getCarrito,
  postCarrito,
  postPedido,
  getCheckout,
  postCheckout,
  getDashboardAlias,
  getLoginAlias
} from '../controllers/controller.sport.js';
import { verificarSesion } from '../middleware/auth.middleware.js';
import { ensureCsrfToken, verificarCsrfToken } from '../middleware/csrf.middleware.js';

const router = Router();

router.get('/', getIndex);
router.get('/index.jsp', getIndex);

router.get('/login', ensureCsrfToken, getLoginAlias);
router.get('/register', ensureCsrfToken, getRegister);
router.post('/login', ensureCsrfToken, verificarCsrfToken, postLogin);
router.post('/register', ensureCsrfToken, verificarCsrfToken, postRegister);
router.get('/jsp/login.jsp', ensureCsrfToken, getLoginAlias);

router.get('/menu', verificarSesion, ensureCsrfToken, getMenu);
router.get('/jsp/dashboard.jsp', verificarSesion, ensureCsrfToken, getDashboardAlias);
router.get('/logout', verificarSesion, logout);
router.post('/logout', verificarSesion, ensureCsrfToken, verificarCsrfToken, logout);
router.get('/jsp/logout.jsp', verificarSesion, logout);
router.get('/perfil', verificarSesion, ensureCsrfToken, getPerfil);
router.post('/perfil', verificarSesion, ensureCsrfToken, verificarCsrfToken, postPerfil);

router.get('/usuarios', verificarSesion, ensureCsrfToken, getUsuarios);
router.get('/usuarios/nuevo', verificarSesion, ensureCsrfToken, getNuevoUsuario);
router.post('/usuarios/crear', verificarSesion, ensureCsrfToken, verificarCsrfToken, postCrearUsuario);
router.get('/usuarios/editar/:id', verificarSesion, ensureCsrfToken, getEditarUsuario);
router.post('/usuarios/editar', verificarSesion, ensureCsrfToken, verificarCsrfToken, postEditarUsuario);
router.post('/usuarios/eliminar', verificarSesion, ensureCsrfToken, verificarCsrfToken, postEliminarUsuario);

router.get('/admin/productos', verificarSesion, ensureCsrfToken, getProductosAdmin);
router.get('/admin/pedidos', verificarSesion, ensureCsrfToken, getPedidosAdmin);
router.post('/admin/pedidos/estado', verificarSesion, ensureCsrfToken, verificarCsrfToken, postActualizarPedidoAdmin);
router.get('/admin/reportes', verificarSesion, ensureCsrfToken, getReportesAdmin);
router.get('/admin/calificaciones', verificarSesion, ensureCsrfToken, getCalificacionesAdmin);
router.post('/admin/calificaciones', verificarSesion, ensureCsrfToken, verificarCsrfToken, postModerarCalificacion);
router.get('/admin/productos/nuevo', verificarSesion, ensureCsrfToken, getNuevoProducto);
router.post('/admin/productos/crear', verificarSesion, ensureCsrfToken, verificarCsrfToken, postCrearProducto);
router.get('/admin/productos/editar/:id', verificarSesion, ensureCsrfToken, getEditarProducto);
router.post('/admin/productos/editar', verificarSesion, ensureCsrfToken, verificarCsrfToken, postEditarProducto);
router.post('/admin/productos/eliminar', verificarSesion, ensureCsrfToken, verificarCsrfToken, postEliminarProducto);
router.post('/admin/productos/importar', verificarSesion, ensureCsrfToken, verificarCsrfToken, postImportarProductos);
router.get('/admin/cupones', verificarSesion, ensureCsrfToken, getCuponesAdmin);
router.post('/admin/cupones/crear', verificarSesion, ensureCsrfToken, verificarCsrfToken, postCrearCupon);
router.post('/admin/cupones/editar', verificarSesion, ensureCsrfToken, verificarCsrfToken, postEditarCupon);
router.post('/admin/cupones/eliminar', verificarSesion, ensureCsrfToken, verificarCsrfToken, postEliminarCupon);

router.get('/productos', verificarSesion, getProductos);
router.get('/productos/:id', verificarSesion, getProductoDetalle);
router.get('/producto/:id', verificarSesion, ensureCsrfToken, getProductoPagina);
router.post('/calificaciones', verificarSesion, ensureCsrfToken, verificarCsrfToken, postCalificacion);
router.get('/inventario', verificarSesion, getInventario);
router.get('/carrito', verificarSesion, getCarrito);
router.post('/carrito', verificarSesion, ensureCsrfToken, verificarCsrfToken, postCarrito);
router.get('/checkout', verificarSesion, ensureCsrfToken, getCheckout);
router.post('/checkout', verificarSesion, ensureCsrfToken, verificarCsrfToken, postCheckout);
router.get('/pedidos', verificarSesion, ensureCsrfToken, getPedidosUsuario);
router.post('/pedidos', verificarSesion, ensureCsrfToken, verificarCsrfToken, postPedido);

export default router;
