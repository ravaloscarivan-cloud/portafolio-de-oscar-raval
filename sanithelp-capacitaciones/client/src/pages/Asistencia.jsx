import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import DatosCapacitacion from '../components/DatosCapacitacion.jsx';
import SignaturePad from '../components/SignaturePad.jsx';
import { borrador } from '../lib/borrador.js';
import { fechaDe, formatoFecha } from '../lib/fechas.js';
import { participante } from '../lib/participante.js';
import { useCapacitaciones } from '../lib/useCapacitaciones.js';

const IconoFirma = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 17c3-4 5-9 7-9s-1 9 1 9 3-5 5-5-1 5 1 5 3-2 4-3" />
    <path d="M3 21h18" />
  </svg>
);

const IconoCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

/** Avance de la persona recordada en este navegador (asistencias y evaluaciones). */
function useProgreso(persona) {
  const [progreso, setProgreso] = useState({});
  useEffect(() => {
    if (!persona) return setProgreso({});
    api.evaluacion.progreso(persona.correo).then((r) => setProgreso(r.progreso)).catch(() => {});
  }, [persona]);
  return [progreso, setProgreso];
}

/** ¿Hay una firma o datos de asistencia pre-guardados sin enviar? */
const tieneBorrador = (id) => {
  const b = borrador.leer(`asistencia:${id}`);
  return Boolean(b?.trazos?.length || b?.form?.nombre);
};

export default function Asistencia() {
  const { id } = useParams();
  return id ? <FormularioAsistencia id={id} /> : <ListaAsistencia />;
}

function ListaAsistencia() {
  const { capacitaciones } = useCapacitaciones();
  const [persona] = useState(participante.obtener);
  const [progreso] = useProgreso(persona);

  return (
    <>
      <div className="page-header">
        <h1>Asistencia</h1>
        <p className="muted">Seleccione la capacitación a la que asistió para registrar su asistencia con su firma.</p>
      </div>
      <div className="grid-capacitaciones grid-asistencias">
        {capacitaciones.map((c) => {
          const firmada = progreso[c.id]?.asistencia;
          const enCurso = !firmada && tieneBorrador(c.id);
          return (
            <Link key={c.id} to={`/asistencia/${c.id}`} className={`cap-tarjeta asistencia-tarjeta ${firmada ? 'completada' : ''}`}>
              {c.portada?.src && <img className="cap-tarjeta-imagen" src={c.portada.src} alt={c.portada.alt ?? ''} loading="lazy" />}
              <div className="cap-tarjeta-contenido">
                <h2>{c.titulo}</h2>
                <div className="asistencia-pie">
                  {firmada ? (
                    <span className="estado-firma firmado"><IconoCheck /> Firmado · {formatoFecha(firmada.fecha)}</span>
                  ) : enCurso ? (
                    <span className="estado-firma en-curso"><IconoFirma /> Continuar firma</span>
                  ) : (
                    <span className="estado-firma pendiente"><IconoFirma /> Firmar asistencia</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

const FORM_VACIO = { nombre: '', apellido: '', correo: '' };

function FormularioAsistencia({ id }) {
  const navigate = useNavigate();
  const { capacitaciones, cargando } = useCapacitaciones();
  const capacitacion = capacitaciones.find((c) => c.id === id);
  const [persona, setPersona] = useState(participante.obtener);
  const [progreso] = useProgreso(persona);

  // Pre-guardado: datos y trazos de la firma quedan en el navegador hasta que se envíe la asistencia
  const clave = `asistencia:${id}`;
  const [guardado] = useState(() => borrador.leer(clave));
  const [form, setForm] = useState(() => guardado?.form ?? persona ?? FORM_VACIO);
  const [firmaVacia, setFirmaVacia] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [otraPersona, setOtraPersona] = useState(false);
  const firmaRef = useRef(null);
  const trazosRef = useRef(guardado?.trazos ?? []);
  const recuperado = Boolean(guardado?.trazos?.length || (guardado?.form && !persona));
  const preGuardar = (f, trazos) => borrador.guardar(clave, { form: f, trazos });

  if (!capacitacion) return cargando ? <p className="muted">Cargando…</p> : <p className="muted">Capacitación no encontrada. <Link to="/asistencia">Volver</Link></p>;

  const yaFirmada = !otraPersona && progreso[id]?.asistencia;
  const cambiar = (e) => {
    const nuevo = { ...form, [e.target.name]: e.target.value };
    setForm(nuevo);
    preGuardar(nuevo, trazosRef.current);
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (firmaRef.current.estaVacio()) return setError('Por favor, registre su firma.');
    setEnviando(true);
    try {
      const imagen = firmaRef.current.obtenerImagen();
      const r = await api.asistencias.enviar({ ...form, capacitacionId: id, firma: imagen });
      participante.guardar(form);
      borrador.borrar(clave);
      navigate(`/capacitaciones/${id}`, {
        replace: true,
        state: { asistenciaEnviada: { nombre: `${form.nombre} ${form.apellido}`, fecha: r.fecha } },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const encabezado = (
    <>
      <div className="detalle-cabecera">
        <Link to="/asistencia" className="btn btn-texto">← Todas las asistencias</Link>
      </div>
      <div className="page-header">
        <h1>Asistencia: {capacitacion.titulo}</h1>
        <DatosCapacitacion c={capacitacion} />
        <p className="muted asistencia-fecha">Se registra con la fecha de la capacitación: <strong>{formatoFecha(fechaDe(capacitacion)) || 'hoy'}</strong></p>
      </div>
    </>
  );

  // Ya firmó (recién o antes): confirmación en lugar del formulario
  if (yaFirmada) {
    return (
      <>
        {encabezado}
        <section className="card firmado-card">
          <div className="firmado-icono"><IconoCheck /></div>
          <h2>Asistencia firmada</h2>
          <p>
            {`${persona?.nombre ?? ''} ${persona?.apellido ?? ''}`.trim()}{' '}
            Su asistencia quedó registrada con fecha <strong>{formatoFecha(yaFirmada.fecha)}</strong>.
          </p>
          <div className="acciones firmado-acciones">
            <Link to="/asistencia" className="btn btn-primario">Ver todas las asistencias</Link>
            <button
              type="button"
              className="btn btn-texto"
              onClick={() => {
                participante.olvidar();
                setPersona(null);
                setOtraPersona(true);
                setForm(FORM_VACIO);
              }}
            >
              Firmar con otros datos
            </button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {encabezado}
      {recuperado && <div className="alerta alerta-info">Recuperamos los datos y la firma que había dejado sin enviar.</div>}

      <form className="card form-asistencia" onSubmit={enviar}>
        <div className="fila">
          <label className="campo">
            <span>Nombre *</span>
            <input name="nombre" value={form.nombre} onChange={cambiar} required autoComplete="given-name" />
          </label>
          <label className="campo">
            <span>Apellido *</span>
            <input name="apellido" value={form.apellido} onChange={cambiar} required autoComplete="family-name" />
          </label>
        </div>

        <label className="campo">
          <span>Correo electrónico *</span>
          <input type="email" name="correo" value={form.correo} onChange={cambiar} required autoComplete="email" placeholder="nombre@correo.com" />
        </label>

        <div className="campo">
          <span>Firma *</span>
          <SignaturePad
            ref={firmaRef}
            onCambio={setFirmaVacia}
            trazosIniciales={guardado?.trazos}
            onTrazos={(t) => {
              trazosRef.current = t;
              preGuardar(form, t);
            }}
          />
        </div>
        <p className="muted guardado-auto">Lo que escribe y firma se guarda automáticamente en este equipo hasta que lo envíe.</p>

        {error && <div className="alerta alerta-error">{error}</div>}

        <button className="btn btn-primario btn-bloque btn-firmar" disabled={enviando || firmaVacia}>
          <IconoFirma /> {enviando ? 'Enviando…' : 'Firmar y enviar asistencia'}
        </button>
      </form>
    </>
  );
}
