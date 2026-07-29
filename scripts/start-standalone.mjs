/**
 * Запуск собранного сайта так же, как он работает на production.
 *
 * Зачем отдельный скрипт. После перехода на `output: "standalone"` команда `next start` перестала
 * быть поддерживаемой — Next.js прямо предупреждает: «"next start" does not work with "output:
 * standalone" configuration». Она пока что-то отдаёт, но это уже не тот сервер, который поедет на
 * сервер, а расхождение между локальной проверкой и production — ровно та причина, по которой в
 * первый деплой уехал пустой блог.
 *
 * Что делает. `next build` кладёт в `.next/standalone` самодостаточный сервер, но НЕ переносит
 * туда `.next/static` и `public` — это оставлено вызывающей стороне (в production то же самое
 * делает Dockerfile). Скрипт копирует их и запускает `server.js`.
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, ".next", "standalone");

if (!existsSync(path.join(standaloneDir, "server.js"))) {
  console.error("Нет собранного сервера. Сначала: npm run build");
  process.exit(1);
}

cpSync(path.join(projectRoot, ".next", "static"), path.join(standaloneDir, ".next", "static"), {
  recursive: true,
});
cpSync(path.join(projectRoot, "public"), path.join(standaloneDir, "public"), { recursive: true });

/**
 * Пути хранилища считаются от `process.cwd()` (`src/server/config.ts`), а standalone-сервер
 * запускается из своей директории. Без этой строки локальный запуск завёл бы вторую, пустую базу
 * внутри `.next/standalone/var`, и стало бы непонятно, почему сайт «потерял» контент.
 */
const dataDir = process.env.QBIT_DATA_DIR ?? path.join(projectRoot, "var");

/**
 * Порт приходит аргументом, а не через `PORT=… npm run start`: запись `ПЕРЕМЕННАЯ=значение команда`
 * работает в POSIX-оболочках, но не в cmd.exe, через который npm запускает скрипты на Windows.
 * Разработка идёт на Windows, production — на Linux; аргумент понимают обе стороны.
 */
const portIndex = process.argv.indexOf("--port");
const port = portIndex === -1 ? (process.env.PORT ?? "3000") : process.argv[portIndex + 1];

const server = spawn(process.execPath, [path.join(standaloneDir, "server.js")], {
  stdio: "inherit",
  env: { ...process.env, QBIT_DATA_DIR: dataDir, PORT: String(port) },
});

server.on("exit", (code) => process.exit(code ?? 0));
