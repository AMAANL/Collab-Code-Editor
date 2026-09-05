import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

// All room documents are snapshotted here so work survives a server restart.
// This is a simple file-per-room store -- swap for a real database if you
// need multi-instance deployments.
const DATA_DIR = path.join(process.cwd(), "data", "rooms");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

function fileFor(roomId: string): string {
  // Keep room ids filesystem-safe regardless of what the client sends.
  const safeId = roomId.replace(/[^a-zA-Z0-9_-]/g, "_") || "_";
  return path.join(DATA_DIR, `${safeId}.bin`);
}

export function loadRoomSnapshot(roomId: string): Uint8Array | null {
  const file = fileFor(roomId);
  if (!existsSync(file)) return null;

  try {
    return new Uint8Array(readFileSync(file));
  } catch (err) {
    console.error(`Failed to load snapshot for room "${roomId}":`, err);
    return null;
  }
}

export function saveRoomSnapshot(roomId: string, update: Uint8Array): void {
  try {
    writeFileSync(fileFor(roomId), Buffer.from(update));
  } catch (err) {
    console.error(`Failed to save snapshot for room "${roomId}":`, err);
  }
}
