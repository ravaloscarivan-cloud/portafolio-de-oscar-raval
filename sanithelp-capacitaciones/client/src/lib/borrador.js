// Pre-guardado en este navegador: si la persona recarga la página o se sale sin querer,
// recupera lo que llevaba (respuestas sin enviar, datos y firma de la asistencia, diapositiva donde iba).
const PREFIJO = 'sanithelp-borrador:';

export const borrador = {
  leer(clave) {
    try {
      return JSON.parse(localStorage.getItem(PREFIJO + clave) ?? 'null');
    } catch {
      return null;
    }
  },
  guardar(clave, valor) {
    try { localStorage.setItem(PREFIJO + clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
  },
  borrar(clave) {
    try { localStorage.removeItem(PREFIJO + clave); } catch { /* sin almacenamiento */ }
  },
};
