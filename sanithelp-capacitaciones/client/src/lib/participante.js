// Recuerda en este navegador quién está haciendo las capacitaciones (nombre, apellido y correo),
// para marcar su avance sin pedirle los datos en cada capacitación.
const CLAVE = 'sanithelp-participante';

export const participante = {
  obtener() {
    try {
      const p = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
      return p?.correo ? p : null;
    } catch {
      return null;
    }
  },
  guardar(p) {
    try { localStorage.setItem(CLAVE, JSON.stringify({ nombre: p.nombre, apellido: p.apellido, correo: p.correo })); } catch { /* sin almacenamiento */ }
  },
  olvidar() {
    try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
  },
};
