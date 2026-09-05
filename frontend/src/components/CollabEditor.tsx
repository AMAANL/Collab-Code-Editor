import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type { Awareness } from "y-protocols/awareness.js";
import { MonacoBinding } from "y-monaco";
import type * as Y from "yjs";
import type * as MonacoNamespace from "monaco-editor";

type MonacoEditor = MonacoNamespace.editor.IStandaloneCodeEditor;
type MonacoModel = MonacoNamespace.editor.ITextModel;

interface Props {
  fileId: string;
  language: string;
  fileIds: string[];
  awareness: Awareness | null;
  getYText: (fileId: string) => Y.Text | null;
}

export function CollabEditor({ fileId, language, fileIds, awareness, getYText }: Props) {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<typeof MonacoNamespace | null>(null);
  const modelsRef = useRef<Map<string, MonacoModel>>(new Map());
  const bindingRef = useRef<MonacoBinding | null>(null);

  function attachFile(id: string, lang: string) {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    const ytext = getYText(id);
    if (!editorInstance || !monaco || !ytext) return;

    bindingRef.current?.destroy();
    bindingRef.current = null;

    let model = modelsRef.current.get(id);
    if (!model) {
      model = monaco.editor.createModel("", lang, monaco.Uri.parse(`file:///${id}`));
      modelsRef.current.set(id, model);
    }

    editorInstance.setModel(model);
    bindingRef.current = new MonacoBinding(
      ytext,
      model,
      new Set([editorInstance]),
      awareness ?? undefined
    );
  }

  const handleMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;
    attachFile(fileId, language);
  };

  // Re-bind whenever the active file changes.
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      attachFile(fileId, language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, awareness]);

  // Drop cached models for files that no longer exist (deleted locally or by
  // another collaborator).
  useEffect(() => {
    const liveIds = new Set(fileIds);
    modelsRef.current.forEach((model, id) => {
      if (!liveIds.has(id)) {
        if (editorRef.current?.getModel() === model) {
          bindingRef.current?.destroy();
          bindingRef.current = null;
        }
        model.dispose();
        modelsRef.current.delete(id);
      }
    });
  }, [fileIds]);

  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      modelsRef.current.forEach((model) => model.dispose());
      modelsRef.current.clear();
    };
  }, []);

  return (
    <Editor
      height="100%"
      language={language}
      theme="vs-dark"
      onMount={handleMount}
      options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true }}
    />
  );
}
