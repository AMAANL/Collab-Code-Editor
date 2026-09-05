import { useCallback, useEffect, useRef, useState } from "react";
import * as awarenessProtocol from "y-protocols/awareness.js";
import * as Y from "yjs";
import type { ConnectionStatus, FileEntry, FileMeta, RunResult } from "../types";

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) || "ws://localhost:3000";
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;
const REMOTE_ORIGIN = "remote";

export function useCollabSession(roomId: string, token: string, password?: string) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [joined, setJoined] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [users, setUsers] = useState<{ clientId: number; name: string; color: string }[]>([]);
  const [selfColor, setSelfColor] = useState("#4ade80");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [awarenessInstance, setAwarenessInstance] = useState<awarenessProtocol.Awareness | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounting = useRef(false);
  const runResolver = useRef<((result: RunResult) => void) | null>(null);

  const syncFilesFromDoc = useCallback(() => {
    const doc = docRef.current;
    if (!doc) return;

    const order = doc.getArray<string>("fileOrder");
    const meta = doc.getMap<FileMeta>("fileMeta");

    setFiles(
      order.toArray().map((id) => {
        const m = meta.get(id) ?? { name: id, language: "plaintext" };
        return { id, ...m };
      })
    );
  }, []);

  useEffect(() => {
    if (!roomId || !token) return;

    unmounting.current = false;
    reconnectAttempt.current = 0;

    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    docRef.current = doc;
    setAwarenessInstance(awareness);

    const syncUsersFromAwareness = () => {
      const list: { clientId: number; name: string; color: string }[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === doc.clientID) return;
        const user = (state as { user?: { name: string; color: string } }).user;
        if (user) list.push({ clientId, ...user });
      });
      setUsers(list);
    };

    doc.on("update", syncFilesFromDoc);
    awareness.on("change", syncUsersFromAwareness);

    function connect() {
      setStatus(reconnectAttempt.current === 0 ? "connecting" : "reconnecting");

      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttempt.current = 0;
        setStatus("connected");
        // Authenticate first
        socket.send(JSON.stringify({ type: "auth", token }));
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (data.type) {
          case "auth-success": {
             // Now join room
             socket.send(JSON.stringify({ type: "join-room", roomId, password }));
             break;
          }
          case "room-joined": {
            setJoined(true);
            const color = data.color as string;
            setSelfColor(color);
            awareness.setLocalStateField("user", { name: data.userName as string, color });
            break;
          }
          case "sync": {
            Y.applyUpdate(doc, new Uint8Array(data.update as number[]), REMOTE_ORIGIN);
            syncFilesFromDoc();
            break;
          }
          case "yjs-update": {
            Y.applyUpdate(doc, new Uint8Array(data.update as number[]), REMOTE_ORIGIN);
            break;
          }
          case "awareness-update": {
            awarenessProtocol.applyAwarenessUpdate(
              awareness,
              new Uint8Array(data.update as number[]),
              REMOTE_ORIGIN
            );
            break;
          }
          case "file-created": {
            setActiveFileId(data.fileId as string);
            break;
          }
          case "run-result": {
            const result: RunResult = {
              stdout: data.stdout as string,
              stderr: data.stderr as string,
              exitCode: data.exitCode as number | null,
              timedOut: Boolean(data.timedOut),
              isHtml: Boolean(data.isHtml)
            };
            setRunning(false);
            setRunResult(result);
            runResolver.current?.(result);
            runResolver.current = null;
            break;
          }
          case "error": {
            if (data.code === "WRONG_PASSWORD") {
               setStatus("wrong_password");
               socket.close();
            } else {
               console.error("Server error:", data.message);
            }
            break;
          }
        }
      };

      socket.onclose = () => {
        if (status !== "wrong_password") setStatus("disconnected");
        setJoined(false);
        awareness.setLocalState(null);

        if (!unmounting.current && status !== "wrong_password") {
          const delay = Math.min(
            RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt.current,
            RECONNECT_MAX_DELAY_MS
          );
          reconnectAttempt.current += 1;
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };

      socket.onerror = () => socket.close();
    }

    connect();

    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return;
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "yjs-update", update: Array.from(update) }));
      }
    };
    doc.on("update", onDocUpdate);

    const onAwarenessUpdate = (
      change: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      if (origin === REMOTE_ORIGIN) return;
      const changedIds = [...change.added, ...change.updated, ...change.removed];
      const socket = socketRef.current;
      if (changedIds.length > 0 && socket?.readyState === WebSocket.OPEN) {
        const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedIds);
        socket.send(JSON.stringify({ type: "awareness-update", update: Array.from(update) }));
      }
    };
    awareness.on("update", onAwarenessUpdate);

    return () => {
      unmounting.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);

      doc.off("update", onDocUpdate);
      doc.off("update", syncFilesFromDoc);
      awareness.off("update", onAwarenessUpdate);
      awareness.off("change", syncUsersFromAwareness);

      socketRef.current?.close();
      socketRef.current = null;

      awareness.destroy();
      doc.destroy();
      docRef.current = null;
      setAwarenessInstance(null);
    };
  }, [roomId, token, password, syncFilesFromDoc]);

  useEffect(() => {
    if (!activeFileId && files.length > 0) {
      setActiveFileId(files[0].id);
    } else if (activeFileId && files.length > 0 && !files.some((f) => f.id === activeFileId)) {
      setActiveFileId(files[0].id);
    }
  }, [files, activeFileId]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  const createFile = useCallback(
    (name: string, language: string) => sendMessage({ type: "create-file", name, language }),
    [sendMessage]
  );

  const renameFile = useCallback(
    (fileId: string, name: string) => sendMessage({ type: "rename-file", fileId, name }),
    [sendMessage]
  );

  const deleteFile = useCallback(
    (fileId: string) => sendMessage({ type: "delete-file", fileId }),
    [sendMessage]
  );

  const runCode = useCallback(
    (language: string, code: string) => {
      setRunning(true);
      setRunResult(null);
      sendMessage({ type: "run-code", language, code });
      return new Promise<RunResult>((resolve) => {
        runResolver.current = resolve;
      });
    },
    [sendMessage]
  );

  const getYText = useCallback((fileId: string): Y.Text | null => {
    return docRef.current?.getMap<Y.Text>("files").get(fileId) ?? null;
  }, []);

  return {
    status,
    joined,
    files,
    activeFileId,
    setActiveFileId,
    users,
    selfColor,
    runResult,
    running,
    awareness: awarenessInstance,
    createFile,
    renameFile,
    deleteFile,
    runCode,
    getYText,
  };
}
