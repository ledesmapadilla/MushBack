import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizarNombreIngrediente } from "./ingrediente.controller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../data/alfajores.json");

// Asegurar archivo
const asegurarArchivo = () => {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
  }
};

const leerAlfajores = () => {
  asegurarArchivo();
  try {
    const data = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch (error) {
    console.error("Error leyendo alfajores:", error);
    return [];
  }
};

const escribirAlfajores = (alfajores) => {
  asegurarArchivo();
  fs.writeFileSync(DATA_FILE, JSON.stringify(alfajores, null, 2), "utf-8");
};

// Validación Backend de Alfajor
const validarAlfajorBackend = (datos, alfajoresExistentes, idExcluir = null) => {
  const errores = [];

  // Validar nombre
  if (!datos.nombre || typeof datos.nombre !== "string" || !datos.nombre.trim()) {
    errores.push("El nombre del alfajor es obligatorio.");
  } else {
    const nombreLimpio = datos.nombre.trim();
    if (nombreLimpio.length < 2) {
      errores.push("El nombre debe tener al menos 2 caracteres.");
    }
    if (nombreLimpio.length > 70) {
      errores.push("El nombre no puede superar los 70 caracteres.");
    }

    // Comprobación de duplicados (insensible a mayúsculas, espacios y singular/plural)
    const canonicoNuevo = normalizarNombreIngrediente(nombreLimpio);

    const alfajorDuplicado = alfajoresExistentes.find(
      (item) =>
        item.id !== idExcluir &&
        normalizarNombreIngrediente(item.nombre) === canonicoNuevo
    );

    if (alfajorDuplicado) {
      errores.push(
        `Ya existe un alfajor registrado como "${alfajorDuplicado.nombre}" (coincide en singular/plural).`
      );
    }
  }

  // Validar categoría si viene
  if (datos.categoria && typeof datos.categoria === "string") {
    if (datos.categoria.length > 50) {
      errores.push("La categoría no puede superar los 50 caracteres.");
    }
  }

  // Validar observaciones
  if (datos.observaciones && typeof datos.observaciones === "string") {
    if (datos.observaciones.length > 250) {
      errores.push("Las observaciones no pueden superar los 250 caracteres.");
    }
  }

  return errores;
};

// Controladores REST
export const listarAlfajores = (req, res) => {
  try {
    const alfajores = leerAlfajores();
    return res.status(200).json({
      success: true,
      total: alfajores.length,
      data: alfajores,
    });
  } catch (error) {
    console.error("Error al listar alfajores:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al obtener alfajores.",
    });
  }
};

export const crearAlfajor = (req, res) => {
  try {
    const { nombre, categoria, observaciones } = req.body;
    const alfajores = leerAlfajores();

    // Validaciones en Backend
    const errores = validarAlfajorBackend({ nombre, categoria, observaciones }, alfajores);
    if (errores.length > 0) {
      return res.status(400).json({
        success: false,
        message: errores[0],
        errores,
      });
    }

    const baseSlug = nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 20);
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const id = `alf_${baseSlug}_${randomSuffix}`;

    const nuevoAlfajor = {
      id,
      nombre: nombre.trim(),
      categoria: categoria ? categoria.trim() : "Clásico",
      observaciones: observaciones ? observaciones.trim() : "",
      ...datosDeVenta(req.body),
      creadoEn: new Date().toISOString(),
    };

    alfajores.push(nuevoAlfajor);
    escribirAlfajores(alfajores);

    return res.status(201).json({
      success: true,
      message: `Alfajor "${nuevoAlfajor.nombre}" registrado exitosamente.`,
      data: nuevoAlfajor,
    });
  } catch (error) {
    console.error("Error al crear alfajor:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al guardar alfajor.",
    });
  }
};


/**
 * Lo que hace a un producto algo vendible: de que receta sale su costo y en que
 * presentacion se vende.
 *
 * Una caja no es otra receta: es el mismo producto en otra presentacion. Por eso
 * `receta` apunta a como se hace y `unidades` dice cuantas entran.
 *
 * Un guardado que no traiga estos campos no los borra: la pantalla de alta
 * todavia edita solo el nombre y la categoria.
 */
const datosDeVenta = (datos, previo = {}) => {
  const tomar = (campo, porDefecto) =>
    datos[campo] !== undefined ? datos[campo] : previo[campo] !== undefined ? previo[campo] : porDefecto;

  return {
    // De donde sale el costo (el slug de la receta).
    receta: tomar("receta", ""),
    // "unidad" o "caja".
    presentacion: tomar("presentacion", "unidad"),
    // Cuantas unidades entran en la caja.
    unidades: Number(tomar("unidades", 0)) || 0,
    // El packaging de la caja, si lleva.
    carton: tomar("carton", ""),
    // Las cajas armadas llevan varios productos: [{ receta, cantidad }].
    composicion: Array.isArray(tomar("composicion", null)) ? tomar("composicion", []) : [],
    // Con que se lo reconoce en las listas.
    emoji: tomar("emoji", ""),
    // Un producto que se dejo de vender no aparece en Precios ni en Ventas.
    activo: tomar("activo", true) !== false,
  };
};

export const actualizarAlfajor = (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, categoria, observaciones } = req.body;
    const alfajores = leerAlfajores();

    const index = alfajores.findIndex((a) => a.id === id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "El alfajor solicitado no existe.",
      });
    }

    // Validaciones en Backend
    const errores = validarAlfajorBackend({ nombre, categoria, observaciones }, alfajores, id);
    if (errores.length > 0) {
      return res.status(400).json({
        success: false,
        message: errores[0],
        errores,
      });
    }

    const alfajorActualizado = {
      ...alfajores[index],
      nombre: nombre.trim(),
      categoria: categoria ? categoria.trim() : "Clásico",
      observaciones: observaciones ? observaciones.trim() : "",
      ...datosDeVenta(req.body, alfajores[index]),
      actualizadoEn: new Date().toISOString(),
    };

    alfajores[index] = alfajorActualizado;
    escribirAlfajores(alfajores);

    return res.status(200).json({
      success: true,
      message: `Alfajor "${alfajorActualizado.nombre}" actualizado exitosamente.`,
      data: alfajorActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar alfajor:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al actualizar alfajor.",
    });
  }
};

export const eliminarAlfajor = (req, res) => {
  try {
    const { id } = req.params;
    const alfajores = leerAlfajores();

    const existe = alfajores.some((a) => a.id === id);
    if (!existe) {
      return res.status(404).json({
        success: false,
        message: "El alfajor a eliminar no existe.",
      });
    }

    const filtrados = alfajores.filter((a) => a.id !== id);
    escribirAlfajores(filtrados);

    return res.status(200).json({
      success: true,
      message: "Alfajor eliminado exitosamente.",
    });
  } catch (error) {
    console.error("Error al eliminar alfajor:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al eliminar alfajor.",
    });
  }
};
