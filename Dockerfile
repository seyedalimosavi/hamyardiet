FROM node:22-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# No external database needed at build time: SQLite file is created on first request.
RUN npm run build
ENV NODE_ENV=production
# Keep the SQLite database on a volume so data survives container replacement.
ENV SQLITE_DB_PATH=/app/dietdata/diet.sqlite
RUN mkdir -p /app/dietdata
VOLUME /app/dietdata
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
