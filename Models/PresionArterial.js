const { DataTypes } = require('sequelize');
const sequelize = require('./config/databaseconfig');
const Paciente = require('./Paciente');
const Catalogo = require('./Catalogo');

const PresionArterial = sequelize.define('PresionArterial', {
  id_paciente: {
    type: DataTypes.INTEGER,
    references: {
      model: 'paciente',
      key: 'id',
    }
  },
  presionsistolica: { type: DataTypes.DECIMAL(5,2), allowNull: false },
  presiondiastolica:{ type: DataTypes.DECIMAL(5,2), allowNull: false },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  hora:  { type: DataTypes.TIME, allowNull: false },
  id_nivelpresion: {
    type: DataTypes.INTEGER,
    references: {
      model: 'catalogo',   
      key: 'id',
    }
  }
}, {
  tableName: 'presionarterial',
  timestamps: false,
});

PresionArterial.belongsTo(Paciente, { foreignKey: 'id_paciente' });
Paciente.hasMany(PresionArterial, { foreignKey: 'id_paciente' });

PresionArterial.belongsTo(Catalogo, { foreignKey: 'id_nivelpresion' });
Catalogo.hasMany(PresionArterial, { foreignKey: 'id_nivelpresion' });

module.exports = PresionArterial;
