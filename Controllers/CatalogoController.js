// Controllers/CatalogoController.js
const Catalogo = require('../Models/Catalogo');
const { Op } = require('sequelize');

// Crear
// POST /catalogo
// body: { categoria (requerido), valor (opcional) }
const crearCatalogo = async (req, res) => {
  try {
    const { categoria, valor } = req.body;
    if (!categoria || categoria.trim() === '') {
      return res.status(400).json({ error: 'categoria es requerida' });
    }

    // Evita duplicados por (categoria, valor)
    const existente = await Catalogo.findOne({ where: { categoria, valor } });
    if (existente) {
      return res.status(409).json({ error: 'El par (categoria, valor) ya existe' });
    }

    const nuevo = await Catalogo.create({ categoria, valor });
    res.status(201).json({ mensaje: 'Creado', catalogo: nuevo });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear', detalle: err.message });
  }
};

// Listar con filtros y paginación
// GET /catalogo?categoria=...&valor=...&page=1&size=20
const listarCatalogos = async (req, res) => {
  try {
    const { categoria, valor, page = 1, size = 20 } = req.query;
    const where = {};
    if (categoria) where.categoria = { [Op.iLike]: `%${categoria}%` };
    if (valor) where.valor = { [Op.iLike]: `%${valor}%` };

    const limit = Math.min(Number(size) || 20, 100);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const { rows, count } = await Catalogo.findAndCountAll({
      where,
      order: [['categoria', 'ASC'], ['valor', 'ASC']],
      limit,
      offset,
    });

    res.json({
      total: count,
      page: Number(page) || 1,
      size: limit,
      data: rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar', detalle: err.message });
  }
};

// Obtener por id
// GET /catalogo/:id
const obtenerCatalogo = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Catalogo.findByPk(id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener', detalle: err.message });
  }
};

// Actualizar
// PUT /catalogo/:id
// body: { categoria?, valor? }
const actualizarCatalogo = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Catalogo.findByPk(id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    const { categoria, valor } = req.body;

    // si cambian categoria/valor, verifica duplicado
    if (categoria !== undefined || valor !== undefined) {
      const nuevaCategoria = categoria ?? item.categoria;
      const nuevoValor = valor ?? item.valor;
      const dup = await Catalogo.findOne({
        where: {
          categoria: nuevaCategoria,
          valor: nuevoValor,
          id: { [Op.ne]: id },
        },
      });
      if (dup) return res.status(409).json({ error: 'El par (categoria, valor) ya existe' });
    }

    await item.update({
      categoria: categoria ?? item.categoria,
      valor: valor ?? item.valor,
    });

    res.json({ mensaje: 'Actualizado', catalogo: item });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar', detalle: err.message });
  }
};

// Eliminar (hard delete)
// DELETE /catalogo/:id
const eliminarCatalogo = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Catalogo.findByPk(id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    await item.destroy();
    res.json({ mensaje: 'Eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar', detalle: err.message });
  }
};

module.exports = {
  crearCatalogo,
  listarCatalogos,
  obtenerCatalogo,
  actualizarCatalogo,
  eliminarCatalogo,
};
