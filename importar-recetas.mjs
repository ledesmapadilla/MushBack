// Importa al backend las recetas que quedaron guardadas en el localStorage del
// navegador. Uso:
//
//   1) En el navegador donde cargaste los datos, abrir la consola (F12) y correr:
//        copy(localStorage.getItem("mush_sistema_alfajores_v4_recetas"))
//      Eso copia el JSON al portapapeles.
//
//   2) Pegarlo en un archivo, por ejemplo  recetas-navegador.json
//
//   3) Desde la carpeta MushBack:
//        node importar-recetas.mjs recetas-navegador.json
//
// Solo completa: nunca pisa con una lista vacia una receta que ya tiene
// ingredientes cargados en el servidor.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTINO = path.join(__dirname, "src/data/recetas.json");

const leerJson = (ruta) => {
  const crudo = fs.readFileSync(ruta, "utf-8").replace(/^﻿/, "");
  return JSON.parse(crudo || "[]");
};

const origen = process.argv[2];
if (!origen) {
  console.error("Falta el archivo de origen.\n  node importar-recetas.mjs recetas-navegador.json");
  process.exit(1);
}

if (!fs.existsSync(origen)) {
  console.error(`No existe el archivo: ${origen}`);
  process.exit(1);
}

const entrantes = leerJson(origen);
if (!Array.isArray(entrantes)) {
  console.error("El archivo de origen no contiene un array de recetas.");
  process.exit(1);
}

const actuales = leerJson(DESTINO);

// Copia de seguridad antes de tocar nada
const backup = `${DESTINO}.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`;
fs.copyFileSync(DESTINO, backup);
console.info(`Copia de seguridad: ${path.basename(backup)}\n`);

const mismaReceta = (a, b) =>
  Boolean((a.id && b.id && a.id === b.id) || (a.slug && b.slug && a.slug === b.slug));

let importadas = 0;
let agregadas = 0;

for (const entrante of entrantes) {
  const ingredientes = Array.isArray(entrante.ingredientes) ? entrante.ingredientes : [];
  if (ingredientes.length === 0) continue;

  const indice = actuales.findIndex((r) => mismaReceta(r, entrante));

  if (indice === -1) {
    actuales.push({ ...entrante, ingredientes });
    agregadas++;
    console.info(`+ ${entrante.slug || entrante.id}: receta nueva con ${ingredientes.length} items`);
    continue;
  }

  const previos = (actuales[indice].ingredientes || []).length;
  actuales[indice] = { ...actuales[indice], ...entrante, ingredientes };
  importadas++;
  console.info(`~ ${entrante.slug || entrante.id}: ${previos} -> ${ingredientes.length} items`);
}

if (importadas === 0 && agregadas === 0) {
  console.info("No habia recetas con ingredientes para importar. No se modifico nada.");
  fs.unlinkSync(backup);
  process.exit(0);
}

fs.writeFileSync(DESTINO, JSON.stringify(actuales, null, 2), "utf-8");
console.info(`\nListo: ${importadas} actualizadas, ${agregadas} agregadas.`);
