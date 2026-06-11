#!/bin/sh
set -e

# Apply any pending database migrations before starting the API.
# `migrate deploy` only applies committed migrations (no schema drift / no prompts).
npx prisma migrate deploy

# Hand over to the container command (CMD): start the API server.
exec "$@"
