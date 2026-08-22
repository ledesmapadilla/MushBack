import { Router } from "express";
import ingredientesRoutes from "./ingredientes.routes.js";
import alfajoresRoutes from "./alfajores.routes.js";
import packagingRoutes from "./packaging.routes.js";
import recetasRoutes from "./recetas.routes.js";
import personalRoutes from "./personal.routes.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "API MUSH funcionando correctamente" });
});

router.use("/ingredientes", ingredientesRoutes);
router.use("/alfajores", alfajoresRoutes);
router.use("/packaging", packagingRoutes);
router.use("/recetas", recetasRoutes);
router.use("/personal", personalRoutes);

export default router;
