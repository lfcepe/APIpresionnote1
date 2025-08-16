const { DataTypes } = require('sequelize');
const sequelize = require('./config/databaseconfig');
const Catalogo = require('./Catalogo')

const Paciente = sequelize.define('Paciente', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  apellido: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  usuario: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contraseña: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  id_estado: { 
    type: DataTypes.INTEGER,
    references: {
      model: 'catalogo', 
      key: 'id',
    }
  }
}, {
  tableName: 'paciente',
  timestamps: false,
});

Paciente.belongsTo(Catalogo, { foreignKey: 'id_estado' });
Catalogo.hasMany(Paciente, { foreignKey: 'id_estado' });

module.exports = Paciente;
