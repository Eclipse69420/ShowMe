import { spawn } from "child_process";
import { existsSync } from "fs";
import { stat } from "fs/promises";
import { join, resolve } from "path";

// Auto-build if dist doesn't exist
async function ensureBuild(): Promise<void> {
  const projectRoot = join(import.meta.dir, "..");
  const distIndex = join(projectRoot, "dist", "index.html");

  // Use async stat check instead of blocking existsSync
  try {
    await stat(distIndex);
    return; // File exists, no build needed
  } catch {
    // File doesn't exist, need to build
  }

  console.error("Building UI (first run)...");

  const buildPromise = new Promise<number>((resolve, reject) => {
    const child = spawn("bun", ["run", "build"], {
      cwd: projectRoot,
      stdio: "pipe", // Non-blocking
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  // Add timeout to prevent hook timeout
  const timeoutPromise = new Promise<number>((_, reject) => {
    setTimeout(() => reject(new Error("Build timeout after 30s")), 30000);
  });

  const exitCode = await Promise.race([buildPromise, timeoutPromise]);

  if (exitCode !== 0) {
    throw new Error("Build failed");
  }
  console.error("Build complete.");
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

// Validation limits to prevent abuse
const MAX_PAGES = 50;
const MAX_ANNOTATIONS_PER_PAGE = 100;
const MAX_FEEDBACK_LENGTH = 10000;
const MAX_GLOBAL_NOTES_LENGTH = 50000;
const MAX_PAGE_NAME_LENGTH = 200;
const VALID_ANNOTATION_TYPES = ["pin", "area", "arrow", "highlight"];

function validateSubmitPayload(data: unknown): data is SubmitPayload {
  if (typeof data !== "object" || data === null) return false;
  const payload = data as Record<string, unknown>;
  if (payload.action !== "submit") return false;
  if (!Array.isArray(payload.pages)) return false;

  // Limit number of pages
  if (payload.pages.length > MAX_PAGES) return false;

  // Validate globalNotes if present
  if (payload.globalNotes !== undefined) {
    if (typeof payload.globalNotes !== "string") return false;
    if (payload.globalNotes.length > MAX_GLOBAL_NOTES_LENGTH) return false;
  }

  for (const page of payload.pages) {
    if (typeof page !== "object" || page === null) return false;
    const p = page as Record<string, unknown>;
    if (typeof p.id !== "string" || typeof p.name !== "string") return false;
    if (p.name.length > MAX_PAGE_NAME_LENGTH) return false;
    if (typeof p.image !== "string") return false;
    if (typeof p.width !== "number" || typeof p.height !== "number")
      return false;
    if (!Array.isArray(p.annotations)) return false;

    // Limit annotations per page
    if (p.annotations.length > MAX_ANNOTATIONS_PER_PAGE) return false;

    // Validate each annotation
    for (const ann of p.annotations) {
      if (typeof ann !== "object" || ann === null) return false;
      const a = ann as Record<string, unknown>;
      if (typeof a.type !== "string") return false;
      if (!VALID_ANNOTATION_TYPES.includes(a.type)) return false;
      if (
        typeof a.feedback === "string" &&
        a.feedback.length > MAX_FEEDBACK_LENGTH
      )
        return false;
    }
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

      // CSRF protection for POST requests - only allow requests from same origin
      if (req.method === "POST") {
        const origin = req.headers.get("origin");
        const expectedOrigin = `http://localhost:${port}`;
        if (origin && origin !== expectedOrigin) {
          return new Response(JSON.stringify({ error: "Invalid origin" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // API endpoints
      if (url.pathname === "/api/submit" && req.method === "POST") {
        console.error("[ShowMe] Received submit request");
        let rawPayload: unknown;
        try {
          rawPayload = await req.json();
          console.error("[ShowMe] Parsed JSON payload");
        } catch (e) {
          console.error("[ShowMe] JSON parse error:", e);
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!validateSubmitPayload(rawPayload)) {
          console.error("[ShowMe] Payload validation failed");
          return new Response(
            JSON.stringify({ error: "Invalid payload structure" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        console.error("[ShowMe] Payload validated, resolving promise");

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
  console.error("[ShowMe] Waiting for user action...");
  const result = await resultPromise;
  console.error("[ShowMe] Got result, stopping server...");

  // Stop server
  server.stop();

  // Output result to stdout for Claude
  console.log(JSON.stringify(result));

  // Force exit to ensure process terminates
  process.exit(0);
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
