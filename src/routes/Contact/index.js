import express from "express";
import { sendMailHelper } from "../../helpers/emailHelper.js";

const router = express.Router();

router.post("/contact", async (req, res) => {
  try {
    // Llamamos al helper con los datos del body
    await sendMailHelper(req.body);
    
    // Respondemos al frontend
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error en el contacto:", error);
    res.status(500).json({ error: "Fallo en el servidor" });
  }
});

export default router;