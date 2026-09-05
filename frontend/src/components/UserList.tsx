interface RemoteUser {
  clientId: number;
  name: string;
  color: string;
}

interface Props {
  users: RemoteUser[];
  selfName: string;
  selfColor: string;
}

export function UserList({ users, selfName, selfColor }: Props) {
  return (
    <div className="user-list">
      <span className="user-chip self" style={{ borderColor: selfColor }}>
        <span className="user-dot" style={{ background: selfColor }} />
        {selfName} (you)
      </span>
      {users.map((user) => (
        <span key={user.clientId} className="user-chip" style={{ borderColor: user.color }}>
          <span className="user-dot" style={{ background: user.color }} />
          {user.name}
        </span>
      ))}
    </div>
  );
}
