import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../data/ingredientes.json");

const UNIDADES_VALIDAS = ["kg", "gr", "lts", "ml", "un", "otras"];

// Asegurar que exista el directorio y archivo de datos
const asegurarArchivo = () => {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
  }
};

const leerIngredientes = () => {
  asegurarArchivo();
  try {
    const data = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch (error) {
    console.error("Error leyendo ingredientes:", error);
    return [];
  }
};

const escribirIngredientes = (ingredientes) => {
  asegurarArchivo();
  fs.writeFileSync(DATA_FILE, JSON.stringify(ingredientes, null, 2), "utf-8");
};

// Función para singularizar palabras en español
const singularizarPalabra = (palabra) => {
  if (!palabra || palabra.length <= 3) return palabra;

  // Terminaciones en -ces -> -z (ej: nueces -> nuez, peces -> pez)
  if (palabra.endsWith("ces")) {
    return palabra.slice(0, -3) + "z";
  }

  // Terminaciones en consonante + es (ej: limones -> limon, alfajores -> alfajor)
  if (palabra.endsWith("es")) {
    const sinEs = palabra.slice(0, -2);
    if (/[rlnzd]$/.test(sinEs)) {
      return sinEs;
    }
    return palabra.slice(0, -1); // ej: chocolates -> chocolate
  }

  // Terminaciones en vocal + s (ej: huevos -> huevo, frutillas -> frutilla, almendras -> almendra)
  if (palabra.endsWith("s") && !palabra.endsWith("ss")) {
    return palabra.slice(0, -1);
  }

  return palabra;
};

// Normalización completa: minúsculas, sin tildes, sin ningún espacio (inicio, fin e intermedios), singularizada
export const normalizarNombreIngrediente = (texto) => {
  if (!texto || typeof texto !== "string") return "";
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quita tildes
    .replace(/[^a-z0-9\s]/g, " ") // Caracteres no alfanuméricos a espacios
    .trim()
    .split(/\s+/) // Separa por cualquier cantidad de espacios
    .filter(Boolean)
    .map(singularizarPalabra) // Pasa cada palabra a singular
    .join("") // Une SIN NINGÚN ESPACIO (ignora espacios al inicio, al medio y al final)
    .replace(/\s+/g, "");
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

// Función de Validación Backend
const validarIngredienteBackend = (datos, ingredientesExistentes, idExcluir = null) => {
  const errores = [];

  // Validar nombre
  if (!datos.nombre || typeof datos.nombre !== "string" || !datos.nombre.trim()) {
    errores.push("El nombre del ingrediente es obligatorio.");
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

    const ingredienteDuplicado = ingredientesExistentes.find(
      (item) =>
        item.id !== idExcluir &&
        normalizarNombreIngrediente(item.nombre) === canonicoNuevo
    );

    if (ingredienteDuplicado) {
      errores.push(
        `Ya existe un ingrediente registrado como "${ingredienteDuplicado.nombre}" (coincide en singular/plural).`
      );
    }
  }

  // Validar unidad
  if (!datos.unidad || typeof datos.unidad !== "string") {
    errores.push("La unidad de medida es obligatoria.");
  } else if (!UNIDADES_VALIDAS.includes(datos.unidad.toLowerCase().trim())) {
    errores.push(
      `La unidad "${datos.unidad}" no es válida. Opciones permitidas: ${UNIDADES_VALIDAS.join(", ")}.`
    );
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
export const listarIngredientes = (req, res) => {
  try {
    const ingredientes = leerIngredientes();
    return res.status(200).json({
      success: true,
      total: ingredientes.length,
      data: ingredientes,
    });
  } catch (error) {
    console.error("Error al listar ingredientes:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al obtener ingredientes.",
    });
  }
};

export const crearIngrediente = (req, res) => {
  try {
    const {
      nombre,
      unidad,
      observaciones,
      stock,
      minimo,
      precio,
      fechaPrecio,
      observacionesPrecio,
      historialPrecios,
      proveedor,
      categoria,
      id: customId,
    } = req.body;
    const ingredientes = leerIngredientes();

    // Validaciones estrictas en Backend
    const errores = validarIngredienteBackend({ nombre, unidad, observaciones }, ingredientes);
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
      id = `${baseSlug}_${randomSuffix}`;
    }

    const nuevoIngrediente = {
      id,
      nombre: nombre.trim(),
      unidad: unidad.toLowerCase().trim(),
      observaciones: observaciones ? observaciones.trim() : "",
      stock: stock !== undefined ? Number(stock) : 0,
      minimo: minimo !== undefined ? Number(minimo) : 0,
      precio: precio !== undefined ? Number(precio) : 0,
      fechaPrecio: fechaPrecio || "",
      observacionesPrecio: observacionesPrecio ? observacionesPrecio.trim() : "",
      historialPrecios: normalizarHistorial(historialPrecios),
      proveedor: proveedor ? proveedor.trim() : "",
      categoria: categoria ? categoria.trim() : "Secos",
      creadoEn: new Date().toISOString(),
    };

    ingredientes.push(nuevoIngrediente);
    escribirIngredientes(ingredientes);

    return res.status(201).json({
      success: true,
      message: `Ingrediente "${nuevoIngrediente.nombre}" registrado exitosamente.`,
      data: nuevoIngrediente,
    });
  } catch (error) {
    console.error("Error al crear ingrediente:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al guardar ingrediente.",
    });
  }
};

export const actualizarIngrediente = (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      unidad,
      observaciones,
      stock,
      minimo,
      precio,
      fechaPrecio,
      observacionesPrecio,
      historialPrecios,
      proveedor,
      categoria,
    } = req.body;
    const ingredientes = leerIngredientes();

    const index = ingredientes.findIndex((i) => i.id === id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "El ingrediente solicitado no existe.",
      });
    }

    // Validaciones estrictas en Backend si se actualiza el nombre o unidad
    if (nombre || unidad) {
      const nombreValidar = nombre || ingredientes[index].nombre;
      const unidadValidar = unidad || ingredientes[index].unidad;
      const errores = validarIngredienteBackend(
        { nombre: nombreValidar, unidad: unidadValidar, observaciones },
        ingredientes,
        id
      );
      if (errores.length > 0) {
        return res.status(400).json({
          success: false,
          message: errores[0],
          errores,
        });
      }
    }

    const ingredienteActualizado = {
      ...ingredientes[index],
      ...(nombre && { nombre: nombre.trim() }),
      ...(unidad && { unidad: unidad.toLowerCase().trim() }),
      ...(observaciones !== undefined && { observaciones: observaciones ? observaciones.trim() : "" }),
      ...(stock !== undefined && { stock: Number(stock) }),
      ...(minimo !== undefined && { minimo: Number(minimo) }),
      ...(precio !== undefined && { precio: Number(precio) }),
      ...(fechaPrecio !== undefined && { fechaPrecio: fechaPrecio || "" }),
      ...(observacionesPrecio !== undefined && {
        observacionesPrecio: observacionesPrecio ? observacionesPrecio.trim() : "",
      }),
      ...(historialPrecios !== undefined && {
        historialPrecios: normalizarHistorial(historialPrecios),
      }),
      ...(proveedor !== undefined && { proveedor: proveedor.trim() }),
      ...(categoria !== undefined && { categoria: categoria.trim() }),
      actualizadoEn: new Date().toISOString(),
    };

    ingredientes[index] = ingredienteActualizado;
    escribirIngredientes(ingredientes);

    return res.status(200).json({
      success: true,
      message: `Ingrediente "${ingredienteActualizado.nombre}" actualizado exitosamente.`,
      data: ingredienteActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar ingrediente:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al actualizar ingrediente.",
    });
  }
};

export const eliminarIngrediente = (req, res) => {
  try {
    const { id } = req.params;
    const ingredientes = leerIngredientes();

    const existe = ingredientes.some((i) => i.id === id);
    if (!existe) {
      return res.status(404).json({
        success: false,
        message: "El ingrediente a eliminar no existe.",
      });
    }

    const filtrados = ingredientes.filter((i) => i.id !== id);
    escribirIngredientes(filtrados);

    return res.status(200).json({
      success: true,
      message: "Ingrediente eliminado exitosamente.",
    });
  } catch (error) {
    console.error("Error al eliminar ingrediente:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al eliminar ingrediente.",
    });
  }
};
