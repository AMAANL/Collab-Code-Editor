import cors from "cors";
import express from "express";
import { createServer } from "http";
import * as awarenessProtocol from "y-protocols/awareness.js";
import { WebSocket, WebSocketServer } from "ws";
import * as Y from "yjs";
import { runCode, SUPPORTED_LANGUAGES } from "./CodeRunner.js";
import { FileMeta, getOrCreateRoom, joinRoom, leaveRoom, Room } from "./roomManager.js";
import { authRouter } from "./auth.js";
import { roomsRouter } from "./rooms.js";
import { db } from "./database.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { AuthUser } from "./auth.js";
import { randomUUID } from "crypto";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-collab-key";

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Collab Code Editor backend is running!" });
});

app.use("/api/auth", authRouter);
app.use("/api/rooms", roomsRouter);

app.get("/api/languages", (_req, res) => {
  res.json({ languages: SUPPORTED_LANGUAGES });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

interface SocketState {
  roomId: string | null;
  user: AuthUser | null;
  color: string;
}

const USER_COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#22d3ee", "#818cf8", "#e879ad", "#a78bfa"];
const randomColor = () => USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

function send(socket: WebSocket, data: unknown): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function requireRoom(socket: WebSocket, state: SocketState): Room | null {
  if (!state.roomId) {
    send(socket, { type: "error", message: "Join a room first" });
    return null;
  }
  return getOrCreateRoom(state.roomId);
}

wss.on("connection", (socket: WebSocket) => {
  const state: SocketState = { roomId: null, user: null, color: randomColor() };

  socket.on("message", async (raw) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      send(socket, { type: "error", message: "Invalid message format" });
      return;
    }

    try {
      switch (data.type) {
        case "auth": {
          const token = String(data.token ?? "");
          try {
            const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
            state.user = decoded;
            send(socket, { type: "auth-success" });
          } catch (e) {
            send(socket, { type: "auth-error", message: "Invalid token" });
            socket.close();
          }
          return;
        }

        case "join-room": {
          if (!state.user) {
            send(socket, { type: "error", message: "Authentication required" });
            return;
          }

          if (state.roomId) {
            leaveRoom(getOrCreateRoom(state.roomId), socket);
          }

          const roomId = String(data.roomId ?? "").trim();
          const password = String(data.password ?? "");
          
          if (!roomId) {
            send(socket, { type: "error", message: "Room ID is required" });
            return;
          }

          // Verify password
          const stmt = db.prepare("SELECT * FROM rooms WHERE id = ?");
          const roomDb = stmt.get(roomId) as any;

          if (roomDb && roomDb.password_hash) {
            const match = await bcrypt.compare(password, roomDb.password_hash);
            if (!match) {
              send(socket, { type: "error", code: "WRONG_PASSWORD", message: "Incorrect room password" });
              return;
            }
          } else if (!roomDb) {
            // Room doesn't exist in DB, maybe they are just joining an ephemeral one for dev
            // If strictly enforcing, we could reject here. But for now we allow ephemeral fallback.
          }

          state.roomId = roomId;

          const room = joinRoom(roomId, socket);

          send(socket, { type: "sync", update: Array.from(Y.encodeStateAsUpdate(room.doc)) });

          const existingClientIds = Array.from(room.awareness.getStates().keys());
          if (existingClientIds.length > 0) {
            send(socket, {
              type: "awareness-update",
              update: Array.from(awarenessProtocol.encodeAwarenessUpdate(room.awareness, existingClientIds)),
            });
          }

          const meta = room.doc.getMap<FileMeta>("fileMeta");
          const order = room.doc.getArray<string>("fileOrder");

          send(socket, {
            type: "room-joined",
            roomId,
            userName: state.user.displayName,
            color: state.color,
            files: order.toArray().map((id) => ({ id, ...meta.get(id) })),
          });

          console.log(`"${state.user.displayName}" joined room "${roomId}"`);
          return;
        }

        case "yjs-update": {
          const room = requireRoom(socket, state);
          if (!room) return;
          const update = new Uint8Array(data.update as number[]);
          Y.applyUpdate(room.doc, update, socket);
          return;
        }

        case "awareness-update": {
          const room = requireRoom(socket, state);
          if (!room) return;
          const update = new Uint8Array(data.update as number[]);
          awarenessProtocol.applyAwarenessUpdate(room.awareness, update, socket);
          return;
        }

        case "create-file": {
          const room = requireRoom(socket, state);
          if (!room) return;
          const fileId = randomUUID().slice(0, 8);
          const name = String(data.name ?? "untitled.txt").slice(0, 80);
          const language = String(data.language ?? "plaintext");

          room.doc.transact(() => {
            room.doc.getMap<Y.Text>("files").set(fileId, new Y.Text(""));
            room.doc.getMap<FileMeta>("fileMeta").set(fileId, { name, language });
            room.doc.getArray<string>("fileOrder").push([fileId]);
          }, "server");

          send(socket, { type: "file-created", fileId });
          return;
        }

        case "rename-file": {
          const room = requireRoom(socket, state);
          if (!room) return;
          const fileId = String(data.fileId ?? "");
          const meta = room.doc.getMap<FileMeta>("fileMeta");
          const current = meta.get(fileId);
          if (current) {
            meta.set(fileId, { ...current, name: String(data.name ?? current.name).slice(0, 80) });
          }
          return;
        }

        case "delete-file": {
          const room = requireRoom(socket, state);
          if (!room) return;
          const fileId = String(data.fileId ?? "");
          const order = room.doc.getArray<string>("fileOrder");

          if (order.length <= 1) {
            send(socket, { type: "error", message: "Can't delete the only remaining file" });
            return;
          }

          room.doc.transact(() => {
            room.doc.getMap<Y.Text>("files").delete(fileId);
            room.doc.getMap<FileMeta>("fileMeta").delete(fileId);
            const idx = order.toArray().indexOf(fileId);
            if (idx !== -1) order.delete(idx, 1);
          }, "server");
          return;
        }

        case "run-code": {
          const language = String(data.language ?? "");
          const code = String(data.code ?? "");
          const result = await runCode(language, code);
          send(socket, { type: "run-result", ...result });
          return;
        }

        default:
          send(socket, { type: "error", message: `Unknown message type: ${String(data.type)}` });
      }
    } catch (err) {
      console.error("Error handling message:", err);
      send(socket, { type: "error", message: "Server error handling message" });
    }
  });

  socket.on("close", () => {
    if (state.roomId) {
      leaveRoom(getOrCreateRoom(state.roomId), socket);
      console.log(`"${state.user?.displayName || 'Unknown'}" left room "${state.roomId}"`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`WebSocket running on ws://localhost:${PORT}`);
});
