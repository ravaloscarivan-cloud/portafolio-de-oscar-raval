// Cuenta de DSers para el inicio de sesión automático (solo admin). Se guarda en la extensión de este
// Chrome (extension/dsers-login.js la usa al aparecer el login de DSers); nunca pasa por el servidor.
import { useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';

const conLogin = (v) => {
  const [a, b] = String(v || '0').split('.').map(Number);
  return a > 2 || (a === 2 && b >= 2);
};

export function CuentaDsers({ enviar, extension, versionExt }) {
  const [abierto, setAbierto] = useState(false);
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [guardada, setGuardada] = useState('');
  const [mensaje, setMensaje] = useState('');
  const lista = extension && conLogin(versionExt);

  useEffect(() => {
    if (!abierto || !lista) return;
    enviar({ tipo: 'cuentaDsers' }).then((r) => { setGuardada(r?.correo || ''); setCorreo(r?.correo || ''); });
  }, [abierto, lista]);

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar({ tipo: 'guardarCuentaDsers', correo: correo.trim(), clave });
    if (r?.ok) { setGuardada(correo.trim()); setClave(''); setMensaje('Cuenta guardada. DSers entrará solo cuando pida iniciar sesión.'); }
    else setMensaje(r?.error || 'No se pudo guardar.');
  }

  async function quitar() {
    if (!confirm('¿Quitar la cuenta de DSers guardada en este Chrome?')) return;
    await enviar({ tipo: 'guardarCuentaDsers', correo: '', clave: '' });
    setGuardada(''); setCorreo(''); setClave(''); setMensaje('Cuenta quitada.');
  }

  return (
    <>
      <button className="enlace" onClick={() => { setAbierto(true); setMensaje(''); }}>
        <KeyRound size={15} /> Cuenta de DSers
      </button>
      {abierto && (
        <div className="fondo-invitacion" onClick={(e) => { if (e.target === e.currentTarget) setAbierto(false); }}>
          <div className="invitacion-usuario cuenta-dsers" role="dialog" aria-modal="true" aria-labelledby="titulo-cuenta-dsers">
            <button className="sec icono cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar"><X size={16} /></button>
            <KeyRound size={26} />
            <h2 id="titulo-cuenta-dsers">Inicio de sesión automático en DSers</h2>
            {!lista ? (
              <p>
                {extension
                  ? 'Actualiza la extensión a la versión 2.2.0: descárgala en Importador, descomprímela encima de la carpeta anterior, pulsa ↻ en chrome://extensions y recarga esta página.'
                  : 'Instala la extensión del Importador en este Chrome para usar esta opción.'}
              </p>
            ) : (
              <form onSubmit={guardar}>
                <p>
                  Cuando DSers pida iniciar sesión, la extensión llena estos datos y entra sola. Se guardan solo en este
                  Chrome (no en la app ni en el servidor){guardada ? <>. Guardada: <b>{guardada}</b></> : ''}.
                </p>
                <label>
                  <small>Correo</small>
                  <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="off" required />
                </label>
                <label>
                  <small>Contraseña{guardada ? ' (escríbela de nuevo para cambiarla)' : ''}</small>
                  <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" required />
                </label>
                {mensaje && <p className="invitacion-enviada">{mensaje}</p>}
                <div className="fila">
                  <button disabled={!correo.trim() || !clave}>Guardar</button>
                  {guardada && <button type="button" className="sec peligro" onClick={quitar}>Quitar cuenta</button>}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
