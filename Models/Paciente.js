// Models/Paciente.js
const { DataTypes } = require('sequelize');
const sequelize = require('./config/databaseconfig');
const Catalogo = require('./Catalogo');

const Paciente = sequelize.define('Paciente', {
  primer_nombre:       { type: DataTypes.STRING, allowNull: false },
  segundo_nombre:      { type: DataTypes.STRING, allowNull: false },
  primer_apellido:     { type: DataTypes.STRING, allowNull: false },
  segundo_apellido:    { type: DataTypes.STRING, allowNull: false },

  // Para compatibilidad con código/consultas previas
  nombre:              { type: DataTypes.STRING, allowNull: false },
  apellido:            { type: DataTypes.STRING, allowNull: false },

  // Clave canónica sin acentos, en mayúsculas: "N1 N2 A1 A2"
  nombre_key:          { type: DataTypes.STRING, allowNull: false },

  usuario: {
    type: DataTypes.STRING,
    allowNull: false,
    set(value) {
      this.setDataValue('usuario', (value || '').trim());
    }
  },
  contraseña:          { type: DataTypes.STRING, allowNull: false },

  id_estado: {
    type: DataTypes.INTEGER,
    references: { model: 'catalogo', key: 'id' }
  }
}, {
  tableName: 'paciente',
  timestamps: false,
});

Paciente.belongsTo(Catalogo, { foreignKey: 'id_estado' });
Catalogo.hasMany(Paciente, { foreignKey: 'id_estado' });

module.exports = Paciente;
