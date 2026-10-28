import { crearToken, leerCuerpo, verificarContrasena } from '../../lib/auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  const body = leerCuerpo(req);
  try {
    if (!verificarContrasena(body?.contrasena)) return res.status(401).json({ error: 'Contraseña incorrecta' });
    return res.status(200).json({ token: crearToken() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'El acceso de administrador no está configurado' });
  }
}
