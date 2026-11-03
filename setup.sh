#!/bin/bash
# =============================================================
# CimHeritage – Setup Script
# Jalankan: chmod +x setup.sh && ./setup.sh
# =============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

banner() {
  echo ""
  echo -e "${GREEN}${BOLD}================================================${NC}"
  echo -e "${GREEN}${BOLD}  🏛  CimHeritage WebGIS Setup${NC}"
  echo -e "${GREEN}${BOLD}  Sistem Cagar Budaya Kota Cimahi${NC}"
  echo -e "${GREEN}${BOLD}================================================${NC}"
  echo ""
}

check_deps() {
  echo -e "${BLUE}[1/5] Memeriksa dependencies...${NC}"
  for cmd in node npm psql; do
    if ! command -v $cmd &> /dev/null; then
      echo -e "${RED}✗ $cmd tidak ditemukan. Install terlebih dahulu.${NC}"
      [ "$cmd" = "node" ] && echo "    → https://nodejs.org (versi 18+)"
      [ "$cmd" = "psql" ] && echo "    → https://www.postgresql.org/download/"
      exit 1
    else
      echo -e "${GREEN}✓ $cmd: $(${cmd} --version 2>&1 | head -1)${NC}"
    fi
  done
}

setup_backend() {
  echo ""
  echo -e "${BLUE}[2/5] Setup Backend (NestJS)...${NC}"
  cd backend

  # Copy env if not exists
  if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}  → .env dibuat dari .env.example${NC}"
    echo -e "${YELLOW}  → Edit backend/.env sesuai konfigurasi database Anda${NC}"
  fi

  echo "  → npm install..."
  npm install --legacy-peer-deps --silent

  cd ..
  echo -e "${GREEN}✓ Backend siap${NC}"
}

setup_frontend() {
  echo ""
  echo -e "${BLUE}[3/5] Setup Frontend (Next.js)...${NC}"
  cd frontend

  if [ ! -f .env.local ]; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api" > .env.local
    echo -e "${YELLOW}  → .env.local dibuat${NC}"
  fi

  echo "  → npm install..."
  npm install --legacy-peer-deps --silent

  cd ..
  echo -e "${GREEN}✓ Frontend siap${NC}"
}

setup_database() {
  echo ""
  echo -e "${BLUE}[4/5] Setup Database PostgreSQL...${NC}"

  # Load env
  source backend/.env 2>/dev/null || true
  DB_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/cimahiheritage}"

  # Extract DB name
  DB_NAME=$(echo $DB_URL | sed 's/.*\///')
  DB_USER=$(echo $DB_URL | sed 's/postgresql:\/\///' | sed 's/:.*$//')

  echo "  → Membuat database '$DB_NAME' jika belum ada..."
  createdb "$DB_NAME" 2>/dev/null && echo -e "${GREEN}  ✓ Database '$DB_NAME' dibuat${NC}" || echo -e "${YELLOW}  ℹ Database '$DB_NAME' sudah ada${NC}"

  echo -e "${GREEN}✓ Database siap${NC}"
}

seed_database() {
  echo ""
  echo -e "${BLUE}[5/5] Menjalankan seed data (75 situs cagar budaya)...${NC}"
  cd backend
  npm run seed 2>&1 | tail -10
  cd ..
  echo -e "${GREEN}✓ Seed selesai${NC}"
}

print_instructions() {
  echo ""
  echo -e "${GREEN}${BOLD}================================================${NC}"
  echo -e "${GREEN}${BOLD}  ✅ Setup berhasil!${NC}"
  echo -e "${GREEN}${BOLD}================================================${NC}"
  echo ""
  echo -e "${BOLD}Cara menjalankan:${NC}"
  echo ""
  echo -e "  ${BLUE}Terminal 1 – Backend:${NC}"
  echo "    cd backend && npm run start:dev"
  echo ""
  echo -e "  ${BLUE}Terminal 2 – Frontend:${NC}"
  echo "    cd frontend && npm run dev"
  echo ""
  echo -e "${BOLD}URL:${NC}"
  echo -e "  🌐 Frontend : ${GREEN}http://localhost:3000${NC}"
  echo -e "  🔌 Backend  : ${GREEN}http://localhost:3001/api${NC}"
  echo -e "  🗺 Peta GIS : ${GREEN}http://localhost:3000/peta${NC}"
  echo -e "  ⚙ Admin    : ${GREEN}http://localhost:3000/admin${NC}"
  echo ""
  echo -e "${BOLD}Admin login:${NC}"
  echo -e "  📧 Email    : admin@cimahiheritage.id"
  echo -e "  🔑 Password : admin123"
  echo ""
  echo -e "${BOLD}API Endpoints utama:${NC}"
  echo "  GET  /api/heritage/geojson       → GeoJSON peta"
  echo "  GET  /api/heritage?search=...    → Daftar situs"
  echo "  POST /api/routing/optimize       → Dijkstra multi-destinasi"
  echo "  POST /api/bookings               → Buat pemesanan"
  echo "  GET  /api/bookings/stats         → Statistik booking"
  echo ""
}

banner
check_deps
setup_backend
setup_frontend
setup_database
seed_database
print_instructions
