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
DROP TABLE IF EXISTS legacy_student;
CREATE TABLE IF NOT EXISTS student_unmapped (
  s_id int NOT NULL,
  first_name varchar(40) NOT NULL,
  last_name varchar(40) NOT NULL,
  birth_date date NULL,
  email varchar(100) NULL,
  PRIMARY KEY (s_id)
);
SQL

docker compose --profile healthy stop teiid ontop-teiid || true
docker compose --profile healthy rm -f teiid || true

project="$(basename "$PWD")"
docker volume rm "${project}_teiid-standalone-configuration" "${project}_teiid-domain-configuration" || true

docker compose --profile healthy --profile shared up -d --build
