import { useEffect, useRef, useState } from 'react';
import Icono from './Icono.jsx';
import { borrador } from '../lib/borrador.js';
import logo from '../assets/logo_sanithelp.png';
import icono from '../assets/icono_sanithelp.png';

/** Presentación con las diapositivas una debajo de otra: el usuario avanza haciendo scroll. */
export default function Presentacion({ capacitacion }) {
  const { diapositivas } = capacitacion;
  const [actual, setActual] = useState(0);
  // Diapositiva donde iba la última vez (pre-guardado), para ofrecer "Continuar donde iba"
  const clave = `lectura:${capacitacion.id}`;
  const [retomar, setRetomar] = useState(() => {
    const i = borrador.leer(clave);
    return Number.isInteger(i) && i > 0 && i < capacitacion.diapositivas.length ? i : null;
  });
  const contenedorRef = useRef(null);
  const total = diapositivas.length;
  // Los créditos de las fotos no van sobre las imágenes: se reúnen al final (lo exigen las licencias CC BY)
  const creditos = [...new Set(diapositivas.map((d) => d.imagen?.credito).filter((c) => c && /^Foto:/.test(c)))];

  // La diapositiva "actual" es la que ocupa el centro de la pantalla
  useEffect(() => {
    const escenarios = [...(contenedorRef.current?.querySelectorAll('.pres-escenario') ?? [])];
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          const i = Number(e.target.dataset.indice);
          setActual(i);
          if (i > 0) borrador.guardar(clave, i);
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    escenarios.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [diapositivas]);

  return (
    <div className="presentacion" ref={contenedorRef}>
      {retomar !== null && (
        <div className="alerta alerta-info retomar">
          <span>La última vez iba en la diapositiva {retomar + 1} de {total}.</span>
          <button
            type="button"
            className="btn btn-primario btn-sm"
            onClick={() => {
              contenedorRef.current?.querySelectorAll('.pres-escenario')[retomar]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setRetomar(null);
            }}
          >
            Continuar donde iba ↓
          </button>
        </div>
      )}

      <div className="pres-barra">
        <span className="pres-contador">Diapositiva {actual + 1} de {total}</span>
        <div className="pres-progreso"><span style={{ width: `${((actual + 1) / total) * 100}%` }} /></div>
      </div>

      {diapositivas.map((d, i) => (
        <div key={i} className="pres-escenario" data-indice={i}>
          <Diapositiva d={d} numero={i + 1} capacitacion={capacitacion} />
        </div>
      ))}

      <p className="pres-final">Llegó al final de las diapositivas.</p>
      {creditos.length > 0 && <p className="pres-creditos">Créditos de las imágenes: {creditos.join(' · ')}</p>}
    </div>
  );
}

export function Diapositiva({ d, numero, capacitacion }) {
  const Cuerpo = cuerpos[d.tipo] ?? Contenido;
  return (
    <section className={`slide tipo-${d.tipo}`}>
      {d.tipo !== 'portada' && d.tipo !== 'cierre' && (
        <header className="slide-cabecera">
          <div>
            {d.etiqueta && <span className="slide-etiqueta">{d.etiqueta}</span>}
            <h2 className="slide-titulo">{d.titulo}</h2>
            {d.intro && <p className="slide-intro">{d.intro}</p>}
          </div>
          <img className="slide-marca" src={icono} alt="" />
        </header>
      )}
      <Cuerpo d={d} capacitacion={capacitacion} />
      {d.nota && <p className="slide-nota">{d.nota}</p>}
      {d.tipo !== 'portada' && <span className="slide-numero">{numero}</span>}
    </section>
  );
}

const Foto = ({ imagen, className = '' }) =>
  imagen ? (
    <figure className={`slide-foto ${className}`}>
      <img src={imagen.src} alt={imagen.alt} loading="lazy" />
    </figure>
  ) : null;

const Punto = ({ p }) =>
  typeof p === 'string' ? <li>{p}</li> : <li><strong>{p.t}</strong>{p.d && <span>{p.d}</span>}</li>;

function Portada({ d, capacitacion }) {
  return (
    <div className={`portada ${d.imagen ? '' : 'sin-foto'}`}>
      <div className="portada-texto">
        <img className="portada-logo" src={logo} alt="SanitHelp" />
        <span className="slide-etiqueta">{d.etiqueta}</span>
        <h1>{d.titulo}</h1>
        {d.subtitulo && <p className="portada-subtitulo">{d.subtitulo}</p>}
        <ul className="portada-datos">
          {d.datos?.map((x) => <li key={x}>{x}</li>)}
          <li>⏱ {[capacitacion.duracion, capacitacion.facilitador].filter(Boolean).join(' · ')}</li>
        </ul>
        <p className="portada-ayuda">Desplácese hacia abajo para continuar ↓</p>
      </div>
      <Foto imagen={d.imagen} className="portada-foto" />
    </div>
  );
}

function Contenido({ d }) {
  return (
    <div className={`slide-cuerpo ${d.imagen ? 'con-foto' : ''}`}>
      {d.puntos && (
        <ul className={`slide-puntos ${d.puntos.some((p) => typeof p !== 'string') ? 'detallados' : 'simples'} ${d.puntos.length <= 4 ? 'pocos' : ''}`}>
          {d.puntos.map((p, i) => <Punto key={i} p={p} />)}
        </ul>
      )}
      <Foto imagen={d.imagen} />
    </div>
  );
}

function Tarjetas({ d }) {
  return (
    <div className={`slide-tarjetas n${d.items.length} ${d.numerado ? 'numerado' : ''}`}>
      {d.items.map((it, i) => (
        <article key={i} className="slide-tarjeta">
          <div className="slide-tarjeta-icono">
            {d.numerado ? <span className="slide-tarjeta-num">{i + 1}</span> : <Icono nombre={it.icono} />}
          </div>
          <h3>{it.titulo}</h3>
          <p>{it.texto}</p>
        </article>
      ))}
    </div>
  );
}

function Pasos({ d }) {
  return (
    <ol className={`slide-pasos n${d.items.length}`}>
      {d.items.map((it, i) => (
        <li key={i}>
          <span className="paso-num">{i + 1}</span>
          <h3>{it.titulo}</h3>
          <p>{it.texto}</p>
        </li>
      ))}
    </ol>
  );
}

function Comparacion({ d }) {
  return (
    <div className={`slide-comparacion n${d.columnas.length}`}>
      {d.columnas.map((c, i) => (
        <article key={i} className="comp-col">
          <div className="comp-cabecera">
            <span className="comp-letra">{c.letra}</span>
            <div>
              <h3>{c.titulo}</h3>
              <p>{c.texto}</p>
            </div>
          </div>
          <ul>{c.ejemplos.map((e) => <li key={e}>{e}</li>)}</ul>
        </article>
      ))}
    </div>
  );
}

function Imagen({ d }) {
  return (
    <div className="slide-imagen">
      <Foto imagen={d.imagen} className="grande" />
      {d.texto && <p className="slide-imagen-texto">{d.texto}</p>}
    </div>
  );
}

function Colores({ d }) {
  return (
    <div className="slide-colores">
      {d.items.map((it) => (
        <article key={it.nombre} className="color-item">
          <div className={`color-caneca ${it.borde ? 'con-borde' : ''}`} style={{ '--c': it.color }}>
            <span>{it.nombre}</span>
          </div>
          <h3>{it.titulo}</h3>
          <p>{it.texto}</p>
        </article>
      ))}
    </div>
  );
}

function Tabla({ d }) {
  return (
    <div className="slide-tabla-wrap">
      <table className="slide-tabla">
        <thead><tr>{d.cabeceras.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {d.filas.map((f, i) => (
            <tr key={i}>
              {f.map((celda, j) => (
                <td key={j}>
                  {j === 0 && d.colores ? <span className="nivel" style={{ background: d.colores[i] }}>{celda}</span> : celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cierre({ d }) {
  return (
    <div className="cierre">
      <img className="cierre-icono" src={icono} alt="" />
      <h2>{d.titulo}</h2>
      <p>{d.texto}</p>
    </div>
  );
}

const cuerpos = {
  portada: Portada,
  contenido: Contenido,
  tarjetas: Tarjetas,
  pasos: Pasos,
  comparacion: Comparacion,
  imagen: Imagen,
  colores: Colores,
  tabla: Tabla,
  cierre: Cierre,
};
