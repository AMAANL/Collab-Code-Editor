import { useState, type FormEvent } from "react";

interface Props {
  token: string;
  onJoin: (roomId: string, password?: string) => void;
  onLogout: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export function RoomLobby({ token, onJoin, onLogout }: Props) {
  const [roomId, setRoomId] = useState("");
  const [password, setPassword] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/rooms`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ password: createPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create room");

      onJoin(data.roomId, createPassword);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!roomId.trim()) {
      setError("Room ID is required to join");
      return;
    }
    onJoin(roomId.trim(), password);
  }

  return (
    <div className="join-screen">
      <div className="lobby-container">
        <header className="lobby-header">
          <h2>Room Lobby</h2>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </header>
        
        {error && <div className="error-message">{error}</div>}

        <div className="lobby-cards">
          <form className="join-card" onSubmit={handleJoin}>
            <h3>Join Existing Room</h3>
            <label>
              Room ID
              <input value={roomId} onChange={(e) => setRoomId(e.target.value)} required />
            </label>
            <label>
              Password (optional)
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button type="submit">Join Room</button>
          </form>

          <form className="join-card" onSubmit={handleCreate}>
            <h3>Create New Room</h3>
            <label>
              Password (optional)
              <input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Room"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
