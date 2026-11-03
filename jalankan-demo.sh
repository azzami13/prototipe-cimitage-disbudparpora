#!/bin/sh
cd "$(dirname "$0")/frontend"
[ -d node_modules ] || npm install
[ -d .next ] || npm run build
npm start
