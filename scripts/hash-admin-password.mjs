/**
 * `npm run admin:hash-password` — печатает значение для `ADMIN_PASSWORD_HASH`.
 *
 * Пароль читается из скрытого ввода терминала (эхо выключено) либо из переменной окружения
 * `ADMIN_PASSWORD` — второй способ нужен для неинтерактивных сред. Сам пароль НЕ печатается и
 * никуда не записывается: в вывод уходит только хеш.
 *
 * Алгоритм — scrypt (RFC 7914) из стандартной библиотеки Node. Он специально медленный и
 * требователен к памяти, то есть устойчив к перебору на GPU. Внешняя зависимость (bcrypt/argon2)
 * не нужна: обе требуют нативной сборки, а выигрыша по стойкости для одной учётной записи не дают.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createInterface } from "node:readline";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

const KEY_ENTER = ["\r", "\n"];
const KEY_EOT = String.fromCharCode(4); // Ctrl+D — конец ввода
const KEY_ETX = String.fromCharCode(3); // Ctrl+C — отмена
const KEY_BACKSPACE = [String.fromCharCode(8), String.fromCharCode(127)];

function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: 64 * 1024 * 1024,
  });

  // Разделитель — двоеточие, а не канонический для scrypt доллар: Next.js раскрывает
  // `$переменные` внутри .env-файлов, и `scrypt$16384$8$1$…` молча превратился бы в мусор.
  // В base64 двоеточие не встречается, поэтому разбор однозначен.
  return [
    "scrypt",
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join(":");
}

/** Ввод без эха: символы пароля не должны оставаться на экране и в истории терминала. */
function readHiddenLine(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;

    if (!input.isTTY) {
      const rl = createInterface({ input, terminal: false });
      rl.once("line", (line) => {
        rl.close();
        resolve(line);
      });
      rl.once("close", () => resolve(""));
      return;
    }

    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    let value = "";
    const finish = (action) => {
      input.setRawMode(false);
      input.pause();
      input.off("data", onData);
      output.write("\n");
      action();
    };

    const onData = (char) => {
      if (KEY_ENTER.includes(char) || char === KEY_EOT) {
        finish(() => resolve(value));
        return;
      }
      if (char === KEY_ETX) {
        finish(() => reject(new Error("Отменено")));
        return;
      }
      if (KEY_BACKSPACE.includes(char)) {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };

    input.on("data", onData);
  });
}

const fromEnv = process.env.ADMIN_PASSWORD;
let password = fromEnv ?? (await readHiddenLine("Пароль администратора: "));

if (!fromEnv) {
  const repeat = await readHiddenLine("Повторите пароль: ");
  const a = Buffer.from(password);
  const b = Buffer.from(repeat);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.error("Пароли не совпадают. Хеш не создан.");
    process.exit(1);
  }
}

if (password.length < 12) {
  console.error("Пароль слишком короткий: нужно не менее 12 символов. Хеш не создан.");
  process.exit(1);
}

const hash = hashPassword(password);
password = "";

console.log("\nДобавьте строку в .env.local (значение целиком, вместе с префиксом scrypt$):\n");
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
console.log("Сам пароль нигде не сохранён и в этот вывод не попадает.");
