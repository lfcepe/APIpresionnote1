const jwt = require('jsonwebtoken');
const Paciente = require('../Models/Paciente');

const ACCESS_TTL  = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function verifyToken(req, res, next) {
  try {
    const header = req.headers['authorization'] || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Token no provisto' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

async function issueTokens(userId) {
  // lee la versión actual del usuario
  const p = await Paciente.findByPk(userId, { attributes: ['id', 'refresh_version'] });
  if (!p) throw new Error('Usuario no encontrado para emitir tokens');

  const accessToken  = jwt.sign({ id: p.id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });

  // el refresh lleva la versión actual
  const refreshToken = jwt.sign(
    { id: p.id, rv: p.refresh_version },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TTL }
  );

  return { accessToken, refreshToken };
}

module.exports = { verifyToken, issueTokens };
