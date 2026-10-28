// Chat abajo a la derecha entre el admin y un usuario (mismo aspecto en las dos pantallas).
// - Ventana: título, mensajes (los propios a la derecha) y cuadro para escribir.
// - BotonChat: el botón flotante que la abre (el usuario y el admin lo tienen en el mismo sitio).
// - pestanas: opcional, encima de la cabecera (el admin cambia de conversación).
import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';

const hora = (ts) => new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

export function VentanaChat({ titulo, mensajes, onEnviar, onCerrar, enfocar = false, pestanas = null }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const listaRef = useRef(null);

  useEffect(() => {
    if (listaRef.current) listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [mensajes.length]);

  async function enviar(e) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      if (await onEnviar(t)) setTexto('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="chat-ventana" role="dialog" aria-label={titulo}>
      {pestanas}
      <div className="chat-cabeza">
        <MessageSquare size={16} />
        <b>{titulo}</b>
        <button className="sec icono" onClick={onCerrar} aria-label="Cerrar chat"><X size={15} /></button>
      </div>
      <div className="chat-mensajes" ref={listaRef}>
        {mensajes.length === 0 && <p className="chat-vacio">Escribe un mensaje.</p>}
        {mensajes.map((m, i) => (
          <div key={i} className={`chat-burbuja ${m.mio ? 'mia' : 'suya'}`}>
            <span>{m.texto}</span>
            <small>{hora(m.ts)}</small>
          </div>
        ))}
      </div>
      <form className="chat-escribir" onSubmit={enviar}>
        <input
          autoFocus={enfocar}
          maxLength={300}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe un mensaje…"
        />
        <button disabled={enviando || !texto.trim()} aria-label="Enviar"><Send size={15} /></button>
      </form>
    </div>
  );
}

export function BotonChat({ onClick, pendientes = 0 }) {
  return (
    <button className="chat-boton" onClick={onClick} aria-label="Mensajes">
      <MessageSquare size={20} />
      {pendientes > 0 && <span className="globo">{pendientes}</span>}
    </button>
  );
}
