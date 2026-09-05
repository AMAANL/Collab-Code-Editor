export interface FileMeta {
  name: string;
  language: string;
}

export interface FileEntry extends FileMeta {
  id: string;
}

export interface RemoteUser {
  clientId: number;
  name: string;
  color: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  isHtml?: boolean;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "wrong_password";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}
