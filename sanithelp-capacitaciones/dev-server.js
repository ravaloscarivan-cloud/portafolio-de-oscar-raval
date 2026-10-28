// Servidor solo para desarrollo local: expone las funciones de /api igual que Vercel.
import express from 'express';
import asistencias from './api/asistencias.js';
import capacitaciones from './api/capacitaciones.js';
import evaluacion from './api/evaluacion.js';
import progreso from './api/progreso.js';
import adminLogin from './api/admin/login.js';
import adminFijas from './api/admin/fijas.js';
import adminRespuestas from './api/admin/respuestas.js';

const app = express();
app.use(express.json({ limit: '5mb' }));
app.all('/api/asistencias', asistencias);
app.all('/api/capacitaciones', capacitaciones);
app.all('/api/evaluacion', evaluacion);
app.all('/api/progreso', progreso);
app.all('/api/admin/login', adminLogin);
app.all('/api/admin/fijas', adminFijas);
app.all('/api/admin/respuestas', adminRespuestas);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API local en http://localhost:${PORT}`));
