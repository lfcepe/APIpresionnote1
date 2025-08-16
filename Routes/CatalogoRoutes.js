// Routes/CatalogoRoutes.js
const express = require('express');
const router = express.Router();
const C = require('../Controllers/CatalogoController');

// CRUD
router.post('/', C.crearCatalogo);
router.get('/', C.listarCatalogos);
router.get('/:id', C.obtenerCatalogo);
router.put('/:id', C.actualizarCatalogo);
router.delete('/:id', C.eliminarCatalogo);

module.exports = router;
