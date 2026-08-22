import { Router } from "express";
import {
  listarPersonal,
  crearPersonal,
  actualizarPersonal,
  eliminarPersonal,
} from "../controllers/personal.controller.js";

const router = Router();

router.get("/", listarPersonal);
router.post("/", crearPersonal);
router.put("/:id", actualizarPersonal);
router.delete("/:id", eliminarPersonal);

export default router;
