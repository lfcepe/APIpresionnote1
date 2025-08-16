const Paciente = require('../Models/Paciente');
const Catalogo = require('../Models/Catalogo');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const CATEGORIA_ESTADO_USUARIO = 'ESTADOUSUARIO';

const getCatalogoId = async (valor) => {
  const row = await Catalogo.findOne({
    where: { categoria: CATEGORIA_ESTADO_USUARIO, valor },
    attributes: ['id'],
  });
  if (!row) throw new Error(`Catálogo no encontrado: ${CATEGORIA_ESTADO_USUARIO}/${valor}`);
  return row.id;
};

const registrarPaciente = async (req, res) => {
  try {
    const { nombre, apellido, usuario, contraseña } = req.body;
    const idActivo = await getCatalogoId('ACTIVO');
    const existente = await Paciente.findOne({ where: { usuario } });
    const hash = await bcrypt.hash(contraseña, 10);

    if (existente) {
      await existente.update({ nombre, apellido, contraseña: hash, id_estado: idActivo });
      return res.status(200).json({ mensaje: 'Paciente actualizado y activado', usuario: existente });
    }

    const nuevoPaciente = await Paciente.create({
      nombre, apellido, usuario, contraseña: hash, id_estado: idActivo
    });

    // opcional: devolver token en registro
    const token = jwt.sign({ id: nuevoPaciente.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ mensaje: 'Paciente registrado', token, usuario: nuevoPaciente });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar', detalle: error.message });
  }
};

const loginPaciente = async (req, res) => {
  try {
    const { usuario, contraseña } = req.body;
    const idActivo = await getCatalogoId('ACTIVO');

    const paciente = await Paciente.findOne({ where: { usuario, id_estado: idActivo } });
    if (!paciente) return res.status(404).json({ error: 'Paciente no activo o no registrado' });

    const esValido = await bcrypt.compare(contraseña, paciente.contraseña);
    if (!esValido) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: paciente.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    // devolvemos token + datos mínimos
    res.json({
      mensaje: 'Login exitoso',
      token,
      user: { id: paciente.id, nombre: paciente.nombre, apellido: paciente.apellido, usuario: paciente.usuario }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en el login', detalle: error.message });
  }
};

// Nuevo: retorna info básica a partir del token
const me = async (req, res) => {
  try {
    const paciente = await Paciente.findByPk(req.userId, {
      attributes: ['id', 'nombre', 'apellido', 'usuario', 'id_estado']
    });
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json({ user: paciente });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener perfil', detalle: error.message });
  }
};

module.exports = { registrarPaciente, loginPaciente, actualizarPaciente, eliminarPaciente, me };
