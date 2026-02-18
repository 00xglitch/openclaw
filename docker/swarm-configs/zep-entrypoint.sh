#!/bin/sh
# Inject secret into Zep config at runtime
set -e
ZEP_PASS=$(cat /run/secrets/zep_db_password)
sed "s/__ZEP_DB_PASSWORD__/${ZEP_PASS}/g" /app/config.yaml.template > /app/config.yaml
exec /app/zep
