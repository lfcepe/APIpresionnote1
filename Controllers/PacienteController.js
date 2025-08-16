const Paciente = require('../Models/Paciente');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sequelize = require('../Models/config/databaseconfig');

const getCatalogoId = async (valor) => {
  const [results] = await sequelize.query(
    "SELECT id FROM catalogo WHERE valor = :valor LIMIT 1",
    {
      replacements: { valor },
      type: sequelize.QueryTypes.SELECT
    }
  );
  if (!results.length) throw new Error(`Catálogo con valor '${valor}' no encontrado`);
  return results[0].id;
};

const registrarPaciente = async (req, res) => {
  try {
    const { nombre, apellido, usuario, contraseña } = req.body;
    const idActivo = await getCatalogoId('ACTIVO');

    const existente = await Paciente.findOne({ where: { usuario } });

    const hash = await bcrypt.hash(contraseña, 10);

    if (existente) {
      await existente.update({
        nombre,
        apellido,
        contraseña: hash,
        id_estado: idActivo
      });

      return res.status(200).json({ mensaje: 'Paciente actualizado y activado', usuario: existente });
    }

    const nuevoPaciente = await Paciente.create({
      nombre,
      apellido,
      usuario,
      contraseña: hash,
      id_estado: idActivo
    });

    res.status(201).json({ mensaje: 'Paciente registrado', usuario: nuevoPaciente });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar', detalle: error.message });
  }
};

const loginPaciente = async (req, res) => {
  try {
    const { usuario, contraseña } = req.body;

    const idActivo = await getCatalogoId('ACTIVO');
    const paciente = await Paciente.findOne({
      where: { usuario, id_estado: idActivo } 
    });

    if (!paciente) return res.status(404).json({ error: 'Paciente no activo o no registrado' });

    const esValido = await bcrypt.compare(contraseña, paciente.contraseña);
    if (!esValido) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: paciente.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ mensaje: 'Login exitoso', token });
  } catch (error) {
    res.status(500).json({ error: 'Error en el login', detalle: error.message });
  }
};

const actualizarPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, usuario, contraseña } = req.body;

    const paciente = await Paciente.findByPk(id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const datosActualizados = {
      nombre: nombre ?? paciente.nombre,
      apellido: apellido ?? paciente.apellido,
      usuario: usuario ?? paciente.usuario,
    };

    if (contraseña) {
      const hash = await bcrypt.hash(contraseña, 10);
      datosActualizados.contraseña = hash;
    }

    await paciente.update(datosActualizados);

    res.json({ mensaje: 'Paciente actualizado correctamente', paciente });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar paciente', detalle: error.message });
  }
};

const eliminarPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const idInactivo = await getCatalogoId('INACTIVO');

    const paciente = await Paciente.findByPk(id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    await paciente.update({ id_estado: idInactivo });

    res.json({ mensaje: 'Paciente desactivado (eliminado lógicamente)' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar', detalle: error.message });
  }
};

module.exports = { registrarPaciente, loginPaciente, eliminarPaciente, actualizarPaciente };

