/* ———————————————————————————————— */
/* FILE UPLOADS FOR HANDOVER (POSTGRES FINAL)       */
/* RBAC: page-based (view / write)                  */
/* ———————————————————————————————— */

import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import db from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requirePageAccess } from "../middleware/requirePageAccess.js";

const router = express.Router();

/* ———————————————————————————————— */
/* __DIRNAME FIX (ESM)                              */
/* ———————————————————————————————— */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ———————————————————————————————— */
/* HELPER                                          */
/* ———————————————————————————————— */

function safeId(id) {
  return String(id).replace(/[^0-9]/g, "");
}

/* ———————————————————————————————— */
/* MULTER STORAGE                                  */
/* ———————————————————————————————— */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const handoverId = safeId(req.params.id);
    const folder = path.join(
      __dirname,
      "..",
      "uploads",
      "handover",
      handoverId
    );

    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },

  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

/* ———————————————————————————————— */
/* POST – UPLOAD FILES                             */
/* Recht: handover:write                           */
/* ———————————————————————————————— */

router.post(
  "/:id/upload",
  requireAuth,
  requirePageAccess("handover", "write"),
  upload.array("files"),
  async (req, res) => {
    const handoverId = safeId(req.params.id);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    try {
      for (const file of req.files) {
        await db.query(
          `
          INSERT INTO handover_files
          (
            handover_id,
            filename
          )
          VALUES ($1, $2)
          `,
          [handoverId, file.originalname]
        );
      }

      res.json({
        success: true,
        files: req.files.map((f) => f.originalname),
      });
    } catch (err) {
      console.error("HANDOVER FILE UPLOAD ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ———————————————————————————————— */
/* GET – LIST FILES FOR HANDOVER                  */
/* Recht: handover:view                            */
/* ———————————————————————————————— */

router.get(
  "/:id/files",
  requireAuth,
  requirePageAccess("handover", "view"),
  async (req, res) => {
    const handoverId = safeId(req.params.id);

    try {
      const result = await db.query(
        `
        SELECT
          id,
          filename,
          uploaded_at AS "uploadedAt"
        FROM handover_files
        WHERE handover_id = $1
        ORDER BY uploaded_at DESC
        `,
        [handoverId]
      );

      const files = result.rows.map((f) => ({
        id: f.id,
        filename: f.filename,
        url: `/uploads/handover/${handoverId}/${f.filename}`,
        uploadedAt: f.uploadedAt,
      }));

      res.json(files);
    } catch (err) {
      console.error("HANDOVER FILE LIST ERROR:", err);
      res.json([]); // Handover & TV dürfen nie crashen
    }
  }
);

export default router;
