import { useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { RoomLobby } from "./components/RoomLobby";
import { CollabEditor } from "./components/CollabEditor";
import { FileTree } from "./components/FileTree";
import { OutputPanel } from "./components/OutputPanel";
import { UserList } from "./components/UserList";
import { useCollabSession } from "./hooks/useCollabSession";
import type { AuthUser } from "./types";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

type Screen = "auth" | "lobby" | "editor";

function App() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(null);
  
  const [roomId, setRoomId] = useState("");
  const [roomPassword, setRoomPassword] = useState("");

  const session = useCollabSession(
    screen === "editor" ? roomId : "",
    screen === "editor" ? token : "",
    screen === "editor" ? roomPassword : ""
  );

  const activeFile = session.files.find((f) => f.id === session.activeFileId);
  const isHtml = activeFile?.language === "html";

  function handleAuth(t: string, u: AuthUser) {
    setToken(t);
    setUser(u);
    setScreen("lobby");
  }

  function handleLogout() {
    setToken("");
    setUser(null);
    setScreen("auth");
  }

  function handleJoinRoom(id: string, pwd?: string) {
    setRoomId(id);
    setRoomPassword(pwd || "");
    setScreen("editor");
  }

  function handleLeaveRoom() {
    setRoomId("");
    setRoomPassword("");
    setScreen("lobby");
  }

  function handleRun() {
    if (!activeFile) return;
    const text = session.getYText(activeFile.id)?.toString() || "";
    session.runCode(activeFile.language, text);
  }

  function handleDownload() {
    window.location.href = `${API_URL}/rooms/${roomId}/download?token=${token}`; // Assuming simple auth via token query for download or handle differently, actually we should use fetch and blob, let's just do window location for now with token if we add token to query, but for security fetch + blob is better. Let's do simple download link.
    // For now we'll do a basic fetch and trigger download
    fetch(`${API_URL}/rooms/${roomId}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => res.blob()).then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `collab-project-${roomId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  if (screen === "auth") {
    return <AuthScreen onAuth={handleAuth} />;
  }

  if (screen === "lobby") {
    return <RoomLobby token={token} onJoin={handleJoinRoom} onLogout={handleLogout} />;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>CodeCollab</h1>
        <div className="status">
          <span>{session.status === "connected" ? "Connected 🟢" : `Status: ${session.status} 🔴`}</span>
          <span>Room: {roomId}</span>
          <button onClick={handleDownload} className="run-button" style={{ marginLeft: 10, background: '#4ade80' }}>Download ZIP</button>
          <button onClick={handleLeaveRoom} className="run-button" style={{ marginLeft: 10 }}>Leave</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <FileTree
            files={session.files}
            activeFileId={session.activeFileId}
            onSelect={session.setActiveFileId}
            onCreate={session.createFile}
            onRename={session.renameFile}
            onDelete={session.deleteFile}
          />
          <UserList users={session.users} selfName={user?.displayName || "You"} selfColor={session.selfColor} />
        </aside>

        <section className="editor-container" style={{ display: 'flex', flexDirection: 'column' }}>
          {activeFile && (
            <div style={{ padding: 10, background: '#252526', display: 'flex', justifyContent: 'space-between' }}>
              <span>{activeFile.name}</span>
              <button 
                className="run-button"
                onClick={handleRun}
                disabled={session.running}
              >
                {isHtml ? "Preview HTML" : "Run Code"}
              </button>
            </div>
          )}
          
          <div style={{ flex: 1, position: 'relative' }}>
            {activeFile ? (
              <CollabEditor
                fileId={activeFile.id}
                language={activeFile.language}
                fileIds={session.files.map((f) => f.id)}
                awareness={session.awareness}
                getYText={session.getYText}
              />
            ) : (
              <div style={{ padding: 20 }}>No files open. Create one to start.</div>
            )}
          </div>
        </section>
      </main>

      <OutputPanel result={session.runResult} running={session.running} />
    </div>
  );
}

export default App;