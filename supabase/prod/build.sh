#!/usr/bin/env bash
# Genera supabase/prod/01_schema.sql a partir de supabase/migrations/*.sql.
# Uso: bash supabase/prod/build.sh
set -euo pipefail

cd "$(dirname "$0")/.."
out="prod/01_schema.sql"
files=(migrations/*.sql)

{
  echo "-- GENERADO por supabase/prod/build.sh. No editar a mano: edita supabase/migrations/ y regenera."
  echo "-- Pegar completo en el SQL Editor del proyecto de PRODUCCIÓN. Corre en una sola transacción."
  echo
  echo "begin;"
  for f in "${files[@]}"; do
    echo
    echo "-- ===== $(basename "$f") ====="
    cat "$f"
  done
  echo
  echo "-- ===== Historial de migraciones (alineado con el CLI de Supabase) ====="
  echo "create schema if not exists supabase_migrations;"
  echo "create table if not exists supabase_migrations.schema_migrations ("
  echo "  version    text not null primary key,"
  echo "  statements text[],"
  echo "  name       text"
  echo ");"
  echo "insert into supabase_migrations.schema_migrations (version, name) values"
  last=$((${#files[@]} - 1))
  for i in "${!files[@]}"; do
    base="$(basename "${files[$i]}" .sql)"
    sep=","
    [ "$i" -eq "$last" ] && sep=""
    echo "  ('${base%%_*}', '${base#*_}')${sep}"
  done
  echo "on conflict (version) do nothing;"
  echo
  echo "commit;"
} > "$out"

echo "Generado $out con ${#files[@]} migraciones."
