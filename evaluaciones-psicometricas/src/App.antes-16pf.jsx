import { useEffect, useMemo, useState } from "react";
import {
    UserRound,
    FileText,
    BarChart3,
    CalendarDays,
    MapPin,
    BriefcaseBusiness,
    Building2,
    GraduationCap,
    ArrowRight,
    Check,
    Info,
    ClipboardList,
    Download,
    KeyRound,
    Eye,
    LogOut,
    LoaderCircle
} from "lucide-react";
import "./styles.css";

const preguntasPrimeraParte = [
    ["Muestro dedicación a las personas que amo", "Actúo con perseverancia"],
    ['Al pensar, utilizo mi intuición o "sexto sentido"', "Me siento una persona digna"],
    ["Logro buena concentración mental", "Perdono todas las ofensas de cualquier persona"],
    ["Normalmente razono mucho", "Me destaco por el liderazgo en mis acciones"],
    ["Pienso con integridad", "Me coloco objetivos y metas en mi vida personal"],
    ["Soy una persona de iniciativa", "En mi trabajo normalmente soy curioso"],
    ["Doy amor", "Para pensar hago síntesis de las distintas ideas"],
    ["Me siento en calma", "Pienso con veracidad"]
];

const preguntasSegundaParte = [
    ["Irrespetar la propiedad", "Sentir inquietud"],
    ["Ser irresponsable", "Ser desconsiderado hacia cualquier persona"],
    ["Caer en contradicciones al pensar", "Sentir intolerancia"],
    ["Ser violento", "Actuar con cobardía"],
    ["Sentirse presumido", "Generar divisiones y discordia entre los seres humanos"],
    ["Ser cruel", "Sentir ira"],
    ["Pensar con confusión", "Tener odio en el corazón"],
    ["Decir blasfemias", "Ser escandaloso"],
    ["Crear desigualdades entre los seres humanos", "Apasionarse por una idea"],
    ["Sentirse inconstante", "Crear rivalidad hacia otros"],
    ["Ostentar las riquezas materiales", "Sentirse infeliz"],
    ["Entorpecer la cooperación entre los seres humanos", "La maldad"],
    ["Odiar a cualquier ser de la naturaleza", "Hacer distinciones entre las personas"],
    ["Sentirse intranquilo", "Ser infiel"],
    ["Tener la mente dispersa", "Mostrar apatía al pensar"],
    ["La injusticia", "Sentirse angustiado"],
    ["Vengarse de los que odian a todo el mundo", "Vengarse del que hace daño a un familiar"],
    ["Usar abusivamente el poder", "Distraerse"],
    ["Ser desagradecido con los que ayudan", "Ser egoísta con todos"],
    ["Cualquier forma de irrespeto", "Odiar"]
];

const niveles = [1, 2, 3];
const totalPreguntasPrimeraParte = preguntasPrimeraParte.length;
const totalPreguntasValanti = totalPreguntasPrimeraParte + preguntasSegundaParte.length;
const gruposDisc = [
    ["Entusiasta", "Extrovertido(a)", "Popular", "Impulsivo(a)"],
    ["Rápido(a)", "Precavido(a)", "Reflexivo(a)", "Cuida los Detalles"],
    ["Lógico(a)", "Constante", "Tenaz", "Enérgico(a)"],
    ["Apacible", "Impaciente", "Calmado(a)", "Tranquilo(a)"],
    ["Cauteloso(a)", "Discreto(a)", "Analítico(a)", "Sociable"],
    ["Decidido(a)", "Complaciente", "Audaz", "Sistemático(a)"],
    ["Receptivo(a)", "Encantador(a)", "Leal", "Vigoroso(a)"],
    ["Bondadoso(a)", "Insistente", "Promotor(a)", "Tolerante"],
    ["Amigable", "Valeroso(a)", "Sociable", "Cautivador(a)"],
    ["Preciso(a)", "Anima a los demás", "Paciente", "Contento(a)"],
    ["Franco(a)", "Pacífico(a)", "Autosuficiente", "Exigente"],
    ["Tranquilo(a)", "Perfeccionista", "Certero(a)", "Apegado(a) a las normas"],
    ["Elocuente", "Reservado(a)", "Adaptable", "Le agrada discutir"],
    ["Controlado(a)", "Atento(a)", "Resuelto(a)", "Metódico(a)"],
    ["Tolerante", "Osado(a)", "Prevenido(a)", "Comedido(a)"],
    ["Decisivo(a)", "Alegre", "Vivaz", "Desenvuelto(a)"],
    ["Atrevido(a)", "Estimulante", "Agresivo(a)", "Jovial"],
    ["Concienzudo(a)", "Gentil", "Impetuoso(a)", "Preciso(a)"],
    ["Comunicativo(a)", "Perceptivo(a)", "Amistoso(a)", "Directo(a)"],
    ["Moderado(a)", "Independiente", "Discerniente", "Ecuánime"],
    ["Ameno(a)", "Competitivo(a)", "De trato Fácil", "Inquieto(a)"],
    ["Ingenioso(a)", "Considerado(a)", "Compasivo(a)", "Amable"],
    ["Investigador(a)", "Alegre", "Cauto(a)", "Elocuente"],
    ["Acepta Riesgos", "Sagaz", "Habla Directo", "Cuidadoso(a)"],
    ["Expresivo(a)", "Meticuloso(a)", "Evaluador(a)", "Prudente"],
    ["Cuidadoso(a)", "Obediente", "Generoso(a)", "Pionero(a)"],
    ["Dominante", "Ideas Firmes", "Animado(a)", "Espontáneo(a)"],
    ["Sensible", "Alentador(a)", "Persistente", "Colaborador"]
];

function App() {
    const [seccion, setSeccion] = useState("personal");
    const [pruebaSeleccionada, setPruebaSeleccionada] = useState("VALANTI");
    const [respuestasDisc, setRespuestasDisc] = useState({});

    const [datos, setDatos] = useState({
        nombre: "",
        edad: "",
        sexo: "",
        ciudad: "",
        ocupacion: "",
        empresa: "",
        estudios: ""
    });

    const [respuestas, setRespuestas] = useState({});
    const [botonInvalido, setBotonInvalido] = useState(null);
    const [envioCompletado, setEnvioCompletado] = useState(false);
    const [registroGuardado, setRegistroGuardado] = useState(null);
    const [claveRespuestas, setClaveRespuestas] = useState("");
    const [respuestasAutorizadas, setRespuestasAutorizadas] = useState(false);
    const [respuestasArchivadas, setRespuestasArchivadas] = useState([]);
    const [respuestaSeleccionada, setRespuestaSeleccionada] = useState(null);
    const [pdfRespuestaUrl, setPdfRespuestaUrl] = useState("");
    const [cargandoRespuestas, setCargandoRespuestas] = useState(false);
    const [errorRespuestas, setErrorRespuestas] = useState("");
    const [formularioYaEnviado, setFormularioYaEnviado] = useState(
        localStorage.getItem("valanti_formulario_enviado") === "true"
    );

    const totalRespondidas = Object.values(respuestas).filter(
        (respuesta) =>
            respuesta &&
            respuesta.a !== null &&
            respuesta.a !== undefined &&
            respuesta.b !== null &&
            respuesta.b !== undefined &&
            respuesta.a + respuesta.b === 3
    ).length;

    const seccion1Completa = Array.from(
        { length: totalPreguntasPrimeraParte },
        (_, indice) => respuestas[indice + 1]
    ).every(
        (respuesta) =>
            respuesta &&
            respuesta.a !== null &&
            respuesta.a !== undefined &&
            respuesta.b !== null &&
            respuesta.b !== undefined &&
            respuesta.a + respuesta.b === 3
    );

    const [avisoSeccion, setAvisoSeccion] = useState("");

    const mostrarAvisoSeccion = () => {
        setAvisoSeccion(
            `Primero debes completar todas las preguntas de Importancia personal (1 - ${totalPreguntasPrimeraParte}).`
        );

        setTimeout(() => {
            setAvisoSeccion("");
        }, 3500);
    };

    const totalDiscRespondidas = Object.values(respuestasDisc).filter(
        (respuesta) => respuesta?.mas && respuesta?.menos
    ).length;

    const totalPruebaRespondidas = pruebaSeleccionada === "PRUEBA DISC"
        ? totalDiscRespondidas
        : totalRespondidas;
    const totalPruebaPreguntas = pruebaSeleccionada === "PRUEBA DISC" ? 28 : totalPreguntasValanti;

    const progreso = useMemo(() => {
        return Math.round((totalPruebaRespondidas / totalPruebaPreguntas) * 100);
    }, [totalPruebaPreguntas, totalPruebaRespondidas]);

    const actualizarDato = (campo, valor) => {
        setDatos((actuales) => ({
            ...actuales,
            [campo]: valor
        }));
    };

    const seleccionarDisc = (grupo, tipo, palabra, indicePalabra) => {
        const actual = respuestasDisc[grupo] || {};
        const contrario = tipo === "mas" ? actual.menos : actual.mas;

        if (contrario === palabra) {
            return;
        }

        setRespuestasDisc((actuales) => ({
            ...actuales,
            [grupo]: {
                ...(actuales[grupo] || {}),
                [tipo]: palabra,
                [`${tipo}_indice`]: indicePalabra
            }
        }));
    };

    const seleccionarNivel = (numero, lado, valor) => {
        setRespuestas((actuales) => {
            const anterior = actuales[numero] || {
                a: null,
                b: null
            };

            const nueva = {
                ...anterior,
                [lado]: valor
            };

            return {
                ...actuales,
                [numero]: nueva
            };
        });
    };

    const seleccionarCombinacion = (numero, lado, valor) => {
        const actual = respuestas[numero] || {
            a: null,
            b: null
        };

        const valorActual = actual[lado];
        const otroLado = lado === "a" ? "b" : "a";
        const otroValor = actual[otroLado];

        /*
         * Si se vuelve a pulsar el mismo nivel,
         * se deshace la seleccion.
         *
         * Cuando era 3 + 0, tambien eliminamos
         * el 0 interno para dejar la pareja vacia.
         */
        if (valorActual === valor) {
            setRespuestas((actuales) => ({
                ...actuales,
                [numero]: {
                    a: valor === 3 ? null : actual.a,
                    b: valor === 3 ? null : actual.b,
                    ...(valor !== 3 ? { [lado]: null } : {})
                }
            }));

            setBotonInvalido(null);
            return;
        }

        /*
         * Si el otro lado ya tiene 3,
         * no se puede seleccionar ningun nivel.
         */
        if (otroValor === 3) {
            setBotonInvalido({
                numero,
                lado,
                valor
            });

            setTimeout(() => {
                setBotonInvalido(null);
            }, 450);

            return;
        }

        /*
         * Si se selecciona 3, el otro valor es 0
         * internamente. El 0 no se muestra al usuario.
         */
        if (valor === 3) {
            setRespuestas((actuales) => ({
                ...actuales,
                [numero]: {
                    ...actuales[numero],
                    [lado]: 3,
                    [otroLado]: 0
                }
            }));

            setBotonInvalido(null);
            return;
        }

        /*
         * Si el otro lado ya tiene un valor,
         * la nueva seleccion debe completar exactamente 3.
         */
        if (
            otroValor !== null &&
            otroValor !== undefined &&
            valor + otroValor !== 3
        ) {
            setBotonInvalido({
                numero,
                lado,
                valor
            });

            setTimeout(() => {
                setBotonInvalido(null);
            }, 450);

            return;
        }

        /*
         * Guardamos solamente la seleccion realizada
         * por el usuario cuando todavia falta el otro lado.
         */
        setRespuestas((actuales) => ({
            ...actuales,
            [numero]: {
                ...(actuales[numero] || {
                    a: null,
                    b: null
                }),
                [lado]: valor
            }
        }));

        setBotonInvalido(null);
    };
    const guardarCuestionario = async () => {
        try {
            const respuesta = await fetch("/api/cuestionarios", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    datos,
                    respuestas
                })
            });

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    resultado.error || "No se pudo guardar el cuestionario."
                );
            }

            localStorage.setItem("valanti_formulario_enviado", "true");
            localStorage.setItem(
                "valanti_registro",
                String(resultado.participante_id)
            );

            setRegistroGuardado(resultado.participante_id);
            setFormularioYaEnviado(true);
            setEnvioCompletado(true);

        } catch (error) {
            console.error("Error al guardar el cuestionario:", error);

            alert(
                error.message ||
                "Ocurrió un error al guardar el cuestionario."
            );
        }
    };

    const guardarDisc = async () => {
        try {
            const respuesta = await fetch("/api/cuestionarios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prueba: "DISC",
                    datos,
                    respuestasDisc
                })
            });
            const resultado = await respuesta.json();
            if (!respuesta.ok) {
                throw new Error(resultado.error || "No se pudo guardar la prueba DISC.");
            }

            setRegistroGuardado(resultado.participante_id);
            setEnvioCompletado(true);
        } catch (error) {
            console.error("Error al guardar la prueba DISC:", error);
            alert(error.message || "Ocurrió un error al guardar la prueba DISC.");
        }
    };

    const finalizarFormulario = () => {
        setEnvioCompletado(false);
        setFormularioYaEnviado(false);
        setRegistroGuardado(null);
        setDatos({
            nombre: "",
            edad: "",
            sexo: "",
            ciudad: "",
            ocupacion: "",
            empresa: "",
            estudios: ""
        });
        setRespuestas({});
        setRespuestasDisc({});
        setSeccion(pruebaSeleccionada === "PRUEBA DISC" ? "disc" : "personal");
        localStorage.removeItem("valanti_formulario_enviado");
        localStorage.removeItem("valanti_registro");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const respuestaCompleta = (numero) => {
        const respuesta = respuestas[numero];

        return (
            respuesta &&
            respuesta.a !== null &&
            respuesta.a !== undefined &&
            respuesta.b !== null &&
            respuesta.b !== undefined &&
            respuesta.a + respuesta.b === 3
        );
    };

    const irA = (seccionDestino) => {
        if (
            seccionDestino === "parte2" &&
            !seccion1Completa
        ) {
            mostrarAvisoSeccion();
            return;
        }

        setAvisoSeccion("");
        setSeccion(seccionDestino);

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    useEffect(() => {
        return () => {
            if (pdfRespuestaUrl) {
                URL.revokeObjectURL(pdfRespuestaUrl);
            }
        };
    }, [pdfRespuestaUrl]);

    const consultarRespuestas = async () => {
        setCargandoRespuestas(true);
        setErrorRespuestas("");

        try {
            const respuesta = await fetch("/api/respuestas", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-respuestas-clave": claveRespuestas
                },
                body: "{}"
            });
            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(resultado.error || "No se pudieron consultar las respuestas.");
            }

            setRespuestasAutorizadas(true);
            setRespuestasArchivadas(resultado.respuestas || []);
            setRespuestaSeleccionada(null);
            setPdfRespuestaUrl("");
        } catch (error) {
            setErrorRespuestas(error.message || "No se pudieron consultar las respuestas.");
        } finally {
            setCargandoRespuestas(false);
        }
    };

    const abrirPDFRespuesta = async (registro) => {
        setCargandoRespuestas(true);
        setErrorRespuestas("");

        try {
            const respuesta = await fetch("/api/respuestas", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-respuestas-clave": claveRespuestas
                },
                body: JSON.stringify({
                    participante_id: registro.participante_id,
                    prueba: registro.prueba
                })
            });

            if (!respuesta.ok) {
                const resultado = await respuesta.json();
                throw new Error(resultado.error || "No se pudo abrir el PDF.");
            }

            const archivo = await respuesta.blob();
            setPdfRespuestaUrl(URL.createObjectURL(archivo));
            setRespuestaSeleccionada(registro);
        } catch (error) {
            setErrorRespuestas(error.message || "No se pudo abrir el PDF.");
        } finally {
            setCargandoRespuestas(false);
        }
    };

    const cerrarRespuestas = () => {
        setClaveRespuestas("");
        setRespuestasAutorizadas(false);
        setRespuestasArchivadas([]);
        setRespuestaSeleccionada(null);
        setPdfRespuestaUrl("");
        setErrorRespuestas("");
        irA(pruebaSeleccionada === "PRUEBA DISC" ? "disc" : "personal");
    };

    const renderPregunta = (numero, frases) => {
        const respuesta = respuestas[numero] || {
            a: null,
            b: null
        };

        return (
            <article className={`question-card ${respuestaCompleta(numero) ? "question-complete" : ""}`} key={numero}>
                <div className="question-number">
                    {numero}
                </div>

                <div className="question-content">
                    <div className="question-pair">

                        <div className="phrase-column">
                            <div className="phrase-box">
                                {frases[0]}
                            </div>

                            <div className="level-buttons">
                                {niveles.map((nivel) => {
                                    const seleccionado =
                                        respuesta.a === nivel;

                                    const bloqueado =
                                        respuesta.b !== null &&
                                        respuesta.b !== undefined &&
                                        respuesta.b + nivel !== 3;

                                    return (
                                        <button
                                            type="button"
                                            key={nivel}
                                            className={`level-button ${seleccionado ? "selected" : ""} ${botonInvalido?.numero === numero && botonInvalido?.lado === "b" && botonInvalido?.valor === nivel ? "invalid-shake" : ""}`}
                                            onClick={() =>
                                                seleccionarCombinacion(
                                                    numero,
                                                    "a",
                                                    nivel
                                                )
                                            }
                                        >
                                            {nivel}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="phrase-column">
                            <div className="phrase-box">
                                {frases[1]}
                            </div>

                            <div className="level-buttons">
                                {niveles.map((nivel) => {
                                    const seleccionado =
                                        respuesta.b === nivel;

                                    const bloqueado =
                                        respuesta.a !== null &&
                                        respuesta.a !== undefined &&
                                        respuesta.a + nivel !== 3;

                                    return (
                                        <button
                                            type="button"
                                            key={nivel}
                                            className={`level-button ${seleccionado ? "selected" : ""} ${botonInvalido?.numero === numero && botonInvalido?.lado === "b" && botonInvalido?.valor === nivel ? "invalid-shake" : ""}`}
                                            onClick={() =>
                                                seleccionarCombinacion(
                                                    numero,
                                                    "b",
                                                    nivel
                                                )
                                            }
                                        >
                                            {nivel}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    {respuestaCompleta(numero) && (
                        <div className="question-complete-indicator">
                            <span className="question-complete-check">✓</span>
                            <span>Completado · 3 puntos</span>
                        </div>
                    )}

                    {respuestaCompleta(numero) && (
                        <div className="answer-confirmation">
                            <Check size={15} />
                            Respuesta registrada: {respuesta.a} - {respuesta.b}
                        </div>
                    )}
                </div>
            </article>
        );
    };

    return (
        <div className="app-shell">

            {(envioCompletado || formularioYaEnviado) && (
                <div className="submission-success-screen">
                    <div className="submission-success-card">
                        <div className="submission-success-icon">
                            <Check size={34} strokeWidth={2.2} />
                        </div>

                        <div className="submission-success-content">
                            <span className="submission-success-label">
                                FORMULARIO ENVIADO
                            </span>

                            <h1>Tu respuesta fue registrada correctamente</h1>

                            <p>
                                Gracias por completar el cuestionario. Tus respuestas quedaron guardadas.
                            </p>

                            <div className="submission-success-detail">
                                Registro #{registroGuardado}
                            </div>

                            <button
                                type="button"
                                className="primary-button submission-success-button"
                                onClick={finalizarFormulario}
                            >
                                Finalizar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {avisoSeccion && (
                <div className="section-warning">
                    <div className="section-warning-icon">
                        <Info size={18} />
                    </div>

                    <div className="section-warning-content">
                        <strong>Sección pendiente</strong>
                        <span>{avisoSeccion}</span>
                    </div>
                </div>
            )}
            <header className="topbar">
                <div className="brand">
                    <div className="brand-icon">
                        <img src="/logo_valanti.png" alt="VALANTI" className="brand-logo" />
                    </div>

                    <div>
                        <div className="brand-name">
                            {pruebaSeleccionada === "PRUEBA DISC" ? "DISC" : "VALANTI"}
                        </div>
                        <div className="brand-subtitle">
                            {pruebaSeleccionada === "PRUEBA DISC"
                                ? "Prueba de comportamiento"
                                : "Cuestionario de valores"}
                        </div>

                        <label className="assessment-picker">
                            <span className="sr-only">Seleccionar prueba</span>
                            <select
                                value={pruebaSeleccionada}
                                onChange={(event) => {
                                    const prueba = event.target.value;
                                    setPruebaSeleccionada(prueba);
                                    setSeccion(prueba === "PRUEBA DISC" ? "disc" : "personal");
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                aria-label="Seleccionar prueba"
                            >
                                <option value="VALANTI">VALANTI</option>
                                <option value="PRUEBA DISC">PRUEBA DISC</option>
                            </select>
                        </label>
                    </div>
                </div>

                <div className="top-progress">
                    <div className="progress-info">
                        <span>Progreso</span>
                        <strong>{totalPruebaRespondidas}/{totalPruebaPreguntas}</strong>
                    </div>

                    <div className="progress-track">
                        <div
                            className="progress-fill"
                            style={{ width: `${progreso}%` }}
                        />
                    </div>
                </div>
            </header>

            <div className="layout">
                <aside className="sidebar">
                    <div className="sidebar-title">
                        {pruebaSeleccionada === "PRUEBA DISC" ? "Prueba DISC" : "Cuestionario"}
                    </div>

                    {pruebaSeleccionada === "VALANTI" ? (
                        <>
                            <button
                                type="button"
                                className={`sidebar-item ${seccion === "personal" ? "active" : ""}`}
                                onClick={() => irA("personal")}
                            >
                                <UserRound size={19} />
                                <span>
                                    <strong>Información personal</strong>
                                    <small>Datos del participante</small>
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`sidebar-item ${seccion === "parte1" ? "active" : ""}`}
                                onClick={() => irA("parte1")}
                            >
                                <FileText size={19} />
                                <span>
                                    <strong>Importancia personal</strong>
                                    <small>Preguntas 1 - {totalPreguntasPrimeraParte}</small>
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`sidebar-item ${seccion === "parte2" ? "active" : ""}`}
                                onClick={() => irA("parte2")}
                            >
                                <BarChart3 size={19} />
                                <span>
                                    <strong>Frases inaceptables</strong>
                                    <small>Preguntas {totalPreguntasPrimeraParte + 1} - {totalPreguntasValanti}</small>
                                </span>
                            </button>

                            <div className="sidebar-help">
                                <Info size={18} />
                                <div>
                                    <strong>Importante</strong>
                                    <p>En cada pregunta los dos valores deben sumar exactamente 3.</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <button
                            type="button"
                            className={`sidebar-item ${seccion === "disc" ? "active" : ""}`}
                            onClick={() => irA("disc")}
                        >
                            <ClipboardList size={19} />
                            <span>
                                <strong>Cuestionario DISC</strong>
                                <small>28 grupos</small>
                            </span>
                        </button>
                    )}

                    <button
                        type="button"
                        className={`sidebar-item ${seccion === "respuestas" ? "active" : ""}`}
                        onClick={() => irA("respuestas")}
                    >
                        <FileText size={19} />
                        <span>
                            <strong>Respuestas</strong>
                            <small>PDF por participante</small>
                        </span>
                    </button>
                </aside>

                <main className="main-content">
                    {pruebaSeleccionada === "PRUEBA DISC" && seccion === "disc" && (
                        <section className="content-section disc-section">
                            <div className="page-heading">
                                <div>
                                    <span className="eyebrow">PRUEBA DISC</span>
                                    <h1>Perfil de comportamiento</h1>
                                    <p>
                                        En cada grupo selecciona una palabra que más te representa y otra que menos te representa.
                                    </p>
                                </div>
                                <div className="disc-progress">
                                    {totalDiscRespondidas}/28 grupos
                                </div>
                            </div>

                            <div className="disc-instruction">
                                <Info size={19} />
                                <div>
                                    <strong>Cómo responder</strong>
                                    <p>
                                        Cada grupo tiene cuatro palabras. Marca una opción como <b>MAS</b> y una diferente como <b>MENOS</b>.
                                    </p>
                                </div>
                            </div>

                            <div className="form-card disc-participant-card">
                                <div className="disc-participant-fields">
                                    <div className="field">
                                        <label>
                                            <UserRound size={16} />
                                            Nombre <span className="required-mark">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={datos.nombre}
                                            onChange={(event) => actualizarDato("nombre", event.target.value)}
                                            placeholder="Nombre completo"
                                        />
                                    </div>

                                    <div className="field">
                                        <label>
                                            <Building2 size={16} />
                                            Empresa
                                        </label>
                                        <input
                                            type="text"
                                            value={datos.empresa}
                                            onChange={(event) => actualizarDato("empresa", event.target.value)}
                                            placeholder="Empresa"
                                        />
                                    </div>

                                    <div className="field">
                                        <label>
                                            <BriefcaseBusiness size={16} />
                                            Cargo
                                        </label>
                                        <input
                                            type="text"
                                            value={datos.ocupacion}
                                            onChange={(event) => actualizarDato("ocupacion", event.target.value)}
                                            placeholder="Cargo"
                                        />
                                    </div>

                                    <div className="field">
                                        <label>
                                            <MapPin size={16} />
                                            Ciudad
                                        </label>
                                        <input
                                            type="text"
                                            value={datos.ciudad}
                                            onChange={(event) => actualizarDato("ciudad", event.target.value)}
                                            placeholder="Ciudad"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="disc-grid">
                                {gruposDisc.map((grupo, indice) => {
                                    const respuesta = respuestasDisc[indice] || {};

                                    return (
                                        <article className="disc-card" key={indice}>
                                            <div className="disc-card-header">
                                                <span>Grupo {indice + 1}</span>
                                                {respuesta.mas && respuesta.menos && <Check size={16} />}
                                            </div>

                                            <div className="disc-choice-list">
                                                {grupo.map((palabra) => (
                                                    <div className="disc-choice" key={palabra}>
                                                        <span>{palabra}</span>
                                                        <div className="disc-choice-actions">
                                                            <button
                                                                type="button"
                                                                className={`disc-choice-button disc-more ${respuesta.mas === palabra ? "selected" : ""}`}
                                                                onClick={() => seleccionarDisc(indice, "mas", palabra, grupo.indexOf(palabra))}
                                                                aria-label={`Marcar ${palabra} como más representativa`}
                                                            >
                                                                MAS
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`disc-choice-button disc-less ${respuesta.menos === palabra ? "selected" : ""}`}
                                                                onClick={() => seleccionarDisc(indice, "menos", palabra, grupo.indexOf(palabra))}
                                                                aria-label={`Marcar ${palabra} como menos representativa`}
                                                            >
                                                                MENOS
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>

                            <div className="section-actions disc-actions">
                                <button
                                    type="button"
                                    className="primary-button"
                                    disabled={totalDiscRespondidas !== 28 || !datos.nombre.trim()}
                                    onClick={guardarDisc}
                                >
                                    Finalizar prueba DISC
                                    <Check size={18} />
                                </button>
                            </div>
                        </section>
                    )}

                    {pruebaSeleccionada === "VALANTI" && seccion === "personal" && (
                        <section className="content-section">
                            <div className="page-heading">
                                <div>
                                    <span className="eyebrow">
                                        PASO 1 DE 3
                                    </span>
                                    <h1>Información personal</h1>
                                    <p>
                                        Complete los datos del participante
                                        antes de comenzar el cuestionario.
                                    </p>
                                </div>
                            </div>

                            <div className="form-card">
                                <div className="form-grid">
                                    <div className="field">
                                        <label>
                                            <UserRound size={16} />
                                            Nombre
                                        </label>
                                        <input
                                            type="text"
                                            value={datos.nombre}
                                            onChange={(e) =>
                                                actualizarDato(
                                                    "nombre",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Nombre completo"
                                        />
                                    </div>

                                    <div className="field">
                                        <label>
                                            <CalendarDays size={16} />
                                            Edad
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="120"
                                            value={datos.edad}
                                            onChange={(e) =>
                                                actualizarDato(
                                                    "edad",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Edad"
                                        />
                                    </div>

                                    <div className="field">
                                        <label>
                                            <UserRound size={16} />
                                            Sexo
                                        </label>
                                        <select
                                            value={datos.sexo}
                                            onChange={(e) =>
                                                actualizarDato(
                                                    "sexo",
                                                    e.target.value
                                                )
                                            }
                                        >
                                            <option value="">
                                                Seleccionar
                                            </option>
                                            <option value="Hombre">
                                                Hombre
                                            </option>
                                            <option value="Mujer">
                                                Mujer
                                            </option>
                                        </select>
                                    </div>

                                    <div className="field">
                                        <label>
                                            <MapPin size={16} />
                                            Ciudad
                                        </label>
                                        <input
                                            type="text"
                                            value={datos.ciudad}
                                            onChange={(e) =>
                                                actualizarDato(
                                                    "ciudad",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Ciudad"
                                        />
                                    </div>

                                    <div className="field">
                                        <label>
                                            <BriefcaseBusiness size={16} />
                                            Ocupación
                                        </label>
                                        <input
                                            type="text"
                                            value={datos.ocupacion}
                                            onChange={(e) =>
                                                actualizarDato(
                                                    "ocupacion",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Ocupación"
                                        />
                                    </div>

                                    <div className="field">
                                        <label>
                                            <Building2 size={16} />
                                            Empresa
                                        </label>
                                        <input
                                            type="text"
                                            value={datos.empresa}
                                            onChange={(e) =>
                                                actualizarDato(
                                                    "empresa",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Empresa"
                                        />
                                    </div>

                                    <div className="field field-full">
                                        <label>
                                            <GraduationCap size={16} />
                                            Estudios
                                        </label>
                                        <select
                                            value={datos.estudios}
                                            onChange={(e) =>
                                                actualizarDato(
                                                    "estudios",
                                                    e.target.value
                                                )
                                            }
                                        >
                                            <option value="">
                                                Seleccionar nivel de estudios
                                            </option>
                                            <option value="Secundaria">
                                                Secundaria
                                            </option>
                                            <option value="Técnico">
                                                Técnico
                                            </option>
                                            <option value="Universitario">
                                                Universitario
                                            </option>
                                            <option value="Otro">Otro</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="rules-box">
                                    <Info size={19} />

                                    <div>
                                        <strong>Antes de comenzar</strong>
                                        <p>
                                            Las preguntas 1 a {totalPreguntasPrimeraParte} miden la
                                            importancia que tiene cada frase
                                            para usted. En cada pareja debe
                                            repartir 3 puntos entre ambas
                                            frases.
                                        </p>
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={() => irA("parte1")}
                                    >
                                        Comenzar cuestionario
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}

                    {pruebaSeleccionada === "VALANTI" && seccion === "parte1" && (
                        <section className="content-section">
                            <div className="page-heading">
                                <div>
                                    <span className="eyebrow">
                                        PASO 2 DE 3
                                    </span>
                                    <h1>Importancia personal</h1>
                                    <p>
                                        Preguntas 1 a {totalPreguntasPrimeraParte}. Distribuya los 3
                                        puntos según la importancia de cada
                                        frase en su vida personal.
                                    </p>
                                </div>
                            </div>

                            <div className="question-instruction">
                                <div className="question-instruction-title">
                                    ¿Cómo responder?
                                </div>
                                <div className="question-instruction-text">
                                    Seleccione un nivel de <strong>1, 2 o 3</strong> para cada frase
                                    según la importancia que tenga para usted. En cada pareja de frases,
                                    los dos valores deben completar <strong>3 puntos</strong>.
                                </div>
                            </div>
                            <div className="questions-list">
                                {preguntasPrimeraParte.map((pregunta, index) =>
                                    renderPregunta(index + 1, pregunta)
                                )}
                            </div>

                            <div className="section-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => irA("personal")}
                                >
                                    Volver
                                </button>

                                <button
                                    type="button"
                                    className="primary-button"
                                    onClick={() => irA("parte2")}
                                >
                                    Continuar a preguntas {totalPreguntasPrimeraParte + 1} - {totalPreguntasValanti}
                                    <ArrowRight size={18} />
                                </button>
                            </div>
                        </section>
                    )}

                    {pruebaSeleccionada === "VALANTI" && seccion === "parte2" && (
                        <section className="content-section">
                            <div className="page-heading">
                                <div>
                                    <span className="eyebrow">
                                        PASO 3 DE 3
                                    </span>
                                    <h1>Frases inaceptables</h1>
                                    <p>
                                        Preguntas {totalPreguntasPrimeraParte + 1} a {totalPreguntasValanti}. Asigne el puntaje
                                        más alto a la frase que considere más
                                        inaceptable.
                                    </p>
                                </div>
                            </div>

                            <div className="instruction-card">
                                <Info size={20} />
                                <div>
                                    <strong>Cómo responder</strong>
                                    <p>
                                        Marque una combinación de 0 a 3. El
                                        puntaje más alto corresponde a la frase
                                        que considere más inaceptable. Los dos
                                        valores deben sumar 3.
                                    </p>
                                </div>
                            </div>

                            <div className="question-instruction">
                                <div className="question-instruction-title">
                                    Segunda parte: ¿cómo responder?
                                </div>
                                <div className="question-instruction-text">
                                    Seleccione un nivel de <strong>1, 2 o 3</strong> para cada frase,
                                    dando el puntaje más alto a la frase que considere
                                    <strong> más inaceptable</strong>. En cada pareja de frases,
                                    los dos valores deben completar <strong>3 puntos</strong>.
                                </div>
                            </div>
                            <div className="questions-list">
                                {preguntasSegundaParte.map((pregunta, index) =>
                                    renderPregunta(index + totalPreguntasPrimeraParte + 1, pregunta)
                                )}
                            </div>

                            <div className="completion-card">
                                <div className="completion-icon">
                                    <Check size={22} />
                                </div>

                                <div>
                                    <strong>Cuestionario</strong>
                                    <p>
                                        Ha respondido {totalRespondidas} de {totalPreguntasValanti}
                                        preguntas.
                                    </p>
                                </div>
                            </div>

                            <div className="section-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => irA("parte1")}
                                >
                                    Volver
                                </button>

                                <button
                                    type="button"
                                    className="primary-button"
                                    disabled={totalRespondidas !== totalPreguntasValanti}
                                    onClick={guardarCuestionario}
                                >
                                    Finalizar cuestionario
                                    <Check size={18} />
                                </button>
                            </div>
                        </section>
                    )}

                    {seccion === "respuestas" && (
                        <section className="content-section responses-section">
                            {!respuestasAutorizadas ? (
                                <div className="responses-gate">
                                    <div className="responses-gate-icon">
                                        <KeyRound size={22} />
                                    </div>
                                    <span className="eyebrow">ACCESO PRIVADO</span>
                                    <h1>Respuestas</h1>
                                    <p>Introduce la clave para abrir el archivo de pruebas.</p>

                                    <form
                                        className="responses-key-form"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            consultarRespuestas();
                                        }}
                                    >
                                        <label htmlFor="respuestas-clave">Clave de acceso</label>
                                        <input
                                            id="respuestas-clave"
                                            type="password"
                                            autoComplete="current-password"
                                            value={claveRespuestas}
                                            onChange={(event) => setClaveRespuestas(event.target.value)}
                                            required
                                        />
                                        <button
                                            type="submit"
                                            className="primary-button"
                                            disabled={cargandoRespuestas || !claveRespuestas}
                                        >
                                            {cargandoRespuestas ? (
                                                <LoaderCircle className="responses-spinner" size={18} />
                                            ) : (
                                                <KeyRound size={18} />
                                            )}
                                            Abrir respuestas
                                        </button>
                                    </form>

                                    {errorRespuestas && (
                                        <p className="responses-error" role="alert">{errorRespuestas}</p>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="responses-heading">
                                        <div>
                                            <span className="eyebrow">ARCHIVO DE PRUEBAS</span>
                                            <h1>
                                                {respuestaSeleccionada
                                                    ? `Respuesta de ${respuestaSeleccionada.nombre}`
                                                    : "Respuestas archivadas"}
                                            </h1>
                                            <p>Informes individuales de VALANTI y DISC.</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="secondary-button responses-lock-button"
                                            onClick={cerrarRespuestas}
                                        >
                                            <LogOut size={17} />
                                            Bloquear
                                        </button>
                                    </div>

                                    {errorRespuestas && (
                                        <p className="responses-error" role="alert">{errorRespuestas}</p>
                                    )}

                                    <div className="responses-workspace">
                                        <section className="responses-list" aria-label="Pruebas guardadas">
                                            <div className="responses-list-heading">
                                                <h2>Participantes</h2>
                                                <span>{respuestasArchivadas.length}</span>
                                            </div>

                                            {respuestasArchivadas.length ? (
                                                respuestasArchivadas.map((registro) => (
                                                    <article
                                                        className={`response-entry ${respuestaSeleccionada?.participante_id === registro.participante_id && respuestaSeleccionada?.prueba === registro.prueba ? "active" : ""}`}
                                                        key={`${registro.prueba}-${registro.participante_id}`}
                                                    >
                                                        <div className="response-entry-details">
                                                            <strong>{registro.nombre}</strong>
                                                            <div>
                                                                <span className={`response-test-tag ${registro.prueba === "DISC" ? "disc" : "valanti"}`}>
                                                                    {registro.prueba}
                                                                </span>
                                                                <time dateTime={registro.fecha_creacion || undefined}>
                                                                    {registro.fecha_creacion
                                                                        ? new Date(registro.fecha_creacion).toLocaleDateString("es-ES")
                                                                        : "Fecha no disponible"}
                                                                </time>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="secondary-button response-open-button"
                                                            onClick={() => abrirPDFRespuesta(registro)}
                                                            disabled={cargandoRespuestas}
                                                        >
                                                            <Eye size={16} />
                                                            Ver PDF
                                                        </button>
                                                    </article>
                                                ))
                                            ) : (
                                                <p className="responses-empty-list">Todavía no hay pruebas guardadas.</p>
                                            )}
                                        </section>

                                        <section className="responses-preview" aria-label="Vista previa del PDF">
                                            {pdfRespuestaUrl && respuestaSeleccionada ? (
                                                <>
                                                    <div className="responses-preview-toolbar">
                                                        <strong>Respuesta de {respuestaSeleccionada.nombre}</strong>
                                                        <a
                                                            className="primary-button"
                                                            href={pdfRespuestaUrl}
                                                            download={`respuesta-${respuestaSeleccionada.prueba.toLowerCase()}-${respuestaSeleccionada.participante_id}.pdf`}
                                                        >
                                                            <Download size={17} />
                                                            Descargar PDF
                                                        </a>
                                                    </div>
                                                    <iframe
                                                        className="responses-pdf-frame"
                                                        src={pdfRespuestaUrl}
                                                        title={`Respuesta de ${respuestaSeleccionada.nombre}`}
                                                    />
                                                </>
                                            ) : (
                                                <div className="responses-preview-empty">
                                                    {cargandoRespuestas ? (
                                                        <LoaderCircle className="responses-spinner" size={26} />
                                                    ) : (
                                                        <FileText size={30} />
                                                    )}
                                                    <p>Selecciona una prueba para ver su PDF.</p>
                                                </div>
                                            )}
                                        </section>
                                    </div>
                                </>
                            )}
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;

































