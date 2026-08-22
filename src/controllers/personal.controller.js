import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizarNombreIngrediente } from "./ingrediente.controller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../data/personal.json");

const asegurarArchivo = () => {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
  }
};

const leerPersonal = () => {
  asegurarArchivo();
  try {
    let data = fs.readFileSync(DATA_FILE, "utf-8");
    if (data && data.charCodeAt(0) === 0xfeff) data = data.slice(1);
    return JSON.parse(data || "[]");
  } catch (error) {
    console.error("Error leyendo personal:", error);
    return [];
  }
};

const escribirPersonal = (items) => {
  asegurarArchivo();
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
};

// El sueldo mensual se guarda como historial [{ valor, fecha }]: cada cambio
// aplicado desde "Editar" agrega una entrada, no pisa la anterior.
const normalizarHistorial = (mensual) => {
  if (!Array.isArray(mensual)) return [];
  return mensual
    .map((item) => ({
      valor: Number(item?.valor) || 0,
      fecha: item?.fecha || "",
    }))
    .filter((item) => item.valor > 0)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
};

const validarPersonalBackend = (datos, existentes, idExcluir = null) => {
  const errores = [];

  if (!datos.nombre || typeof datos.nombre !== "string" || !datos.nombre.trim()) {
    errores.push("El nombre del personal es obligatorio.");
  } else {
    const nombreLimpio = datos.nombre.trim();
    if (nombreLimpio.length < 2) {
      errores.push("El nombre debe tener al menos 2 caracteres.");
    }
    if (nombreLimpio.length > 70) {
      errores.push("El nombre no puede superar los 70 caracteres.");
    }

    const canonico = normalizarNombreIngrediente(nombreLimpio);
    const duplicado = existentes.find(
      (item) => item.id !== idExcluir && normalizarNombreIngrediente(item.nombre) === canonico
    );
    if (duplicado) {
      errores.push(`Ya existe personal registrado como "${duplicado.nombre}".`);
    }
  }

  if (datos.jornalesPorSemana !== undefined && Number(datos.jornalesPorSemana) <= 0) {
    errores.push("La cantidad de jornales por semana debe ser mayor a 0.");
  }

  if (datos.horasPorDia !== undefined && Number(datos.horasPorDia) <= 0) {
    errores.push("La cantidad de horas por día debe ser mayor a 0.");
  }

  if (datos.observaciones && typeof datos.observaciones === "string") {
    if (datos.observaciones.length > 250) {
      errores.push("Las observaciones no pueden superar los 250 caracteres.");
    }
  }

  return errores;
};

export const listarPersonal = (req, res) => {
  try {
    const items = leerPersonal();
    return res.status(200).json({ success: true, total: items.length, data: items });
  } catch (error) {
    console.error("Error al listar personal:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al obtener personal.",
    });
  }
};

export const crearPersonal = (req, res) => {
  try {
    const { nombre, fechaAlta, jornalesPorSemana, horasPorDia, observaciones, mensual, id: customId } = req.body;
    const items = leerPersonal();

    const errores = validarPersonalBackend(
      { nombre, jornalesPorSemana, horasPorDia, observaciones },
      items
    );
    if (errores.length > 0) {
      return res.status(400).json({ success: false, message: errores[0], errores });
    }

    let id = customId;
    if (!id) {
      const baseSlug = nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 20);
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      id = `per_${baseSlug}_${randomSuffix}`;
    }

    const nuevo = {
      id,
      nombre: nombre.trim(),
      fechaAlta: fechaAlta || new Date().toISOString().split("T")[0],
      jornalesPorSemana: Number(jornalesPorSemana) || 0,
      horasPorDia: Number(horasPorDia) || 0,
      observaciones: observaciones ? observaciones.trim() : "",
      mensual: normalizarHistorial(mensual),
      creadoEn: new Date().toISOString(),
    };

    items.push(nuevo);
    escribirPersonal(items);

    return res.status(201).json({
      success: true,
      message: `Personal "${nuevo.nombre}" registrado exitosamente.`,
      data: nuevo,
    });
  } catch (error) {
    console.error("Error al crear personal:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al guardar personal.",
    });
  }
};

export const actualizarPersonal = (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, fechaAlta, jornalesPorSemana, horasPorDia, observaciones, mensual } = req.body;
    const items = leerPersonal();

    const index = items.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "El personal solicitado no existe.",
      });
    }

    const errores = validarPersonalBackend(
      { nombre, jornalesPorSemana, horasPorDia, observaciones },
      items,
      id
    );
    if (errores.length > 0) {
      return res.status(400).json({ success: false, message: errores[0], errores });
    }

    const actualizado = {
      ...items[index],
      nombre: nombre.trim(),
      ...(fechaAlta !== undefined && { fechaAlta }),
      ...(jornalesPorSemana !== undefined && { jornalesPorSemana: Number(jornalesPorSemana) || 0 }),
      ...(horasPorDia !== undefined && { horasPorDia: Number(horasPorDia) || 0 }),
      ...(observaciones !== undefined && { observaciones: observaciones ? observaciones.trim() : "" }),
      ...(mensual !== undefined && { mensual: normalizarHistorial(mensual) }),
      actualizadoEn: new Date().toISOString(),
    };

    items[index] = actualizado;
    escribirPersonal(items);

    return res.status(200).json({
      success: true,
      message: `Personal "${actualizado.nombre}" actualizado exitosamente.`,
      data: actualizado,
    });
  } catch (error) {
    console.error("Error al actualizar personal:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al actualizar personal.",
    });
  }
};

export const eliminarPersonal = (req, res) => {
  try {
    const { id } = req.params;
    const items = leerPersonal();

    const existe = items.some((p) => p.id === id);
    if (!existe) {
      return res.status(404).json({
        success: false,
        message: "El personal a eliminar no existe.",
      });
    }

    escribirPersonal(items.filter((p) => p.id !== id));

    return res.status(200).json({ success: true, message: "Personal eliminado exitosamente." });
  } catch (error) {
    console.error("Error al eliminar personal:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al eliminar personal.",
    });
  }
};
