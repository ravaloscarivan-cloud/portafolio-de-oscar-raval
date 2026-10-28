import fs from "fs";
import path from "path";
import db from "./database-online.js";
import { generarPDFResultados } from "./reportes/generarPDFResultados.js";

const carpeta = path.join(process.cwd(), "reportes");
const archivoPDF = path.join(carpeta, "valanti_registros.pdf");

if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
}

const pdfBuffer = await generarPDFResultados(db);
fs.writeFileSync(archivoPDF, pdfBuffer);

console.log(`PDF actualizado correctamente: ${archivoPDF}`);

export default archivoPDF;