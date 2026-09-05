import type { RunResult } from "../types";

interface Props {
  result: RunResult | null;
  running: boolean;
}

export function OutputPanel({ result, running }: Props) {
  if (result?.isHtml) {
    return (
      <section className="output" style={{ padding: 0 }}>
        <div style={{ background: '#333', padding: '5px 10px', fontSize: 12 }}>HTML Preview</div>
        <iframe 
          sandbox="allow-scripts" 
          srcDoc={result.stdout} 
          style={{ width: '100%', height: 'calc(100% - 25px)', border: 'none', background: 'white' }}
        />
      </section>
    );
  }

  return (
    <section className="output">
      <h3>Output</h3>
      <pre className="output-body">
        {running && "Running…"}
        {!running && !result && "Run your code to see output here."}
        {!running && result && (
          <>
            {result.stdout}
            {result.stderr && <span className="output-stderr" style={{ color: '#f87171' }}>{result.stderr}</span>}
            {result.exitCode !== null && (
              <span className="output-meta" style={{ display: 'block', marginTop: 10, color: '#888' }}>
                Exited with code {result.exitCode}
              </span>
            )}
          </>
        )}
      </pre>
    </section>
  );
}
