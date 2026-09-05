import { spawn } from "child_process";
import { mkdtemp, rm, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  isHtml?: boolean;
}

const TIMEOUT_MS = 5000;
const MAX_OUTPUT_CHARS = 20_000;

interface Runner {
  fileName: string;
  command: string | null;
  args: (filePath: string, dir: string) => string[];
  compile?: { command: string; args: (filePath: string, dir: string) => string[] };
}

const RUNNERS: Record<string, Runner> = {
  c: { 
    fileName: "main.c", 
    compile: { command: "gcc", args: (f, d) => [f, "-o", path.join(d, "main")] },
    command: "./main", 
    args: () => [] 
  },
  cpp: { 
    fileName: "main.cpp", 
    compile: { command: "g++", args: (f, d) => [f, "-o", path.join(d, "main")] },
    command: "./main", 
    args: () => [] 
  },
  python: { fileName: "main.py", command: "python3", args: (f) => [f] },
  java: { 
    fileName: "Main.java", 
    compile: { command: "javac", args: (f) => [f] },
    command: "java", 
    args: (f, d) => ["-cp", d, "Main"] 
  },
  go: { fileName: "main.go", command: "go", args: (f) => ["run", f] },
  javascript: { fileName: "main.js", command: "node", args: (f) => [f] },
  mysql: { 
    fileName: "main.sql", 
    // Using local mysql client for dev. (In prod this would be isolated properly)
    command: "mysql", 
    args: (f) => ["-u", "root", "-e", `source ${f}`] // We use root for this local testing fallback without docker
  },
  html: { fileName: "index.html", command: null, args: () => [] },
};

export const SUPPORTED_LANGUAGES = Object.keys(RUNNERS);

export async function runCode(language: string, code: string): Promise<RunResult> {
  const runner = RUNNERS[language];

  if (!runner) {
    return {
      stdout: "",
      stderr: `Running "${language}" isn't supported yet. Supported languages: ${SUPPORTED_LANGUAGES.join(", ")}.`,
      exitCode: null,
      timedOut: false,
    };
  }

  // HTML is handled on frontend, but if requested here, just return it
  if (language === "html") {
    return { stdout: code, stderr: "", exitCode: 0, timedOut: false, isHtml: true };
  }

  const dir = await mkdtemp(path.join(tmpdir(), "collab-run-"));
  const filePath = path.join(dir, runner.fileName);

  try {
    await writeFile(filePath, code, "utf-8");

    // Compilation step if needed
    if (runner.compile) {
      const compileRes = await runInSubprocess(runner.compile.command, runner.compile.args(filePath, dir), dir);
      if (compileRes.exitCode !== 0) {
        return {
          stdout: "",
          stderr: `Compilation Error:\n${compileRes.stderr}`,
          exitCode: compileRes.exitCode,
          timedOut: compileRes.timedOut
        };
      }
    }

    if (!runner.command) {
      return { stdout: "", stderr: "No execution command defined", exitCode: 1, timedOut: false };
    }

    // Command might be relative to dir
    const cmd = runner.command.startsWith("./") ? path.join(dir, runner.command.slice(2)) : runner.command;
    return await runInSubprocess(cmd, runner.args(filePath, dir), dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runInSubprocess(command: string, args: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < MAX_OUTPUT_CHARS) stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_OUTPUT_CHARS) stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({
        stdout: stdout.slice(0, MAX_OUTPUT_CHARS),
        stderr: `${stderr}\n${err.message}`.trim(),
        exitCode: null,
        timedOut,
      });
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({
        stdout: stdout.slice(0, MAX_OUTPUT_CHARS),
        stderr: (timedOut ? "Execution timed out.\n" : "") + stderr.slice(0, MAX_OUTPUT_CHARS),
        exitCode: code,
        timedOut,
      });
    });
  });
}
