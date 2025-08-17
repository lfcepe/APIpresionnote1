// Controllers/PacienteController.js
const Paciente = require('../Models/Paciente');
const Catalogo = require('../Models/Catalogo');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sequelize = require('../Models/config/databaseconfig');
const { fn, col, Op } = require('sequelize');
const { issueTokens } = require('../Middleware/auth'); 

const CATEGORIA_ESTADO_USUARIO = 'ESTADOUSUARIO';

/* =================== Helpers de normalización =================== */
function stripAccents(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function normalizeSpaces(str) {
  return (str || '').trim().replace(/\s+/g, ' ');
}
function requiredNonEmpty(v) {
  return !!(v && v.toString().trim().length > 0);
}
function buildNombreKey4(n1, n2, a1, a2) {
  const raw = `${normalizeSpaces(n1)} ${normalizeSpaces(n2)} ${normalizeSpaces(a1)} ${normalizeSpaces(a2)}`;
  return stripAccents(raw).toUpperCase();
}
function fullNombre(n1, n2)   { return normalizeSpaces(`${n1} ${n2}`); }
function fullApellido(a1, a2) { return normalizeSpaces(`${a1} ${a2}`); }

/* ==================== Catálogo ACTIVO / INACTIVO ==================== */
const getCatalogoId = async (valor) => {
  const row = await Catalogo.findOne({
    where: { categoria: CATEGORIA_ESTADO_USUARIO, valor },
    attributes: ['id'],
  });
  if (!row) throw new Error(`Catálogo no encontrado: ${CATEGORIA_ESTADO_USUARIO}/${valor}`);
  return row.id;
};

/* ============ Búsqueda case-insensitive por usuario ============ */
const findPacienteByUsuarioCI = async (usuario, t) => {
  const u = (usuario || '').trim().toLowerCase();
  return Paciente.findOne({
    where: sequelize.where(fn('LOWER', col('usuario')), u),
    transaction: t
  });
};

/* ============================= Endpoints ============================= */

// POST /auth/register
const registrarPaciente = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    let {
      primer_nombre, segundo_nombre,
      primer_apellido, segundo_apellido,
      usuario, contraseña
    } = req.body;

    if (![primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, usuario, contraseña].every(requiredNonEmpty)) {
      await t.rollback();
      return res.status(400).json({ error: 'Debe enviar primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, usuario y contraseña.' });
    }

    primer_nombre    = normalizeSpaces(primer_nombre);
    segundo_nombre   = normalizeSpaces(segundo_nombre);
    primer_apellido  = normalizeSpaces(primer_apellido);
    segundo_apellido = normalizeSpaces(segundo_apellido);

    const nombre_key = buildNombreKey4(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido);
    const nombre     = fullNombre(primer_nombre, segundo_nombre);
    const apellido   = fullApellido(primer_apellido, segundo_apellido);

    const usuarioTrim = (usuario || '').trim();
    const idActivo    = await getCatalogoId('ACTIVO');
    const idInactivo  = await getCatalogoId('INACTIVO');

    // 1) Existe por usuario (CI)
    let existente = await findPacienteByUsuarioCI(usuarioTrim, t);
    const hash = await bcrypt.hash(contraseña, 10);

    if (existente) {
      await existente.update({
        primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
        nombre, apellido, nombre_key,
        usuario: usuarioTrim,
        contraseña: hash,
        id_estado: idActivo,
      }, { transaction: t });

      await t.commit();
      const { accessToken, refreshToken } = issueTokens(existente.id);
      return res.status(200).json({
        mensaje: 'Paciente actualizado y activado',
        accessToken, refreshToken,
        usuario: existente
      });
    }

    // 2) Inactivo por nombre_key
    const candidatos = await Paciente.findAll({
      where: {
        id_estado: idInactivo,
        [Op.and]: [sequelize.where(fn('LOWER', col('nombre_key')), nombre_key.toLowerCase())]
      },
      transaction: t
    });

    if (candidatos.length === 1) {
      const p = candidatos[0];

      const colision = await findPacienteByUsuarioCI(usuarioTrim, t);
      if (colision && colision.id !== p.id) {
        await t.rollback();
        return res.status(409).json({ error: 'El usuario ya está en uso por otra cuenta' });
      }

      await p.update({
        primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
        nombre, apellido, nombre_key,
        usuario: usuarioTrim,
        contraseña: hash,
        id_estado: idActivo,
      }, { transaction: t });

      await t.commit();
      const { accessToken, refreshToken } = issueTokens(p.id);
      return res.status(200).json({
        mensaje: 'Cuenta reactivada',
        accessToken, refreshToken,
        usuario: p
      });
    }

    if (candidatos.length > 1) {
      await t.rollback();
      return res.status(409).json({ error: 'Ambigüedad con los nombres (2+2). Contacte soporte.' });
    }

    // 3) Crear nuevo
    const nuevo = await Paciente.create({
      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      nombre, apellido, nombre_key,
      usuario: usuarioTrim,
      contraseña: hash,
      id_estado: idActivo,
    }, { transaction: t });

    await t.commit();
    const { accessToken, refreshToken } = issueTokens(nuevo.id);
    return res.status(201).json({
      mensaje: 'Paciente registrado',
      accessToken, refreshToken,
      usuario: nuevo
    });
  } catch (error) {
    await t.rollback();
    if (error?.original?.code === '23505') {
      return res.status(409).json({ error: 'El usuario ya existe (índice único)' });
    }
    return res.status(500).json({ error: 'Error al registrar', detalle: error.message });
  }
};

// POST /auth/login
const loginPaciente = async (req, res) => {
  try {
    let { usuario, contraseña } = req.body;
    if (!usuario || !contraseña) {
      return res.status(400).json({ error: 'usuario y contraseña son requeridos' });
    }

    const usuarioCI = (usuario || '').trim().toLowerCase();

    const paciente = await Paciente.findOne({
      where: sequelize.where(fn('LOWER', col('usuario')), usuarioCI),
      include: [{ model: Catalogo, attributes: ['categoria', 'valor'] }],
    });

    if (!paciente) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const esValido = await bcrypt.compare(contraseña, paciente.contraseña);
    if (!esValido) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const cat = paciente.Catalogo;
    const categoriaOk = cat?.categoria?.trim().toUpperCase() === 'ESTADOUSUARIO';
    const valorOk     = cat?.valor?.trim().toUpperCase() === 'ACTIVO';

    if (!categoriaOk || !valorOk) {
      return res.status(403).json({
        error: 'Cuenta inactiva. Debe registrarse nuevamente para reactivarla.',
        action: '/auth/register'
      });
    }

    const { accessToken, refreshToken } = issueTokens(paciente.id);
    res.json({
      mensaje: 'Login exitoso',
      accessToken, refreshToken,
      user: {
        id: paciente.id,
        usuario: paciente.usuario,
        primer_nombre: paciente.primer_nombre,
        segundo_nombre: paciente.segundo_nombre,
        primer_apellido: paciente.primer_apellido,
        segundo_apellido: paciente.segundo_apellido
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en el login', detalle: error.message });
  }
};

// POST /auth/refresh
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Falta refreshToken' });

    // Opcional: en dev puedes loguear payload sin verificar:
    // console.log('DEBUG decode:', jwt.decode(refreshToken, { complete: true }));

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokens = issueTokens(payload.id); // rota ambos
    return res.json(tokens);
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh expirado', detalle: `exp=${e.expiredAt}` });
    }
    if (e.message?.includes('secret or public key must be provided')) {
      return res.status(500).json({ error: 'Falta JWT_REFRESH_SECRET en servidor' });
    }
    return res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
};


// GET /auth/me (protegido)
const me = async (req, res) => {
  try {
    const p = await Paciente.findByPk(req.userId, {
      attributes: [
        'id','usuario','id_estado',
        'primer_nombre','segundo_nombre','primer_apellido','segundo_apellido',
        'nombre','apellido'
      ]
    });
    if (!p) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json({ user: p });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener perfil', detalle: error.message });
  }
};

// PUT /auth/:id (protegido)
const actualizarPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    let {
      primer_nombre, segundo_nombre,
      primer_apellido, segundo_apellido,
      usuario, contraseña
    } = req.body;

    const p = await Paciente.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Paciente no encontrado' });

    const updates = {};

    if (usuario && usuario.trim() !== p.usuario) {
      const dup = await Paciente.findOne({
        where: sequelize.where(fn('LOWER', col('usuario')), usuario.trim().toLowerCase())
      });
      if (dup && dup.id !== p.id) {
        return res.status(409).json({ error: 'El usuario ya existe' });
      }
      updates.usuario = usuario.trim();
    }

    const n1 = primer_nombre   ?? p.primer_nombre;
    const n2 = segundo_nombre  ?? p.segundo_nombre;
    const a1 = primer_apellido ?? p.primer_apellido;
    const a2 = segundo_apellido?? p.segundo_apellido;

    if (primer_nombre || segundo_nombre || primer_apellido || segundo_apellido) {
      if (![n1, n2, a1, a2].every(requiredNonEmpty)) {
        return res.status(400).json({ error: 'Se requieren los cuatro campos de nombre/apellido para actualizar.' });
      }
      updates.primer_nombre   = normalizeSpaces(n1);
      updates.segundo_nombre  = normalizeSpaces(n2);
      updates.primer_apellido = normalizeSpaces(a1);
      updates.segundo_apellido= normalizeSpaces(a2);
      updates.nombre          = fullNombre(updates.primer_nombre, updates.segundo_nombre);
      updates.apellido        = fullApellido(updates.primer_apellido, updates.segundo_apellido);
      updates.nombre_key      = buildNombreKey4(updates.primer_nombre, updates.segundo_nombre, updates.primer_apellido, updates.segundo_apellido);
    }

    if (contraseña) {
      updates.contraseña = await bcrypt.hash(contraseña, 10);
    }

    await p.update(updates);
    res.json({ mensaje: 'Paciente actualizado correctamente', paciente: p });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar paciente', detalle: error.message });
  }
};

// DELETE /auth/:id (protegido)
const eliminarPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const idInactivo = await getCatalogoId('INACTIVO');

    const p = await Paciente.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Paciente no encontrado' });

    await p.update({ id_estado: idInactivo });
    res.json({ mensaje: 'Paciente eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar', detalle: error.message });
  }
};

module.exports = {
  registrarPaciente,
  loginPaciente,
  refresh,
  actualizarPaciente,
  eliminarPaciente,
  me,
};
