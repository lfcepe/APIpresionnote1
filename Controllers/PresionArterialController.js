// Controllers/PresionArterialController.js
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const PresionArterial = require('../Models/PresionArterial');
const Catalogo = require('../Models/Catalogo');
const Paciente = require('../Models/Paciente');


/* ------------------------ Utilidades de fecha/hora ------------------------ */
function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function toHM(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=domingo, 1=lunes...
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfWeekSunday(date) {
  const ini = startOfWeekMonday(date);
  const fin = new Date(ini);
  fin.setDate(ini.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return fin;
}
function startOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Helpers para armar el nombre mostrado
function nombrePacienteDisplay(p, fallbackId) {
  if (!p) return `Paciente ID ${fallbackId}`;
  const partes4 = [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido]
    .filter(Boolean).join(' ').trim();
  if (partes4) return partes4;
  const partes2 = [p.nombre, p.apellido].filter(Boolean).join(' ').trim();
  if (partes2) return partes2;
  return `Paciente ID ${fallbackId}`;
}

/* --------------------- Catálogo: obtener id por valor --------------------- */
// Usa exactamente los valores guardados en tu BD:
// 'NORMAL', 'ELEVADA', 'HIPERTENSION_NIVEL_1', 'HIPERTENSION_NIVEL_2', 'CRISIS DE HIPERTENCIÓN'
async function getNivelIdByValor(valor) {
  const row = await Catalogo.findOne({
    where: { categoria: 'NIVEL_PRESION', valor },
    attributes: ['id'],
  });
  if (!row) {
    throw new Error(`No existe catálogo NIVEL_PRESION con valor '${valor}'.`);
  }
  return row.id;
}

/* ---------------- Clasificación (según la imagen enviada) ---------------- */
/*
  - CRISIS DE HIPERTENCIÓN: sistólica >= 180  o diastólica >= 120
  - HIPERTENSION_NIVEL_2:   sistólica >= 140  o diastólica >= 90
  - HIPERTENSION_NIVEL_1:   130–139          o 80–89
  - ELEVADA:                120–129 y diastólica < 80
  - NORMAL:                 sistólica < 120 y diastólica < 80
*/
function clasificarPresion(s, d) {
  if (s >= 180 || d >= 120) return 'CRISIS DE HIPERTENCIÓN';
  if (s >= 140 || d >= 90)  return 'HIPERTENSION_NIVEL_2';
  if ((s >= 130 && s <= 139) || (d >= 80 && d <= 89)) return 'HIPERTENSION_NIVEL_1';
  if ((s >= 120 && s <= 129) && d < 80) return 'ELEVADA';
  return 'NORMAL';
}

/* --------------------------- Validaciones básicas -------------------------- */
function validarRangos(s, d) {
  if (Number.isNaN(s) || Number.isNaN(d)) return 'Valores no numéricos.';
  if (s < 70 || s > 250) return 'Sistólica fuera de rango permitido (70–250).';
  if (d < 40 || d > 150) return 'Diastólica fuera de rango permitido (40–150).';
  return null;
}

/* ------------------------------- Endpoints -------------------------------- */

// POST /bp
// Body: { id_paciente, presionsistolica, presiondiastolica, fecha, hora }
const crearToma = async (req, res) => {
  try {
    const { id_paciente, presionsistolica, presiondiastolica } = req.body;

    // Fecha y hora: si no llegan, autocompletar
    let { fecha, hora } = req.body;
    if (!fecha || !hora) {
      const now = new Date();
      if (!fecha) fecha = toYMD(now);   // YYYY-MM-DD
      if (!hora)  hora  = toHM(now);    // HH:mm
    }

    const s = Number(presionsistolica);
    const d = Number(presiondiastolica);
    const err = validarRangos(s, d);
    if (err) return res.status(400).json({ error: err });

    const etiqueta = clasificarPresion(s, d);               // p.ej. 'ELEVADA'
    const id_nivelpresion = await getNivelIdByValor(etiqueta); // SELECT id en catalogos

    const nueva = await PresionArterial.create({
      id_paciente,
      presionsistolica: s,
      presiondiastolica: d,
      fecha,
      hora,
      id_nivelpresion,
    });

    const notification =
      etiqueta === 'CRISIS DE HIPERTENCIÓN'
        ? 'CRISIS de hipertensión: consulte a su médico de inmediato.'
        : `Nivel: ${etiqueta}`;

    res.status(201).json({
      mensaje: 'Toma registrada',
      nivel: etiqueta,
      id_nivelpresion,
      notification,
      toma: nueva,
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al registrar toma', detalle: e.message });
  }
};

// GET /bp/by-date?pacienteId=1&fecha=YYYY-MM-DD
const obtenerPorFecha = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.query;
    if (!pacienteId || !fecha) {
      return res.status(400).json({ error: 'Envíe pacienteId y fecha (YYYY-MM-DD).' });
    }
    const tomas = await PresionArterial.findAll({
      where: { id_paciente: pacienteId, fecha },
      order: [['hora', 'ASC']],
    });
    res.json({ fecha, tomas });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener por fecha', detalle: e.message });
  }
};

// GET /bp/weekly?pacienteId=1&fecha=YYYY-MM-DD (fecha opcional; por defecto hoy)
const obtenerSemana = async (req, res) => {
  try {
    const { pacienteId } = req.query;
    const base = req.query.fecha ? new Date(req.query.fecha) : new Date();
    if (!pacienteId) return res.status(400).json({ error: 'Envíe pacienteId.' });

    const ini = startOfWeekMonday(base);
    const fin = endOfWeekSunday(base);

    const tomas = await PresionArterial.findAll({
      where: {
        id_paciente: pacienteId,
        fecha: { [Op.between]: [toYMD(ini), toYMD(fin)] },
      },
      order: [['fecha', 'ASC'], ['hora', 'ASC']],
    });

    res.json({ semana: { inicio: toYMD(ini), fin: toYMD(fin) }, tomas });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener semana', detalle: e.message });
  }
};

// GET /bp/monthly-report?pacienteId=1&year=2025&month=08
const reporteMensualPDF = async (req, res) => {
  try {
    const { pacienteId } = req.query;
    let { year, month } = req.query;
    if (!pacienteId) return res.status(400).json({ error: 'Envíe pacienteId.' });

    // Buscar datos del paciente para el encabezado
    const paciente = await Paciente.findByPk(pacienteId, {
      attributes: [
        'primer_nombre','segundo_nombre','primer_apellido','segundo_apellido',
        'nombre','apellido','usuario'
      ]
    });
    const nombreMostrar = nombrePacienteDisplay(paciente, pacienteId);

    const now = new Date();
    const y = Number(year || now.getFullYear());
    const m = Number(month || now.getMonth() + 1);
    const aux = new Date(y, m - 1, 1);

    const ini = startOfMonth(aux);
    const fin = endOfMonth(aux);

    const tomas = await PresionArterial.findAll({
      where: {
        id_paciente: pacienteId,
        fecha: { [Op.between]: [toYMD(ini), toYMD(fin)] },
      },
      include: [{ model: Catalogo, attributes: ['valor'] }],
      order: [['fecha', 'ASC'], ['hora', 'ASC']],
    });

    const doc = new PDFDocument({ margin: 40 });
    const fileName = `informe_presion_${pacienteId}_${y}-${String(m).padStart(2, '0')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    doc.pipe(res);

    // Encabezado
    doc.fontSize(18).text('Informe Mensual - Presión Arterial', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Paciente: ${nombreMostrar} (ID: ${pacienteId})`);
    if (paciente?.usuario) doc.text(`Usuario: ${paciente.usuario}`);
    doc.text(`Periodo: ${toYMD(ini)} a ${toYMD(fin)}`);
    doc.moveDown();
    doc.text('Fecha      Hora     Sistólica  Diastólica  Nivel');
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);

    // Filas
    for (const t of tomas) {
      const nivel = t.Catalogo?.valor ?? clasificarPresion(Number(t.presionsistolica), Number(t.presiondiastolica));
      const fila =
        `${t.fecha.padEnd(11)} ${String(t.hora).padEnd(8)}  ` +
        `${String(t.presionsistolica).padEnd(9)} ${String(t.presiondiastolica).padEnd(10)} ${nivel}`;
      doc.text(fila);
    }

    doc.end();
  } catch (e) {
    res.status(500).json({ error: 'Error al generar PDF', detalle: e.message });
  }
};
const eliminarToma = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Envíe el id de la toma.' });

    const borradas = await PresionArterial.destroy({ where: { id } });
    if (!borradas) return res.status(404).json({ error: 'Toma no encontrada' });

    res.json({ mensaje: 'Toma eliminada', id });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar toma', detalle: e.message });
  }
};
module.exports = {
  crearToma,
  obtenerPorFecha,
  obtenerSemana,
  reporteMensualPDF,
  eliminarToma,
};
