import { useEffect, useState } from 'react';
import { api, SesionVencida } from '../../api.js';
import { generarPdfRespuestas } from '../../lib/pdfRespuestas.js';

const IconoOjo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconoPapelera = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
  </svg>
);

const IconoDescarga = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5M12 15V3" />
  </svg>
);

export default function AdminRespuestas({ onSesionVencida }) {
  const [personas, setPersonas] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [trabajando, setTrabajando] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [visor, setVisor] = useState(null); // { persona, url, doc, archivo }

  const manejar = (err) => {
    if (err instanceof SesionVencida) return onSesionVencida();
    setMensaje({ tipo: 'error', texto: err.message });
  };

  const crearPdf = async (p) => generarPdfRespuestas(await api.admin.respuestas(p.correo));
  const iniciarTrabajo = (p, accion) => {
    setTrabajando((actual) => ({ ...actual, [p.correo]: accion }));
    setMensaje(null);
  };
  const finalizarTrabajo = (p) => {
    setTrabajando((actual) => {
      const siguiente = { ...actual };
      delete siguiente[p.correo];
      return siguiente;
    });
  };

  const cargar = () => api.admin.personas().then(setPersonas).catch((e) => { setPersonas([]); manejar(e); });
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // El PDF se genera en el momento con todo lo que la persona lleva hasta ahora
  const ver = async (p) => {
    iniciarTrabajo(p, 'ver');
    try {
      const { doc, archivo } = await crearPdf(p);
      setVisor({ persona: p, url: doc.output('bloburl'), doc, archivo });
    } catch (err) {
      manejar(err);
    } finally {
      finalizarTrabajo(p);
    }
  };

  const descargar = async (p) => {
    iniciarTrabajo(p, 'descargar');
    try {
      const { doc, archivo } = await crearPdf(p);
      doc.save(archivo);
    } catch (err) {
      manejar(err);
    } finally {
      finalizarTrabajo(p);
    }
  };

  const cerrarVisor = () => {
    if (visor?.url) URL.revokeObjectURL(visor.url);
    setVisor(null);
  };

  const borrar = async (p) => {
    if (!confirm(`¿Borrar todas las respuestas de ${p.nombre} ${p.apellido}?\n\nSe eliminan sus asistencias con firma y sus pre-test y post-test. No se puede deshacer.`)) return;
    iniciarTrabajo(p, 'borrar');
    try {
      const r = await api.admin.borrarRespuestas(p.correo);
      setPersonas((l) => l.filter((x) => x.correo !== p.correo));
      setMensaje({ tipo: 'exito', texto: `Se borraron ${r.asistencias} asistencia(s) y ${r.evaluaciones} evaluación(es) de ${p.nombre} ${p.apellido}.` });
    } catch (err) {
      manejar(err);
    } finally {
      finalizarTrabajo(p);
    }
  };

  const filtradas = (personas ?? []).filter((p) => `${p.nombre} ${p.apellido} ${p.correo}`.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <section className="card">
      <div className="card-cabecera">
        <div>
          <h2 className="card-titulo">Respuestas de usuarios <span className="badge">{personas?.length ?? 0}</span></h2>
          <p className="muted subir-ayuda">Use los iconos para ver o descargar el PDF de cada persona, o eliminar sus respuestas.</p>
        </div>
        <button className="btn btn-secundario btn-sm" onClick={cargar}>↻ Actualizar</button>
      </div>

      {mensaje && <div className={`alerta alerta-${mensaje.tipo}`}>{mensaje.texto}</div>}
      <input className="buscador" placeholder="Buscar por nombre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />

      {personas === null ? (
        <p className="muted">Cargando…</p>
      ) : filtradas.length === 0 ? (
        <p className="muted">{personas.length ? 'No hay resultados para la búsqueda.' : 'Todavía nadie ha respondido.'}</p>
      ) : (
        <ul className="lista-personas">
          {filtradas.map((p) => (
            <li key={p.correo} className="persona-respuesta">
              <div className="persona-datos">
                <span className="persona-nombre">{p.nombre} {p.apellido}</span>
                <span className="persona-correo">{p.correo}</span>
              </div>
              <div className="acciones acciones-respuesta" aria-label="Acciones">
                <button className="btn-redondo" title="Ver PDF" aria-label={`Ver PDF de ${p.nombre} ${p.apellido}`} disabled={Boolean(trabajando[p.correo])} onClick={() => ver(p)}>
                  {trabajando[p.correo] === 'ver' ? <span className="girando" /> : <IconoOjo />}
                </button>
                <button className="btn-redondo" title="Descargar PDF" aria-label={`Descargar PDF de ${p.nombre} ${p.apellido}`} disabled={Boolean(trabajando[p.correo])} onClick={() => descargar(p)}>
                  {trabajando[p.correo] === 'descargar' ? <span className="girando" /> : <IconoDescarga />}
                </button>
                <button className="btn-redondo peligro" title="Borrar respuestas" aria-label={`Borrar respuestas de ${p.nombre} ${p.apellido}`} disabled={Boolean(trabajando[p.correo])} onClick={() => borrar(p)}>
                  {trabajando[p.correo] === 'borrar' ? <span className="girando" /> : <IconoPapelera />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {visor && (
        <div className="modal-fondo" onClick={cerrarVisor}>
          <div className="modal-visor card visor-pdf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-cabecera">
              <h2 className="card-titulo">{visor.persona.nombre} {visor.persona.apellido}</h2>
              <div className="acciones">
                <button className="btn btn-primario btn-sm" onClick={() => visor.doc.save(visor.archivo)}>⬇ Descargar PDF</button>
                <button className="btn btn-secundario btn-sm" onClick={cerrarVisor}>Cerrar</button>
              </div>
            </div>
            <iframe className="visor-pdf-iframe" src={visor.url} title={`Respuestas de ${visor.persona.nombre}`} />
          </div>
        </div>
      )}
    </section>
  );
}
