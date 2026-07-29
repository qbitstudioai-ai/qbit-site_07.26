# Развёртывание сайта Allqbit

Сервер: `72.56.6.85`, Ubuntu 22.04. Домен `allqbit.ru`.

## Как всё устроено

На сервере уже работает Supabase, и он же принимает весь входящий трафик: порты 80 и 443 держит
контейнер `supabase-caddy`. Сайт **не публикует портов наружу** — Caddy находит его по имени
контейнера внутри docker-сети и отдаёт наружу по HTTPS с сертификатом Let's Encrypt.

```
интернет → :443 supabase-caddy → allqbit-site:3000 (сеть supabase_default)
```

Маршрут домена описан в `/opt/supabase/volumes/proxy/caddy/Caddyfile`:

```
allqbit.ru, www.allqbit.ru {
	encode gzip zstd
	reverse_proxy allqbit-site:3000
	header -Server
}
```

Отсюда жёсткое требование: контейнер обязан называться `allqbit-site` и слушать порт 3000.

Раскладка каталогов:

| Путь                | Что там                            | Переживает деплой |
| ------------------- | ---------------------------------- | ----------------- |
| `/opt/allqbit`      | клон репозитория, перезаписывается | нет               |
| `/opt/allqbit-data` | база, документы, секреты, копии    | **да**            |

Разделение обязательно. Если положить данные внутрь каталога развёртывания, каждое обновление
кода стирало бы тексты и документы, введённые через админ-панель.

---

## Первичная установка

Выполняется один раз, под root.

### 1. Каталоги

```bash
mkdir -p /opt/allqbit-data/var/uploads /opt/allqbit-data/backups
chown -R 1001:1001 /opt/allqbit-data/var
```

UID 1001 — это пользователь `nextjs` внутри образа. Без совпадения владельца SQLite ответит
`readonly database`.

### 2. Код

```bash
git clone https://github.com/qbitstudioai-ai/qbit-site_07.26.git /opt/allqbit
cd /opt/allqbit
chmod +x deploy.sh backup.sh
```

### 3. Секреты

```bash
cp .env.production.example /opt/allqbit-data/production.env
chmod 600 /opt/allqbit-data/production.env
```

Получить значения:

```bash
# Хеш пароля админки — введите пароль по запросу, сам пароль никуда не сохраняется
docker run --rm -it -v /opt/allqbit:/app -w /app node:24-alpine node scripts/hash-admin-password.mjs

# Секрет подписи сессий
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Заполнить в `/opt/allqbit-data/production.env`: `ADMIN_LOGIN`, `ADMIN_PASSWORD_HASH`,
`SESSION_SECRET`. Токены Telegram и n8n — по мере готовности; без них соответствующие формы честно
показывают ошибку, остальной сайт работает.

### 4. Сборка и первое заполнение базы

```bash
cd /opt/allqbit
docker compose build
docker compose run --rm --no-deps allqbit-site node scripts/db-migrate.mjs
docker compose run --rm --no-deps allqbit-site node scripts/db-seed.mjs
```

`db-seed` переносит в базу тексты из `data/` и документы из `public/dox/files/`. Запускается
**только при первой установке**: повторный запуск существующие записи не меняет, но и смысла не
имеет. Флаг `--reset` очищает контентные таблицы — в процедуру обновления он не входит никогда.

### 5. Запуск

```bash
docker compose up -d
docker compose ps
docker compose logs -f allqbit-site
```

### 6. Проверка

```bash
curl -I https://allqbit.ru
curl -s https://allqbit.ru/robots.txt | head
```

Дальше — вручную в браузере: главная, `/products`, `/blog`, `/contacts`, `/documents`, вход в
`/login` и правка любого текста в `/admin` с проверкой, что изменение видно на сайте.

### 7. Автозапуск и копии

Автозапуск обеспечивает `restart: unless-stopped` в `compose.yml` — контейнер поднимется и после
перезагрузки сервера, и после падения процесса. Отдельный systemd-юнит не нужен.

Ежедневная резервная копия:

```bash
crontab -e
# добавить строку:
30 3 * * * /opt/allqbit/backup.sh >> /var/log/allqbit-backup.log 2>&1
```

---

## Обновление

### IndexNow

IndexNow использует один ключ для `allqbit.ru`. Сгенерируйте строку длиной 32-64 символа
из латинских букв, цифр и дефиса, создайте `public/<INDEXNOW_KEY>.txt` с одним только
ключом и укажите то же значение в `/opt/allqbit-data/production.env`:

```bash
INDEXNOW_KEY=<INDEXNOW_KEY>
INDEXNOW_HOST=allqbit.ru
INDEXNOW_ENDPOINT=https://api.indexnow.org/indexnow
```

После деплоя сначала проверьте файл подтверждения. Ответ должен содержать только ключ:

```bash
curl -fsS "https://allqbit.ru/${INDEXNOW_KEY}.txt"
```

Затем один раз отправьте текущие URL из production-контейнера. Скрипт сам проверяет
TXT-файл, ожидает 23 canonical URL в sitemap, проверяет пять постоянных legacy-редиректов,
удаляет дубликаты и завершится с ненулевым кодом при ошибке:

```bash
docker compose exec allqbit-site npm run indexnow:submit-current
```

Результат отправки проверяется в Bing Webmaster Tools в разделе IndexNow. Появление URL
может быть не мгновенным, а успешный приём не гарантирует индексацию. IndexNow сообщает
поисковику об изменениях и не заменяет `https://allqbit.ru/sitemap.xml`.

Автоматические уведомления выполняются сервером после успешного сохранения через `after()`.
Ошибка или таймаут IndexNow записываются в серверный лог, но не меняют ответ админского API.

```bash
cd /opt/allqbit && ./deploy.sh
```

Скрипт забирает код, пересобирает образ, применяет миграции и перезапускает контейнер, после чего
проверяет, что сайт отвечает. Образ собирается **до** остановки работающего сайта: если сборка
упадёт, текущая версия продолжит работать.

Простой при обновлении — секунды, пока подменяется контейнер.

---

## Если что-то пошло не так

**Сайт не отвечает, домен отдаёт 502.** Caddy не нашёл контейнер. Проверить, что он запущен и в
нужной сети:

```bash
docker compose ps
docker inspect allqbit-site --format '{{json .NetworkSettings.Networks}}'
```

**`readonly database` в журнале.** Сбились права на каталог данных:

```bash
chown -R 1001:1001 /opt/allqbit-data/var
docker compose restart allqbit-site
```

**Вход в админку отвечает «Вход не настроен».** Не заполнены `ADMIN_LOGIN`,
`ADMIN_PASSWORD_HASH` или `SESSION_SECRET` в `/opt/allqbit-data/production.env`.

**Слишком много попыток входа.** Счётчик хранится в базе и сбрасывается сам по истечении окна.
Смена `SESSION_SECRET` завершает все открытые сессии.

**Откат на предыдущую версию.**

```bash
cd /opt/allqbit
git log --oneline -10
git reset --hard <нужный коммит>
docker compose build && docker compose up -d --force-recreate
```

Откат кода не откатывает базу. Если нужно вернуть и содержимое, разверните архив из
`/opt/allqbit-data/backups`.

---

## Что осталось за рамками

- **Копии лежат на том же сервере.** От потери сервера это не спасает — нужна выгрузка наружу.
- **Восстановление из копии не проверялось на практике.** Пока это не сделано, копии остаются
  предположением, а не гарантией.
- **`Content-Security-Policy` содержит `'unsafe-inline'` для скриптов.** Причина и цена перехода
  на nonce описаны в `next.config.ts` и `PRE_RELEASE_CHECKLIST.md`.
- **Ограничение частоты запросов на уровне Caddy не настроено.** В приложении счётчик попыток
  входа есть, но поток запросов доходит до Node.
