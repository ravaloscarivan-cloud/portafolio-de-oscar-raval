// Sección Invitar (solo admin): envía una invitación a un @usuario para colaborar.
// Le aparece en su pantalla para aceptarla; al aceptar, comparten en tiempo real la lista de links de productos
// durante el tiempo elegido. Si no está en la app, la ve al entrar (y entra sin esperar permiso).
// El usuario invitado nunca ve las secciones del admin (Invitados, Invitar, notificaciones).
import { useEffect, useState } from 'react';
import { Send, Store, Trash2, UserPlus, Users } from 'lucide-react';

const DURACIONES = [
  { horas: 1, texto: '1 hora' },
  { horas: 24, texto: '24 horas' },
  { horas: 168, texto: '7 días' },
];
const PATRON_USUARIO = /^@[a-z0-9._]{2,30}$/;

const venceEn = (ts) => {
  const min = Math.max(0, Math.round((new Date(ts).getTime() - Date.now()) / 60000));
  if (min < 60) return `vence en ${min} min`;
  if (min < 48 * 60) return `vence en ${Math.round(min / 60)} h`;
  return `vence en ${Math.round(min / 1440)} días`;
};

export function SeccionInvitar({ monitor, sala, onIrImportador }) {
  const [usuario, setUsuario] = useState('');
  const [horas, setHoras] = useState(24);
  const [enviada, setEnviada] = useState('');
  const { invitaciones = [], conectados = [] } = monitor;
  const enLinea = new Set(conectados.map((p) => p.nombre));
  const colaborando = conectados.filter((p) => p.invitacion);
  const valido = PATRON_USUARIO.test(usuario);
  // ¿Existe ese @usuario? Se revisa mientras se escribe (null = sin revisar todavía).
  const [existe, setExiste] = useState(null);
  useEffect(() => {
    setExiste(null);
    if (!valido) return undefined;
    let vigente = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/invitado', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'existe', usuario }),
        });
        const d = await r.json();
        if (vigente && r.ok) setExiste(!!d.existe);
      } catch { /* sin conexión */ }
    }, 350);
    return () => { vigente = false; clearTimeout(t); };
  }, [usuario, valido]);

  // Siempre con @ al inicio, en minúsculas y solo caracteres válidos (igual que en el acceso).
  const escribir = (valor) => setUsuario('@' + valor.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30));

  async function enviar(e) {
    e.preventDefault();
    if (!valido) return;
    if (await monitor.accion('crearInvitacion', { usuario, horas })) {
      setEnviada(enLinea.has(usuario)
        ? `Invitación enviada: a ${usuario} ya le apareció en su pantalla.`
        : `Invitación enviada: ${usuario} la verá cuando entre a la app.`);
      setUsuario('');
    }
  }

  const estadoDe = (i) => (i.respuesta === 'aceptada' ? 'Aceptada · colaborando'
    : enLinea.has(i.usuario) ? 'Esperando respuesta (la está viendo)' : 'Esperando respuesta (la verá al entrar)');

  return (
    <main className="invitados">
      <section className="card">
        <h2><UserPlus size={18} /> Invitar a colaborar</h2>
        <p className="sub">
          Escribe el @usuario y por cuánto tiempo. Le aparece la invitación en su pantalla; si la acepta, comparten en
          tiempo real la lista de links de productos del Importador. Solo usa el Importador y Videos: no ve Usuarios e invitados,
          Invitar ni las notificaciones.
        </p>
        <form className="form-invitar" onSubmit={enviar}>
          <label>
            <small>Usuario</small>
            <input
              value={usuario}
              maxLength={31}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onFocus={() => { if (!usuario) setUsuario('@'); }}
              onChange={(e) => { escribir(e.target.value); setEnviada(''); }}
              placeholder="@usuario"
              required
            />
            {valido && (
              <span className={`existe ${existe ? 'si' : existe === false ? 'no' : ''}`}>
                {existe === null ? 'Revisando…' : existe ? `✓ ${usuario} existe` : `✗ ${usuario} no existe`}
              </span>
            )}
          </label>
          <label>
            <small>Tiempo</small>
            <select value={horas} onChange={(e) => setHoras(Number(e.target.value))}>
              {DURACIONES.map((d) => <option key={d.horas} value={d.horas}>{d.texto}</option>)}
            </select>
          </label>
          <button disabled={!valido || !existe || monitor.ocupado.startsWith('crearInvitacion')}><Send size={16} /> Enviar invitación</button>
        </form>
        {enviada && <p className="invitacion-enviada">{enviada}</p>}
      </section>

      <section className="card">
        <h2><Users size={18} /> Invitaciones</h2>
        {invitaciones.length === 0 ? (
          <p className="muted">No hay invitaciones activas. La lista de links compartida está apagada.</p>
        ) : (
          <ul className="personas">
            {invitaciones.map((i) => (
              <li key={i.id} className="persona">
                <span className={`punto ${i.respuesta === 'aceptada' ? 'verde' : 'amarillo'}`} />
                <span className="persona-datos">
                  <b>{i.usuario || i.nota || 'Invitación'}</b>
                  <small>{estadoDe(i)} · {venceEn(i.vence)}</small>
                </span>
                <button
                  className="sec mini peligro"
                  onClick={() => confirm('¿Anular esta invitación? Dejarán de compartir la lista (la persona sigue en la app).') && monitor.accion('revocarInvitacion', { id: i.id })}
                  disabled={!!monitor.ocupado}
                >
                  <Trash2 size={14} /> Anular
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="fila">
          <button className="sec" onClick={onIrImportador} disabled={!sala}>
            <Store size={16} /> Ir al cuadro compartido
          </button>
          {colaborando.length > 0 && <span className="muted">Colaborando ahora: {colaborando.map((p) => p.nombre).join(', ')}</span>}
        </div>
      </section>
    </main>
  );
}
