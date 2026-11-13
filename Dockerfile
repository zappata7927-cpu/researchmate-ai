# ===== ResearchMate AI | پژوهش‌یار هوشمند — Production image =====
# Build:  docker build -t researchmate-ai .
# Run:    docker run -d -p 3000:3000 -v researchmate_data:/app/db \
#           -e AI_BASE_URL=... -e AI_API_KEY=... -e AI_MODEL=... researchmate-ai

FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# 1) Dependencies first (better layer caching)
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund && npx prisma generate

# 2) Build the app
COPY . .
RUN npm run build

# 3) Startup: ensure SQLite schema, then serve the standalone build
EXPOSE 3000
ENV HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATABASE_URL=file:./db/custom.db
VOLUME ["/app/db"]

CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node .next/standalone/server.js"]
