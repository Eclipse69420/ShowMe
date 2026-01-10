import { spawn } from "child_process";
import { existsSync } from "fs";
import { join, resolve } from "path";

// Auto-build if dist doesn't exist
async function ensureBuild(): Promise<void> {
  const projectRoot = join(import.meta.dir, "..");
  const distIndex = join(projectRoot, "dist", "index.html");

  if (!existsSync(distIndex)) {
    console.error("Building UI (first run)...");

    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn("bun", ["run", "build"], {
        cwd: projectRoot,
        stdio: "inherit",
      });

      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      throw new Error("Build failed");
    }
    console.error("Build complete.");
  }
}

interface InputContext {
  tool_input?: {
    context?: string;
    currentFile?: string;
  };
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AnnotationData {
  id: string;
  type: string;
  number: number;
  bounds: BoundingBox;
  feedback: string;
}

interface PageData {
  id: string;
  name: string;
  image: string;
  width: number;
  height: number;
  annotations: AnnotationData[];
}

interface SubmitPayload {
  action: "submit";
  pages: PageData[];
  globalNotes?: string;
}

function validateSubmitPayload(data: unknown): data is SubmitPayload {
  if (typeof data !== "object" || data === null) return false;
  const payload = data as Record<string, unknown>;
  if (payload.action !== "submit") return false;
  if (!Array.isArray(payload.pages)) return false;

  for (const page of payload.pages) {
    if (typeof page !== "object" || page === null) return false;
    const p = page as Record<string, unknown>;
    if (typeof p.id !== "string" || typeof p.name !== "string") return false;
    if (typeof p.image !== "string") return false;
    if (typeof p.width !== "number" || typeof p.height !== "number")
      return false;
    if (!Array.isArray(p.annotations)) return false;
  }
  return true;
}

interface ShowMeOutput {
  hookSpecificOutput: {
    decision: {
      behavior: "allow" | "deny";
      message?: string;
    };
    showme?: {
      pages: PageData[];
      globalNotes?: string;
    };
  };
}

// Read stdin for context from Claude
async function readStdin(): Promise<InputContext> {
  const chunks: Buffer[] = [];

  // Check if stdin has data (not a TTY)
  if (process.stdin.isTTY) {
    return {};
  }

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      process.stdin.removeListener("end", onEnd);
      process.stdin.removeListener("error", onError);
      clearTimeout(timeoutId);
    };

    const doResolve = (value: InputContext) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(value);
    };

    const onData = (chunk: Buffer) => chunks.push(chunk);
    const onEnd = () => {
      const input = Buffer.concat(chunks).toString("utf-8").trim();
      if (input) {
        try {
          doResolve(JSON.parse(input));
        } catch {
          doResolve({});
        }
      } else {
        doResolve({});
      }
    };
    const onError = () => doResolve({});

    process.stdin.on("data", onData);
    process.stdin.on("end", onEnd);
    process.stdin.on("error", onError);

    const timeoutId = setTimeout(() => doResolve({}), 100);
  });
}

// Open browser cross-platform
function openBrowser(url: string) {
  const platform = process.platform;

  let command: string;
  let args: string[];

  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    // Linux and others
    command = "xdg-open";
    args = [url];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

// Find the dist directory
function findDistDir(): string {
  const possiblePaths = [
    join(import.meta.dir, "..", "dist"),
    join(import.meta.dir, "..", "ui"),
    resolve("dist"),
    resolve("ui"),
  ];

  for (const p of possiblePaths) {
    if (existsSync(join(p, "index.html"))) {
      return p;
    }
  }

  // Default to ui for development
  return join(import.meta.dir, "..", "ui");
}

async function main() {
  // Ensure UI is built before starting server
  await ensureBuild();

  const context = await readStdin();
  const port = Math.floor(Math.random() * 10000) + 40000;
  const distDir = findDistDir();

  let resolvePromise: (output: ShowMeOutput) => void;
  const resultPromise = new Promise<ShowMeOutput>((resolve) => {
    resolvePromise = resolve;
  });

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // API endpoints
      if (url.pathname === "/api/submit" && req.method === "POST") {
        let rawPayload: unknown;
        try {
          rawPayload = await req.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!validateSubmitPayload(rawPayload)) {
          return new Response(
            JSON.stringify({ error: "Invalid payload structure" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const payload = rawPayload;

        resolvePromise({
          hookSpecificOutput: {
            decision: { behavior: "allow" },
            showme: {
              pages: payload.pages,
              globalNotes: payload.globalNotes,
            },
          },
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/cancel" && req.method === "POST") {
        resolvePromise({
          hookSpecificOutput: {
            decision: {
              behavior: "deny",
              message: "User cancelled ShowMe",
            },
          },
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/context") {
        return new Response(JSON.stringify(context), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Serve static files with path traversal protection
      let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
      const decodedPath = decodeURIComponent(filePath);
      const normalizedPath = resolve(distDir, "." + decodedPath);

      // Prevent path traversal attacks
      if (!normalizedPath.startsWith(resolve(distDir))) {
        return new Response("Forbidden", { status: 403 });
      }

      const fullPath = normalizedPath;

      try {
        const file = Bun.file(fullPath);
        if (await file.exists()) {
          const contentType = getContentType(filePath);
          return new Response(file, {
            headers: { "Content-Type": contentType },
          });
        }
      } catch (err) {
        console.error(`Error serving file ${fullPath}:`, err);
      }

      // Fallback to index.html for SPA
      const indexPath = join(distDir, "index.html");
      const indexFile = Bun.file(indexPath);
      if (await indexFile.exists()) {
        return new Response(indexFile, {
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  // Open browser
  const browserUrl = `http://localhost:${port}`;
  openBrowser(browserUrl);

  // Log to stderr (not stdout, which is for Claude)
  console.error(`ShowMe canvas opened at ${browserUrl}`);

  // Wait for result
  const result = await resultPromise;

  // Stop server
  server.stop();

  // Output result to stdout for Claude
  console.log(JSON.stringify(result));
}

function getContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    ts: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
  };
  return types[ext || ""] || "application/octet-stream";
}

main().catch((err) => {
  console.error("ShowMe error:", err);
  process.exit(1);
});
