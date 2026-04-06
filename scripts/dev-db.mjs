import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const backendEnvPath = path.join(repoRoot, "Backend", ".env");
const composeFile = path.join(repoRoot, "docker-compose.dev-db.yml");
const command = process.argv[2] ?? "ensure";

function parseEnv(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function isLocalHost(host) {
  return !host || host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function parseDatabaseUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: Number(url.port || "5432"),
    };
  } catch {
    return null;
  }
}

async function loadDbConfig() {
  let content;

  try {
    content = await fs.readFile(backendEnvPath, "utf8");
  } catch {
    throw new Error("Backend/.env fehlt. Bitte erst Backend/.env anlegen.");
  }

  const env = parseEnv(content);
  const fromUrl = env.DATABASE_URL ? parseDatabaseUrl(env.DATABASE_URL) : null;
  const dbHost = fromUrl?.host ?? env.DB_HOST ?? "localhost";
  const dbPort = Number(fromUrl?.port ?? env.DB_PORT ?? "5432");

  return {
    dbName: env.DB_NAME || "odin",
    dbUser: env.DB_USER || "postgres",
    dbPassword: env.DB_PASSWORD || "",
    dbHost,
    dbPort,
    usesLocalDb: isLocalHost(dbHost),
  };
}

function run(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, {
      cwd: options.cwd ?? repoRoot,
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
      stdio: options.stdio ?? "inherit",
    });

    child.on("error", (error) => {
      if (options.allowFailure) {
        resolve({ exitCode: 1, error });
        return;
      }

      reject(error);
    });

    child.on("exit", (exitCode) => {
      resolve({ exitCode: exitCode ?? 1 });
    });
  });
}

async function findComposeRunner() {
  const runners = [
    {
      label: "docker-compose",
      probe: ["version"],
      buildArgs: (args) => args,
      commandName: "docker-compose",
    },
    {
      label: "docker compose",
      probe: ["compose", "version"],
      buildArgs: (args) => ["compose", ...args],
      commandName: "docker",
    },
    {
      label: "podman-compose",
      probe: ["version"],
      buildArgs: (args) => args,
      commandName: "podman-compose",
    },
    {
      label: "podman compose",
      probe: ["compose", "version"],
      buildArgs: (args) => ["compose", ...args],
      commandName: "podman",
    },
  ];

  for (const runner of runners) {
    const result = await run(runner.commandName, runner.probe, {
      allowFailure: true,
      stdio: "ignore",
    });

    if (result.exitCode === 0) {
      return runner;
    }
  }

  return null;
}

function canConnect(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const finish = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDb() {
  if (process.env.ODIN_SKIP_DB === "1") {
    console.log("[ODIN dev] ODIN_SKIP_DB=1 gesetzt. DB-Bootstrap wird übersprungen.");
    return;
  }

  const config = await loadDbConfig();

  if (!config.usesLocalDb) {
    console.log(`[ODIN dev] Backend nutzt ${config.dbHost}:${config.dbPort}. Lokaler Postgres-Container wird nicht gestartet.`);
    return;
  }

  if (config.dbPort !== 5432) {
    throw new Error(`Backend/.env nutzt DB_PORT=${config.dbPort}. Der Root-Dev-Start erwartet localhost:5432.`);
  }

  if (await canConnect("127.0.0.1", config.dbPort)) {
    console.log(`[ODIN dev] Postgres läuft bereits auf localhost:${config.dbPort}. Bestehende Instanz wird verwendet.`);
    return;
  }

  if (!config.dbPassword) {
    throw new Error("DB_PASSWORD fehlt in Backend/.env.");
  }

  const runner = await findComposeRunner();
  if (!runner) {
    throw new Error("Keine Docker-/Podman-Compose-CLI gefunden. Bitte Docker Desktop oder Podman installieren.");
  }

  const composeEnv = {
    DB_NAME: config.dbName,
    DB_USER: config.dbUser,
    DB_PASSWORD: config.dbPassword,
  };

  console.log(`[ODIN dev] Starte Postgres via ${runner.label} ...`);
  const startResult = await run(
    runner.commandName,
    runner.buildArgs(["-f", composeFile, "up", "-d", "postgres"]),
    { env: composeEnv }
  );

  if (startResult.exitCode !== 0) {
    throw new Error("Postgres-Container konnte nicht gestartet werden.");
  }

  console.log("[ODIN dev] Warte auf Postgres an localhost:5432 ...");
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (await canConnect("127.0.0.1", config.dbPort)) {
      console.log("[ODIN dev] Postgres ist bereit.");
      return;
    }

    await wait(1000);
  }

  throw new Error("Postgres wurde innerhalb von 60s nicht erreichbar. Bitte Container-Logs prüfen.");
}

async function stopDb() {
  const runner = await findComposeRunner();
  if (!runner) {
    console.log("[ODIN dev] Keine Compose-CLI gefunden. Lokale Postgres-Instanz bleibt unverändert.");
    return;
  }

  const config = await loadDbConfig();
  if (!config.usesLocalDb || config.dbPort !== 5432) {
    console.log("[ODIN dev] Keine lokal gestartete Dev-DB zu stoppen.");
    return;
  }

  const composeEnv = {
    DB_NAME: config.dbName,
    DB_USER: config.dbUser,
    DB_PASSWORD: config.dbPassword,
  };

  console.log(`[ODIN dev] Stoppe Postgres via ${runner.label} ...`);
  const stopResult = await run(
    runner.commandName,
    runner.buildArgs(["-f", composeFile, "stop", "postgres"]),
    { env: composeEnv }
  );

  if (stopResult.exitCode !== 0) {
    throw new Error("Postgres-Container konnte nicht gestoppt werden.");
  }

  console.log("[ODIN dev] Postgres wurde gestoppt.");
}

try {
  if (command === "ensure") {
    await ensureDb();
  } else if (command === "stop") {
    await stopDb();
  } else {
    throw new Error(`Unbekannter Befehl: ${command}`);
  }
} catch (error) {
  console.error(`[ODIN dev] ${error.message}`);
  process.exit(1);
}