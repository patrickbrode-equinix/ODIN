const express = require("express");
const router = express.Router();

/**
 * ONLYOFFICE CALLBACK (MINIMAL)
 * Wird beim Speichern aufgerufen
 */
router.post("/callback", (req, res) => {
  console.log("ONLYOFFICE CALLBACK:", req.body?.status);

  // status 2 = document saved
  return res.json({ error: 0 });
});

module.exports = router;
