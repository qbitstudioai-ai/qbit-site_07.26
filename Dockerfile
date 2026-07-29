# Образ сайта Allqbit.
#
# Node 24, а не 22, сознательно: база контента работает на встроенном модуле `node:sqlite`, который
# в Node 22 доступен только под флагом `--experimental-sqlite` и меняет поведение от версии к
# версии. В Node 24 он стабилен. Alpine — ради размера; нативных сборок в зависимостях нет,
# единственный бинарный модуль (sharp) ставится npm-ом под ту же musl-платформу.

# ─── 1. Зависимости ────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

# Отдельный слой: пока package-lock.json не меняется, установка берётся из кэша и сборка идёт
# минуты вместо десятков минут.
COPY package.json package-lock.json ./
RUN npm ci


# ─── 2. Сборка ─────────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Публичные страницы пререндерятся здесь. Базы на этом этапе нет, и это нормально: контентные
# модули падают обратно на тексты из `data/` (см. `src/server/content/*.ts`) — те же самые, что
# уходят в базу при `db:seed`. После правки через админ-панель страницы перерисовываются
# по `revalidatePath` из `src/server/api/revalidate.ts`, пересборка образа для этого не нужна.
RUN npm run build


# ─── 3. Рабочий образ ──────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Без этого standalone-сервер слушает только 127.0.0.1 внутри контейнера и недоступен для Caddy.
ENV HOSTNAME=0.0.0.0
# Постоянное хранилище. Совпадает с точкой монтирования тома в compose.yml.
ENV QBIT_DATA_DIR=/data

# Своя учётная запись: процесс сайта не должен работать под root. UID 1001 фиксирован намеренно —
# им же владеет каталог данных на сервере, иначе запись в базу упрётся в права.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# `.next/standalone` содержит server.js и оттрассированные модули, но НЕ статику и НЕ public —
# их Next оставляет вызывающей стороне. Копируются отдельными строками ниже.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# sharp обслуживает `next/image` в production. Он в devDependencies (нужен ещё и скриптам генерации
# картинок), поэтому в трассировку standalone не попадает — копируется явно. Бинарники собраны в
# builder-стадии на той же alpine/musl-платформе, что и здесь, поэтому подходят как есть.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

# Миграции и первичное заполнение базы запускаются на сервере ОТДЕЛЬНОЙ командой (см. deploy.sh),
# до старта сайта. Скрипты — ESM с расширением .mjs и зависят только от встроенных модулей Node,
# поэтому работают без node_modules. `data/` нужен `db:seed` как источник текстов, `public/` (уже
# скопирован выше) — как источник файлов документов.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src/server/db/schema.mjs ./src/server/db/schema.mjs
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

# Кэш перерисованных страниц. Каталог создаётся заранее и с нужным владельцем: процесс работает не
# под root и сам создать его в корне образа не смог бы, а без него `revalidatePath` молча
# не сохранит результат.
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs

EXPOSE 3000

# Порт наружу не публикуется (см. compose.yml) — проверка ходит внутрь контейнера.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
