const { DataTypes } = require('sequelize');
const sequelize = require('./config/databaseconfig');

const Catalogo = sequelize.define('Catalogo', {
  categoria: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  valor: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'catalogo',
  timestamps: false,
});

module.exports = Catalogo;