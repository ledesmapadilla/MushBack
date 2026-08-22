import { Router } from "express";
import {
  listarIngredientes,
  crearIngrediente,
  actualizarIngrediente,
  eliminarIngrediente,
} from "../controllers/ingrediente.controller.js";

const router = Router();

router.get("/", listarIngredientes);
router.post("/", crearIngrediente);
router.put("/:id", actualizarIngrediente);
router.delete("/:id", eliminarIngrediente);

export default router;
