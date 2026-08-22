import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../data/recetas.json");

const asegurarArchivo = () => {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
  }
};

const leerRecetas = () => {
  asegurarArchivo();
  try {
    let data = fs.readFileSync(DATA_FILE, "utf-8");
    if (data && data.charCodeAt(0) === 0xFEFF) {
      data = data.slice(1);
    }
    return JSON.parse(data || "[]");
  } catch (error) {
    console.error("Error leyendo recetas:", error);
    return [];
  }
};

const escribirRecetas = (recetas) => {
  asegurarArchivo();
  fs.writeFileSync(DATA_FILE, JSON.stringify(recetas, null, 2), "utf-8");
};

export const listarRecetas = (req, res) => {
  try {
    const items = leerRecetas();
    return res.status(200).json({
      success: true,
      total: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Error al listar recetas:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al obtener recetas.",
    });
  }
};

export const obtenerReceta = (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const items = leerRecetas();
    const cleanParam = (idOrSlug || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const receta = items.find((r) => {
      const rId = (r.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const rSlug = (r.slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const rNom = (r.nombre || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return rId === cleanParam || rSlug === cleanParam || rNom === cleanParam;
    });

    if (!receta) {
      return res.status(404).json({
        success: false,
        message: "Receta no encontrada.",
      });
    }

    return res.status(200).json({
      success: true,
      data: receta,
    });
  } catch (error) {
    console.error("Error al obtener receta:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al buscar receta.",
    });
  }
};

export const guardarRecetaBackend = (req, res) => {
  try {
    const datos = req.body;
    const items = leerRecetas();

    const id = datos.id || datos.slug || (datos.nombre ? datos.nombre.toLowerCase().replace(/[^a-z0-9]/g, "-") : `rec_${Date.now()}`);
    const slug = datos.slug || (datos.nombre ? datos.nombre.toLowerCase().replace(/[^a-z0-9]/g, "-") : id);

    const cleanParam = id.toLowerCase().replace(/[^a-z0-9]/g, "");
    const index = items.findIndex((r) => {
      const rId = (r.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const rSlug = (r.slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return rId === cleanParam || rSlug === cleanParam;
    });

    const existente = index !== -1 ? items[index] : {};

    const recetaGuardada = {
      ...existente,
      id,
      slug,
      nombre: datos.nombre || existente.nombre || "Receta",
      categoria: datos.categoria || existente.categoria || "Alfajor",
      rinde: Number(datos.rinde) || existente.rinde || 60,
      observaciones: datos.observaciones !== undefined ? datos.observaciones : (existente.observaciones || ""),
      // Un guardado parcial NO debe borrar lo que no vino en el pedido.
      ingredientes: Array.isArray(datos.ingredientes)
        ? datos.ingredientes
        : (existente.ingredientes || []),
      // Gramos anotados por seccion (por ejemplo la pasta y el praline de
      // pistacho). Es un objeto {seccionId: numero}.
      gramos:
        datos.gramos && typeof datos.gramos === "object"
          ? datos.gramos
          : (existente.gramos || {}),
      // Valor unico de mano de obra de la receta (no es una lista)
      manoDeObra:
        datos.manoDeObra && typeof datos.manoDeObra === "object"
          ? datos.manoDeObra
          : (existente.manoDeObra || {}),
      actualizadoEn: new Date().toISOString(),
    };

    if (index !== -1) {
      items[index] = { ...items[index], ...recetaGuardada };
    } else {
      recetaGuardada.creadoEn = new Date().toISOString();
      items.push(recetaGuardada);
    }

    escribirRecetas(items);

    return res.status(200).json({
      success: true,
      message: `Receta "${recetaGuardada.nombre}" guardada exitosamente.`,
      data: recetaGuardada,
    });
  } catch (error) {
    console.error("Error al guardar receta:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al guardar la receta.",
    });
  }
};

export const eliminarReceta = (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const cleanParam = (idOrSlug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const items = leerRecetas();

    const filtrados = items.filter((r) => {
      const rId = (r.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const rSlug = (r.slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return rId !== cleanParam && rSlug !== cleanParam;
    });

    if (filtrados.length === items.length) {
      return res.status(404).json({
        success: false,
        message: "Receta a eliminar no encontrada.",
      });
    }

    escribirRecetas(filtrados);
    return res.status(200).json({
      success: true,
      message: "Receta eliminada correctamente.",
    });
  } catch (error) {
    console.error("Error al eliminar receta:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno al eliminar receta.",
    });
  }
};
