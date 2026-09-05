import { useState, type FormEvent } from "react";

interface Props {
  defaultRoomId?: string;
  onJoin: (roomId: string, userName: string) => void;
}

const ADJECTIVES = ["Swift", "Clever", "Quiet", "Bold", "Bright", "Calm", "Sharp", "Nimble"];
const ANIMALS = ["Fox", "Owl", "Otter", "Falcon", "Lynx", "Wren", "Heron", "Panther"];

function randomName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${a}${b}`;
}

function randomRoomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function JoinScreen({ defaultRoomId, onJoin }: Props) {
  const [roomId, setRoomId] = useState(defaultRoomId ?? "");
  const [userName, setUserName] = useState(randomName);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const finalRoomId = roomId.trim() || randomRoomId();
    onJoin(finalRoomId, userName.trim() || randomName());
  }

  return (
    <div className="join-screen">
      <form className="join-card" onSubmit={handleSubmit}>
        <h1>Collab Code Editor</h1>
        <p className="join-subtitle">Real-time collaborative coding, right in your browser.</p>

        <label>
          Your name
          <input value={userName} onChange={(e) => setUserName(e.target.value)} maxLength={40} />
        </label>

        <label>
          Room ID
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Leave blank to create a new room"
            maxLength={40}
          />
        </label>

        <button type="submit">{roomId.trim() ? "Join room" : "Create room"}</button>
      </form>
    </div>
  );
}
