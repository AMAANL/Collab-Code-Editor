import * as awarenessProtocol from "y-protocols/awareness.js";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { loadRoomSnapshot, saveRoomSnapshot } from "./persistence.js";

export interface FileMeta {
  name: string;
  language: string;
}

export interface Room {
  id: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  // Maps each connected socket to the awareness clientIDs it owns, so we can
  // clean up presence state when that socket disconnects.
  clients: Map<WebSocket, Set<number>>;
  saveTimer: ReturnType<typeof setTimeout> | null;
}

type AwarenessChange = { added: number[]; updated: number[]; removed: number[] };

const SAVE_DEBOUNCE_MS = 2000;

const rooms = new Map<string, Room>();

function isSocket(value: unknown): value is WebSocket {
  return !!value && typeof value === "object" && "readyState" in value && "send" in value;
}

function createDefaultFile(doc: Y.Doc): void {
  const files = doc.getMap<Y.Text>("files");
  if (files.size > 0) return;

  const fileId = "main";
  files.set(fileId, new Y.Text('print("Hello, World!")\n'));
  doc.getMap<FileMeta>("fileMeta").set(fileId, { name: "main.py", language: "python" });
  doc.getArray<string>("fileOrder").push([fileId]);
}

function scheduleSave(room: Room): void {
  if (room.saveTimer) return;

  room.saveTimer = setTimeout(() => {
    room.saveTimer = null;
    saveRoomSnapshot(room.id, Y.encodeStateAsUpdate(room.doc));
  }, SAVE_DEBOUNCE_MS);
}

export function broadcast(room: Room, exclude: WebSocket | null, message: string): void {
  room.clients.forEach((_ownedIds, client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function getOrCreateRoom(roomId: string): Room {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const doc = new Y.Doc();
  const snapshot = loadRoomSnapshot(roomId);
  if (snapshot) {
    Y.applyUpdate(doc, snapshot);
  }
  createDefaultFile(doc);

  const awareness = new awarenessProtocol.Awareness(doc);

  const room: Room = { id: roomId, doc, awareness, clients: new Map(), saveTimer: null };
  rooms.set(roomId, room);

  // Every change to the document -- whether it came from a client edit or a
  // server-side action like creating a file -- flows through here, so this
  // is the single place that broadcasts doc updates and schedules a save.
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    scheduleSave(room);
    const originSocket = isSocket(origin) ? origin : null;
    broadcast(room, originSocket, JSON.stringify({ type: "yjs-update", update: Array.from(update) }));
  });

  // Same pattern for presence/cursor state. When the change came from a
  // client's socket, also remember which clientIDs that socket owns, so we
  // can clear its presence when the socket disconnects.
  awareness.on("update", (change: AwarenessChange, origin: unknown) => {
    const changedIds = [...change.added, ...change.updated, ...change.removed];
    if (changedIds.length === 0) return;

    const originSocket = isSocket(origin) ? origin : null;

    if (originSocket) {
      const owned = room.clients.get(originSocket);
      if (owned) {
        change.added.forEach((id) => owned.add(id));
        change.updated.forEach((id) => owned.add(id));
      }
    }

    const encoded = awarenessProtocol.encodeAwarenessUpdate(awareness, changedIds);
    broadcast(
      room,
      originSocket,
      JSON.stringify({ type: "awareness-update", update: Array.from(encoded) })
    );
  });

  return room;
}

export function joinRoom(roomId: string, socket: WebSocket): Room {
  const room = getOrCreateRoom(roomId);
  room.clients.set(socket, new Set());
  return room;
}

export function leaveRoom(room: Room, socket: WebSocket): void {
  const ownedClientIds = room.clients.get(socket);
  room.clients.delete(socket);

  if (ownedClientIds && ownedClientIds.size > 0) {
    awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(ownedClientIds), "server");
  }

  if (room.clients.size === 0) {
    if (room.saveTimer) clearTimeout(room.saveTimer);
    saveRoomSnapshot(room.id, Y.encodeStateAsUpdate(room.doc));
    room.doc.destroy();
    rooms.delete(room.id);
  }
}
