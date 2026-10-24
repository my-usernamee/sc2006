#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci
npm run install:all
npm run db:deploy
npm run dev
