import { Router } from 'express';
import {
  getIndex,
  getLogin,
  postLogin,
  getMenu,
  logout,
  getUsuarios,
  getNuevoUsuario,
  postCrearUsuario,
  getEditarUsuario,
  postEditarUsuario,
  postEliminarUsuario,
  getProductosAdmin,
  getNuevoProducto,
  postCrearProducto,
  getEditarProducto,
  postEditarProducto,
  postEliminarProducto,
  getProductos,
  getInventario,
  getCarrito,
  postCarrito,
  postPedido,
  getDashboardAlias,
  getLoginAlias
} from '../controllers/controller.sport.js';
import { verificarSesion } from '../middleware/auth.middleware.js';
import { ensureCsrfToken, verificarCsrfToken } from '../middleware/csrf.middleware.js';

const router = Router();

router.get('/', getIndex);
router.get('/index.jsp', getIndex);

router.get('/login', ensureCsrfToken, getLoginAlias);
router.post('/login', ensureCsrfToken, verificarCsrfToken, postLogin);
router.get('/jsp/login.jsp', ensureCsrfToken, getLoginAlias);

router.get('/menu', verificarSesion, ensureCsrfToken, getMenu);
router.get('/jsp/dashboard.jsp', verificarSesion, ensureCsrfToken, getDashboardAlias);
router.get('/logout', verificarSesion, logout);
router.post('/logout', verificarSesion, ensureCsrfToken, verificarCsrfToken, logout);
router.get('/jsp/logout.jsp', verificarSesion, logout);

router.get('/usuarios', verificarSesion, ensureCsrfToken, getUsuarios);
router.get('/usuarios/nuevo', verificarSesion, ensureCsrfToken, getNuevoUsuario);
router.post('/usuarios/crear', verificarSesion, ensureCsrfToken, verificarCsrfToken, postCrearUsuario);
router.get('/usuarios/editar/:id', verificarSesion, ensureCsrfToken, getEditarUsuario);
router.post('/usuarios/editar', verificarSesion, ensureCsrfToken, verificarCsrfToken, postEditarUsuario);
router.post('/usuarios/eliminar', verificarSesion, ensureCsrfToken, verificarCsrfToken, postEliminarUsuario);

router.get('/admin/productos', verificarSesion, ensureCsrfToken, getProductosAdmin);
router.get('/admin/productos/nuevo', verificarSesion, ensureCsrfToken, getNuevoProducto);
router.post('/admin/productos/crear', verificarSesion, ensureCsrfToken, verificarCsrfToken, postCrearProducto);
router.get('/admin/productos/editar/:id', verificarSesion, ensureCsrfToken, getEditarProducto);
router.post('/admin/productos/editar', verificarSesion, ensureCsrfToken, verificarCsrfToken, postEditarProducto);
router.post('/admin/productos/eliminar', verificarSesion, ensureCsrfToken, verificarCsrfToken, postEliminarProducto);

router.get('/productos', verificarSesion, getProductos);
router.get('/inventario', verificarSesion, getInventario);
router.get('/carrito', verificarSesion, getCarrito);
router.post('/carrito', verificarSesion, ensureCsrfToken, verificarCsrfToken, postCarrito);
router.post('/pedidos', verificarSesion, ensureCsrfToken, verificarCsrfToken, postPedido);

export default router;
