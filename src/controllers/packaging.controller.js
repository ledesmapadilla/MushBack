import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizarNombreIngrediente } from "./ingrediente.controller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../data/packaging.json");

const asegurarArchivo = () => {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
  }
};

const leerPackaging = () => {
  asegurarArchivo();
  try {
    const data = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch (error) {
    console.error("Error leyendo packaging:", error);
    return [];
  }
};

const escribirPackaging = (items) => {
  asegurarArchivo();
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
};

const validarPackagingBackend = (datos, packagingExistentes, idExcluir = null) => {
  const errores = [];

  if (!datos.nombre || typeof datos.nombre !== "string" || !datos.nombre.trim()) {
    errores.push("El nombre del packaging es obligatorio.");
  } else {
    const nombreLimpio = datos.nombre.trim();
    if (nombreLimpio.length < 2) {
      errores.push("El nombre debe tener al menos 2 caracteres.");
    }
    if (nombreLimpio.length > 70) {
      errores.push("El nombre no puede superar los 70 caracteres.");
    }

    const canonicoNuevo = normalizarNombreIngrediente(nombreLimpio);
    const duplicado = packagingExistentes.find(
      (item) =>
        item.id !== idExcluir &&
        normalizarNombreIngrediente(item.nombre) === canonicoNuevo
    );

    if (duplicado) {
      errores.push(
        `Ya existe un packaging registrado como "${duplicado.nombre}".`
      );
    }
  }

  if (datos.unidad && typeof datos.unidad === "string") {
    if (datos.unidad.length > 20) {
      errores.push("La unidad no puede superar los 20 caracteres.");
    }
  }

  if (datos.observaciones && typeof datos.observaciones === "string") {
    if (datos.observaciones.length > 250) {
      errores.push("Las observaciones no pueden superar los 250 caracteres.");
    }
  }

  return errores;
};

export const listarPackaging = (req, res) => {
  try {
    const items = leerPackaging();
    return res.status(200).json({
      success: true,
      total: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Error al listar packaging:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al obtener packaging.",
    });
  }
};

// El historial de precios llega desde la pantalla de Precios. Se guarda saneado
// para que un cuerpo malformado no ensucie el archivo de datos.
const normalizarHistorial = (historial) =>
  Array.isArray(historial)
    ? historial
        .filter((registro) => registro && typeof registro === "object")
        .map((registro) => ({
          fecha: registro.fecha || "",
          precio: Number(registro.precio) || 0,
          unidad: registro.unidad ? String(registro.unidad).trim() : "",
          observaciones: registro.observaciones ? String(registro.observaciones).trim() : "",
          registradoEn: registro.registradoEn || new Date().toISOString(),
        }))
    : [];

export const crearPackaging = (req, res) => {
  try {
    const {
      nombre,
      unidad,
      categoria,
      observaciones,
      precio,
      fechaPrecio,
      observacionesPrecio,
      historialPrecios,
      id: customId,
    } = req.body;
    const items = leerPackaging();

    const errores = validarPackagingBackend({ nombre, unidad, categoria, observaciones }, items);
    if (errores.length > 0) {
      return res.status(400).json({
        success: false,
        message: errores[0],
        errores,
      });
    }

    let id = customId;
    if (!id) {
      const baseSlug = nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 20);
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      id = `pack_${baseSlug}_${randomSuffix}`;
    }

    const nuevoItem = {
      id,
      nombre: nombre.trim(),
      unidad: (unidad ? unidad.trim() : (categoria ? categoria.trim() : "un")),
      observaciones: observaciones ? observaciones.trim() : "",
      precio: precio !== undefined ? Number(precio) : 0,
      fechaPrecio: fechaPrecio || "",
      observacionesPrecio: observacionesPrecio ? observacionesPrecio.trim() : "",
      historialPrecios: normalizarHistorial(historialPrecios),
      creadoEn: new Date().toISOString(),
    };

    items.push(nuevoItem);
    escribirPackaging(items);

    return res.status(201).json({
      success: true,
      message: `Packaging "${nuevoItem.nombre}" registrado exitosamente.`,
      data: nuevoItem,
    });
  } catch (error) {
    console.error("Error al crear packaging:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al guardar packaging.",
    });
  }
};

export const actualizarPackaging = (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      unidad,
      categoria,
      observaciones,
      precio,
      fechaPrecio,
      observacionesPrecio,
      historialPrecios,
    } = req.body;
    const items = leerPackaging();

    const index = items.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "El packaging solicitado no existe.",
      });
    }

    const errores = validarPackagingBackend({ nombre, unidad, categoria, observaciones }, items, id);
    if (errores.length > 0) {
      return res.status(400).json({
        success: false,
        message: errores[0],
        errores,
      });
    }

    const itemActualizado = {
      ...items[index],
      nombre: nombre.trim(),
      unidad: unidad ? unidad.trim() : (categoria ? categoria.trim() : (items[index].unidad || "un")),
      observaciones: observaciones !== undefined ? observaciones.trim() : items[index].observaciones,
      ...(precio !== undefined && { precio: Number(precio) }),
      ...(fechaPrecio !== undefined && { fechaPrecio: fechaPrecio || "" }),
      ...(observacionesPrecio !== undefined && {
        observacionesPrecio: observacionesPrecio ? observacionesPrecio.trim() : "",
      }),
      ...(historialPrecios !== undefined && {
        historialPrecios: normalizarHistorial(historialPrecios),
      }),
      actualizadoEn: new Date().toISOString(),
    };

    items[index] = itemActualizado;
    escribirPackaging(items);

    return res.status(200).json({
      success: true,
      message: `Packaging "${itemActualizado.nombre}" actualizado exitosamente.`,
      data: itemActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar packaging:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al actualizar packaging.",
    });
  }
};

export const eliminarPackaging = (req, res) => {
  try {
    const { id } = req.params;
    const items = leerPackaging();

    const existe = items.some((p) => p.id === id);
    if (!existe) {
      return res.status(404).json({
        success: false,
        message: "El packaging a eliminar no existe.",
      });
    }

    const filtrados = items.filter((p) => p.id !== id);
    escribirPackaging(filtrados);

    return res.status(200).json({
      success: true,
      message: "Packaging eliminado exitosamente.",
    });
  } catch (error) {
    console.error("Error al eliminar packaging:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al eliminar packaging.",
    });
  }
};
