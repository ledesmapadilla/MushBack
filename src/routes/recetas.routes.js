import { Router } from "express";
import {
  listarRecetas,
  obtenerReceta,
  guardarRecetaBackend,
  eliminarReceta,
} from "../controllers/receta.controller.js";

const router = Router();

router.get("/", listarRecetas);
router.get("/:idOrSlug", obtenerReceta);
router.post("/", guardarRecetaBackend);
router.post("/:idOrSlug", guardarRecetaBackend);
router.put("/:idOrSlug", guardarRecetaBackend);
router.delete("/:idOrSlug", eliminarReceta);

export default router;
