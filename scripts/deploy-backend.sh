#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

set -a
. ./.env
set +a

docker compose --profile healthy up -d mysql

mysql_ready=0
for _ in {1..30}; do
  if docker compose --profile healthy exec -T mysql mysqladmin ping -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --silent; then
    mysql_ready=1
    break
  fi
  sleep 2
done

if [[ "$mysql_ready" != "1" ]]; then
  echo "MySQL did not become ready in time" >&2
  exit 1
fi

docker compose --profile healthy exec -T mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" <<'SQL'
CREATE TABLE IF NOT EXISTS legacy_student (
  s_id int NOT NULL,
  first_name varchar(40) NOT NULL,
  last_name varchar(40) NOT NULL,
  birth_date date NOT NULL,
  email varchar(100) NOT NULL,
  PRIMARY KEY (s_id)
);

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'legacy_student'
     AND column_name = 'birth_date') = 0,
  'ALTER TABLE legacy_student ADD COLUMN birth_date date NOT NULL DEFAULT ''2000-01-01''',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'legacy_student'
     AND column_name = 'email') = 0,
  'ALTER TABLE legacy_student ADD COLUMN email varchar(100) NOT NULL DEFAULT ''''',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO legacy_student (s_id, first_name, last_name, birth_date, email) VALUES
  (9001, 'Alice', 'Legacy', '2000-03-21', 'alice.legacy@gmail.com'),
  (9002, 'Bob', 'Legacy', '2001-07-14', 'bob.legacy@gmail.com'),
  (9003, 'Carol', 'Legacy', '2002-11-30', 'carol.legacy@gmail.com')
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  birth_date = VALUES(birth_date),
  email = VALUES(email);
SQL

docker compose --profile healthy stop teiid ontop-teiid || true
docker compose --profile healthy rm -f teiid || true

project="$(basename "$PWD")"
docker volume rm "${project}_teiid-standalone-configuration" "${project}_teiid-domain-configuration" || true

docker compose --profile healthy --profile shared up -d --build
