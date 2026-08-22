import { Router } from "express";
import {
  listarPackaging,
  crearPackaging,
  actualizarPackaging,
  eliminarPackaging,
} from "../controllers/packaging.controller.js";

const router = Router();

router.get("/", listarPackaging);
router.post("/", crearPackaging);
router.put("/:id", actualizarPackaging);
router.delete("/:id", eliminarPackaging);

export default router;
