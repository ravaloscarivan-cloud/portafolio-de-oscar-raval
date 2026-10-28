// Evaluación de cada capacitación: 5 preguntas de pre-test y 5 distintas de post-test, sobre el tema.
// Formato: { pre: [{ pregunta, opciones, correcta }], post: [...] }  ("correcta" = índice de la opción correcta)

import { estaOculta } from './capacitacion.js';
import { evaluacionesFijas } from './evaluaciones.js';

/** Preguntas de un test sin la respuesta correcta (lo que ve el usuario). */
export const sinRespuestas = (preguntas = []) => preguntas.map(({ pregunta, opciones }) => ({ pregunta, opciones }));

/** Evaluación de una capacitación visible, o null. */
export async function obtenerEvaluacion(sql, capacitacionId) {
  const evaluacion = evaluacionesFijas[capacitacionId];
  if (!evaluacion || (await estaOculta(sql, capacitacionId))) return null;
  return { evaluacion };
}

export function calificar(preguntas, respuestas) {
  const detalle = preguntas.map((p, i) => ({ correcta: p.correcta, elegida: Number.isInteger(respuestas[i]) ? respuestas[i] : null }));
  const correctas = detalle.filter((d) => d.elegida === d.correcta).length;
  return { correctas, total: preguntas.length, puntaje: preguntas.length ? Math.round((correctas / preguntas.length) * 100) : 0, detalle };
}
