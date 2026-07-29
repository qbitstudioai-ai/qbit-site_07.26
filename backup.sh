#!/usr/bin/env bash
#
# Резервная копия данных админ-панели: база контента и загруженные документы.
#
# Запуск вручную:      /opt/allqbit/backup.sh
# Ежедневно в 3:30:    30 3 * * * /opt/allqbit/backup.sh >> /var/log/allqbit-backup.log 2>&1
#
# База и файлы копируются ВМЕСТЕ и в один архив намеренно: по отдельности они бесполезны — база
# ссылается на файлы по именам, файлы без базы не отображаются нигде.

set -euo pipefail

DATA_DIR="/opt/allqbit-data"
BACKUP_DIR="${DATA_DIR}/backups"
KEEP_DAYS=30
STAMP="$(date +%Y%m%d-%H%M%S)"
WORK_DIR="$(mktemp -d)"

trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p "$BACKUP_DIR"

# ─── База ──────────────────────────────────────────────────────────────────────────────────────
#
# Обычный `cp` работающей базы даёт непоследовательный снимок: SQLite в режиме WAL держит часть
# свежих записей в отдельном файле, и копия может оказаться нерабочей. `VACUUM INTO` создаёт
# целостную копию прямо из работающей базы, не останавливая сайт.

if [ ! -f "${DATA_DIR}/var/content.db" ]; then
  echo "Базы ${DATA_DIR}/var/content.db нет — копировать нечего." >&2
  exit 1
fi

node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('${DATA_DIR}/var/content.db', { readOnly: true });
  db.exec(\"VACUUM INTO '${WORK_DIR}/content.db'\");
  db.close();
"

# ─── Файлы ─────────────────────────────────────────────────────────────────────────────────────

cp -a "${DATA_DIR}/var/uploads" "${WORK_DIR}/uploads"

# ─── Архив ─────────────────────────────────────────────────────────────────────────────────────

ARCHIVE="${BACKUP_DIR}/allqbit-${STAMP}.tar.gz"
tar -czf "$ARCHIVE" -C "$WORK_DIR" content.db uploads
chmod 600 "$ARCHIVE"

echo "Копия: ${ARCHIVE} ($(du -h "$ARCHIVE" | cut -f1))"

# ─── Уборка старых копий ───────────────────────────────────────────────────────────────────────

find "$BACKUP_DIR" -name 'allqbit-*.tar.gz' -mtime "+${KEEP_DAYS}" -delete

# ─── Честное предупреждение ────────────────────────────────────────────────────────────────────
#
# Копия на том же диске защищает от ошибки оператора, но не от потери сервера. Это осознанный
# минимум, а не полноценное резервное копирование.

echo "ВНИМАНИЕ: копии лежат на этом же сервере. Настройте выгрузку ${BACKUP_DIR} наружу."
