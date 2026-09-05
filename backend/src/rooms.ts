import express from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "./database.js";
import { requireAuth } from "./auth.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");
import { getOrCreateRoom } from "./roomManager.js";
import type { FileMeta } from "./roomManager.js";
import * as Y from "yjs";

export const roomsRouter = express.Router();

// Create room
roomsRouter.post("/", requireAuth, async (req, res) => {
  const { password } = req.body;
  const user = (req as any).user;
  
  try {
    const roomId = randomUUID().slice(0, 8);
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    
    const stmt = db.prepare("INSERT INTO rooms (id, password_hash, creator_id) VALUES (?, ?, ?)");
    stmt.run(roomId, passwordHash, user.id);

    res.status(201).json({ roomId });
  } catch (err) {
    console.error("Create room error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Download project ZIP
roomsRouter.get("/:id/download", requireAuth, (req, res) => {
  const { id } = req.params;
  
  // Here we assume the user is authorized to download if they know the room ID
  // In a stricter app we would check if they joined the room.
  
  const room = getOrCreateRoom(id); // gets current state from memory/snapshot
  const filesMap = room.doc.getMap<Y.Text>("files");
  const metaMap = room.doc.getMap<FileMeta>("fileMeta");
  
  const archive = archiver("zip", {
    zlib: { level: 9 }
  });
  
  res.attachment(`collab-project-${id}.zip`);
  archive.pipe(res);
  
  for (const [fileId, ytext] of filesMap.entries()) {
    const meta = metaMap.get(fileId);
    if (meta) {
      archive.append(ytext.toString(), { name: meta.name });
    }
  }
  
  archive.finalize();
});
