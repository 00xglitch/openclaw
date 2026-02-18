#!/bin/sh
# Inject secret into Qdrant config at runtime
set -e
QDRANT_KEY=$(cat /run/secrets/qdrant_api_key)
sed "s/__QDRANT_API_KEY__/${QDRANT_KEY}/g" /qdrant/config/production.yaml.template > /qdrant/config/production.yaml
exec ./qdrant
