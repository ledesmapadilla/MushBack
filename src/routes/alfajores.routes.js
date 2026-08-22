import { Router } from "express";
import {
  listarAlfajores,
  crearAlfajor,
  actualizarAlfajor,
  eliminarAlfajor,
} from "../controllers/alfajor.controller.js";

const router = Router();

router.get("/", listarAlfajores);
router.post("/", crearAlfajor);
router.put("/:id", actualizarAlfajor);
router.delete("/:id", eliminarAlfajor);

export default router;
