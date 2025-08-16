// server.js
const express = require('express');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');

const sequelize = require('./Models/config/databaseconfig');

// Importa los modelos para que Sequelize los registre
const Catalogo = require('./Models/Catalogo');
const Paciente = require('./Models/Paciente');
const PresionArterial = require('./Models/PresionArterial');

// Rutas
const authRoutes = require('./Routes/PacienteRoutes');
const presionArterialRoutes = require('./Routes/PresionArterialRoutes');
const catalogoRoutes = require('./Routes/CatalogoRoutes');

const app = express();

/* ----------------------- Middlewares base ----------------------- */
app.use(cors({
  origin: '*', // ajusta a tu dominio/app si quieres restringir
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '2mb' }));

/* ------------------- Middleware: verificar JWT ------------------- */
function verifyToken(req, res, next) {
  try {
    const header = req.headers['authorization'] || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Token no provisto' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Guardamos el id del usuario para uso en controladores
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/* --------------------------- Rutas --------------------------- */
// Público (registro/login)
app.use('/auth', authRoutes);

// Protegidas por JWT
app.use('/pa', verifyToken, presionArterialRoutes);
app.use('/catalogo', verifyToken, catalogoRoutes);

// Salud
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'api', time: new Date().toISOString() });
});

/* --------------- 404 y manejador de errores --------------- */
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

/* -------- Conexión BD y arranque del servidor -------- */
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexión a BD exitosa');

    // Sincroniza en orden para respetar FKs:
    // 1) catalogo, 2) paciente (FK a catalogo), 3) presionarterial (FK a catalogo y paciente)
    await Catalogo.sync();        // tableName: 'catalogo'
    await Paciente.sync();        // tableName: 'paciente'
    await PresionArterial.sync(); // tableName: 'presionarterial'
    console.log('Tablas sincronizadas');

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () =>
      console.log(`Servidor corriendo en puerto ${PORT}`)
    );

    // Cierre elegante
    const shutdown = (signal) => () => {
      console.log(`\nRecibido ${signal}. Cerrando servidor...`);
      server.close(() => {
        console.log('HTTP cerrado.');
        process.exit(0);
      });
    };
    process.on('SIGINT', shutdown('SIGINT'));
    process.on('SIGTERM', shutdown('SIGTERM'));
  } catch (err) {
    console.error('Error al conectar con la base de datos:', err);
    process.exit(1);
  }
})();
