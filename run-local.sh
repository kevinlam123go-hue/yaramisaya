#!/bin/bash
# Run with: bash run-local.sh
set -e
PORT=${PORT:-3000}
# Build image
docker build -t yaramisaya:latest .
# Ensure data folder exists
mkdir -p data
# Run container (remove existing if present)
if [ $(docker ps -a -q -f name=yaramisaya) ]; then
  docker rm -f yaramisaya || true
fi

docker run -d --name yaramisaya -p ${PORT}:3000 -v $(pwd)/data:/usr/src/app/data yaramisaya:latest
echo "App running at http://localhost:${PORT}"
