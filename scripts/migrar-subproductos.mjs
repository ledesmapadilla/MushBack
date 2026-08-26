/**
 * Pasa las cajas ya cargadas al modelo de subproductos.
 *
 * Antes una caja repetia la receta de lo que llevaba adentro y decia aparte
 * cuantas unidades entraban; un surtido, ademas, anotaba su composicion por
 * receta y arrastraba una receta de relleno que no significaba nada. Ahora un
 * subproducto solo declara que productos lleva y cuantos de cada uno:
 *
 *     tipo: "subproducto"
 *     receta: ""
 *     composicion: [{ producto, cantidad }]
 *     unidades: la suma de esas cantidades
 *
 * No es obligatorio correrlo: la app lee las dos formas, y cada caja se
 * convierte sola la proxima vez que se la guarde desde el alta. Sirve para
 * hacerlas todas juntas.
 *
 * Uso, desde MushBack:
 *     node scripts/migrar-subproductos.mjs              (solo muestra que haria)
 *     node scripts/migrar-subproductos.mjs --escribir   (guarda, con respaldo)
 *
 * Importante: cerrar la app antes de escribir. El guardado del navegador manda
 * el producto entero, asi que una pestana abierta con los datos viejos los
 * vuelve a pisar. Despues de correrlo, F5.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const datos = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const archivo = join(datos, "alfajores.json");

const alfajores = JSON.parse(readFileSync(archivo, "utf8"));

// El producto que se hace con esa receta: es el que la caja lleva adentro.
const productoDeReceta = (slug) =>
  alfajores.find((p) => p.presentacion !== "caja" && p.receta === slug)?.id || "";

const migrar = (item) => {
  if (item.presentacion !== "caja") {
    return item.receta ? { ...item, tipo: "producto" } : item;
  }

  const lleva =
    (item.composicion || []).length > 0
      ? item.composicion.map((c) => ({
          producto: c.producto || productoDeReceta(c.receta),
          cantidad: Number(c.cantidad) || 0,
        }))
      : [{ producto: productoDeReceta(item.receta), cantidad: Number(item.unidades) || 0 }];

  return {
    ...item,
    tipo: "subproducto",
    receta: "",
    composicion: lleva,
    unidades: lleva.reduce((suma, l) => suma + l.cantidad, 0),
  };
};

const migrados = alfajores.map(migrar);

// Una linea sin producto seria una caja que no sabe que lleva: no se escribe
// nada hasta resolverla a mano.
const sinResolver = migrados
  .filter((p) => p.tipo === "subproducto")
  .filter((p) => p.composicion.some((l) => !l.producto || !l.cantidad));

migrados
  .filter((p) => p.tipo === "subproducto")
  .forEach((p) => {
    const detalle = p.composicion
      .map((l) => `${l.cantidad} x ${alfajores.find((a) => a.id === l.producto)?.nombre || "???"}`)
      .join(" + ");
    console.log(`  ${p.nombre.padEnd(34)} ${detalle}`);
  });

console.log(`\n${migrados.filter((p) => p.tipo === "subproducto").length} subproductos.`);

if (sinResolver.length > 0) {
  console.log("\nNo se puede migrar: estas cajas tienen lineas sin producto.");
  sinResolver.forEach((p) => console.log("  " + p.nombre));
  process.exit(1);
}

if (!process.argv.includes("--escribir")) {
  console.log("\nNo se escribio nada. Para guardar: --escribir");
  process.exit(0);
}

// Con marca de tiempo, como los respaldos que hace la app: dos corridas el
// mismo dia no se pisan una a la otra.
const sello = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(join(datos, `alfajores.json.${sello}.bak`), readFileSync(archivo));
writeFileSync(archivo, JSON.stringify(migrados, null, 2));
console.log(`\nGuardado. Respaldo en alfajores.json.${sello}.bak. Refrescar la app (F5).`);
