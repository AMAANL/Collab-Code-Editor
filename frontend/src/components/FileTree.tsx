import { useState } from "react";
import type { FileEntry } from "../types";

interface Props {
  files: FileEntry[];
  activeFileId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, language: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  c: "c",
  cpp: "cpp",
  py: "python",
  java: "java",
  go: "go",
  js: "javascript",
  sql: "mysql",
  html: "html",
};

export function languageForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXT[ext] ?? "plaintext";
}

export function FileTree({ files, activeFileId, onSelect, onCreate, onRename, onDelete }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileLang, setNewFileLang] = useState("javascript");

  const SUPPORTED_LANGS = [
    { id: "c", ext: ".c", label: "C" },
    { id: "cpp", ext: ".cpp", label: "C++" },
    { id: "python", ext: ".py", label: "Python" },
    { id: "java", ext: ".java", label: "Java" },
    { id: "go", ext: ".go", label: "Go" },
    { id: "javascript", ext: ".js", label: "JavaScript" },
    { id: "mysql", ext: ".sql", label: "MySQL" },
    { id: "html", ext: ".html", label: "HTML" },
  ];

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newFileName.trim()) return;
    
    const langObj = SUPPORTED_LANGS.find(l => l.id === newFileLang);
    let finalName = newFileName.trim();
    if (langObj && !finalName.includes('.')) {
      finalName += langObj.ext;
    }
    
    onCreate(finalName, languageForName(finalName));
    setIsCreating(false);
    setNewFileName("");
  }

  function startRename(file: FileEntry) {
    setRenamingId(file.id);
    setDraftName(file.name);
  }

  function commitRename(id: string) {
    if (draftName.trim()) onRename(id, draftName.trim());
    setRenamingId(null);
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <h3>Files</h3>
        <button className="icon-button" onClick={() => setIsCreating(true)} title="New file">
          +
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateSubmit} className="file create-form">
          <input 
            autoFocus 
            value={newFileName} 
            onChange={e => setNewFileName(e.target.value)} 
            placeholder="Filename" 
            style={{ width: '100%', marginBottom: 5 }}
          />
          <select value={newFileLang} onChange={e => setNewFileLang(e.target.value)} style={{ width: '100%', marginBottom: 5 }}>
            {SUPPORTED_LANGS.map(l => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
          <div>
            <button type="submit">Create</button>
            <button type="button" onClick={() => setIsCreating(false)}>Cancel</button>
          </div>
        </form>
      )}

      {files.map((file) => (
        <div
          key={file.id}
          className={`file ${file.id === activeFileId ? "active" : ""}`}
          onClick={() => onSelect(file.id)}
          onDoubleClick={() => startRename(file)}
        >
          {renamingId === file.id ? (
            <input
              autoFocus
              className="file-rename-input"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => commitRename(file.id)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(file.id);
                if (e.key === "Escape") setRenamingId(null);
              }}
            />
          ) : (
            <>
              <span className="file-name">{file.name}</span>
              {files.length > 1 && (
                <button
                  className="icon-button file-delete"
                  title="Delete file"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete ${file.name}?`)) onDelete(file.id);
                  }}
                >
                  ×
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
