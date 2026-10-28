import { obtenerResultados } from "./consultarResultados.js";
import fs from "fs";

const resultados = obtenerResultados();

fs.writeFileSync(
    "./reportes/resultados.json",
    JSON.stringify(resultados, null, 2),
    "utf8"
);

console.log("Archivo resultados.json creado correctamente.");
console.log(`Participantes: ${resultados.participantes.length}`);
console.log(`Respuestas: ${resultados.respuestas.length}`);
