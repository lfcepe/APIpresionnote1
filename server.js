const express = require('express');
require('dotenv').config();
const cors = require('cors');
const sequelize = require('./Models/config/databaseconfig');
const authRoutes = require('./Routes/PacienteRoutes');
const PresionArterialRoutes = require('./Routes/PresionArterialRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/pa', PresionArterialRoutes);

sequelize.sync({ alter: true }) 
  .then(() => {
    console.log('Base de datos conectada y las tablas sincronizadas');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
  })
  .catch(err => {
    console.error('Error al conectar con la base de datos:', err);
  });
