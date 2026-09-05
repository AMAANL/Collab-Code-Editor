# ⚡ CodeCollab — Real-Time Collaborative Code Editor

> A full-stack, production-grade collaborative programming platform with real-time code editing, multi-language execution, and password-protected rooms.

![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20WebSocket%20%7C%20Yjs-blueviolet?style=flat-square)
![Languages](https://img.shields.io/badge/Languages-8%20Supported-green?style=flat-square)
![Auth](https://img.shields.io/badge/Auth-JWT%20%2B%20bcrypt-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## ✨ Features

### 🔐 Authentication
- **Register & Login** with email and password
- Passwords hashed with **bcrypt** — never stored in plaintext
- Stateless **JWT-based** session management
- Persisted via **SQLite** on the backend

### 🏠 Room System
- **Create rooms** with an optional password
- **Join rooms** by Room ID — wrong password is rejected immediately
- Each room maintains its own isolated collaborative Yjs document

### ✏️ Real-Time Collaborative Editing
- Powered by **[Yjs](https://github.com/yjs/yjs)** — a CRDT-based sync engine
- Uses **WebSockets** for low-latency, bidirectional communication
- **Monaco Editor** (same engine as VS Code) with full syntax highlighting
- **Live cursors & presence** — see other users' positions in real time with color-coded avatars

### 💻 Multi-Language Code Execution
Supports **8 languages** with native compilation and execution:

| Language | Extension | Execution |
|---|---|---|
| C | `.c` | `gcc` compile → run |
| C++ | `.cpp` | `g++` compile → run |
| Python | `.py` | `python3` |
| Java | `.java` | `javac` compile → `java` run |
| Go | `.go` | `go run` |
| JavaScript | `.js` | `node` |
| MySQL | `.sql` | Isolated SQL context |
| HTML | `.html` | Sandboxed `<iframe>` preview |

### 📁 File Management
- Create, rename, and delete files within a room
- Correct file extensions automatically enforced per language
- All file state synced in real time across all collaborators

### 📦 Project Download
- Download the entire project as a **ZIP file** with one click
- All collaborative files are included, exactly as they appear in the editor

### 🛡️ HTML Preview
- HTML files render in a **sandboxed `<iframe>`** for safe, live preview

---

## 🏗️ Architecture

```
collab-code-editor/
├── backend/               # Node.js + TypeScript API Server
│   └── src/
│       ├── index.ts       # Express + WebSocket server entry
│       ├── auth.ts        # JWT auth, bcrypt, register/login routes
│       ├── rooms.ts       # Room creation, join, download API
│       ├── database.ts    # SQLite schema (users, rooms)
│       ├── roomManager.ts # Yjs room lifecycle & WebSocket sync
│       ├── CodeRunner.ts  # Multi-language code execution engine
│       └── persistence.ts # Yjs state file-based persistence
│
└── frontend/              # React + TypeScript + Vite SPA
    └── src/
        ├── App.tsx                      # Top-level router (auth → lobby → editor)
        ├── hooks/useCollabSession.ts    # WebSocket + Yjs session hook
        └── components/
            ├── AuthScreen.tsx           # Register / Login form
            ├── RoomLobby.tsx            # Create / Join room
            ├── CollabEditor.tsx         # Monaco editor with Yjs binding
            ├── FileTree.tsx             # Sidebar file management
            ├── OutputPanel.tsx          # Run output + HTML preview
            └── UserList.tsx             # Live collaborator presence
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- **gcc / g++** (for C/C++ execution)
- **java / javac** (for Java execution)
- **go** (for Go execution)
- **python3** (for Python execution)

### 1. Clone the Repository

```bash
git clone https://github.com/AMAANL/Collab-Code-Editor.git
cd Collab-Code-Editor
```

### 2. Start the Backend

```bash
cd backend
npm install
npm run dev
# Backend running on http://localhost:3000
```

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
# Frontend running on http://localhost:5173
```

### 4. Open in Browser

Navigate to **http://localhost:5173**, register an account, create or join a room, and start coding collaboratively!

---

## 🌐 Deployment (Render)

This project is designed for deployment on **[Render](https://render.com)**.

### Backend Web Service
| Setting | Value |
|---|---|
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Environment** | `Node` |

**Environment Variables:**
```
JWT_SECRET=your-super-secret-key-here
PORT=3000
```

### Frontend Static Site
| Setting | Value |
|---|---|
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

**Environment Variables:**
```
VITE_API_URL=https://your-backend.onrender.com/api
VITE_WS_URL=wss://your-backend.onrender.com
```

---

## 🔌 WebSocket Protocol

The client communicates via JSON messages over WebSocket:

| Message Type | Direction | Description |
|---|---|---|
| `auth` | → Server | Send JWT token to authenticate |
| `join-room` | → Server | Join room with ID + password |
| `yjs-update` | ↔ Both | CRDT document sync |
| `awareness-update` | ↔ Both | Cursor positions & presence |
| `create-file` | → Server | Create a new file |
| `rename-file` | → Server | Rename an existing file |
| `delete-file` | → Server | Delete a file |
| `run-code` | → Server | Execute code |
| `run-result` | ← Server | Execution output |
| `room-joined` | ← Server | Confirmation + initial state |
| `sync` | ← Server | Full Yjs document state on join |

---

## 🛠️ Tech Stack

**Frontend**
- [React 19](https://react.dev/) + TypeScript
- [Vite 8](https://vitejs.dev/) — build tool
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — VS Code editor engine
- [Yjs](https://github.com/yjs/yjs) + [y-protocols](https://github.com/yjs/y-protocols) — CRDT collaboration

**Backend**
- [Node.js](https://nodejs.org/) + TypeScript
- [Express](https://expressjs.com/) — HTTP API
- [ws](https://github.com/websockets/ws) — WebSocket server
- [Yjs](https://github.com/yjs/yjs) — server-side CRDT state management
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — fast, synchronous SQLite
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — password hashing
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) — JWT signing/verification
- [archiver](https://github.com/archiverjs/node-archiver) — ZIP generation

---

## 🔒 Security

- Passwords are hashed with **bcrypt** (salt rounds: 10) before storage
- JWTs are signed with a configurable secret and validated on every WebSocket message
- HTML execution uses a **sandboxed iframe** with `allow-scripts` only
- Code execution is isolated per-request with timeout limits
- CORS is configured for controlled cross-origin access

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

---
