FROM node:24-bookworm-slim AS web
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-bookworm AS backend
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -o /out/server ./cmd/server && \
    CGO_ENABLED=0 go build -trimpath -o /out/worker ./cmd/worker

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl poppler-utils && \
    rm -rf /var/lib/apt/lists/* && useradd --uid 10001 --create-home volt && \
    mkdir -p /app/data/uploads && chown -R volt:volt /app
WORKDIR /app
COPY --from=backend /out/ /app/
COPY --from=web /src/frontend/dist /app/web
USER volt
ENV HTTP_ADDR=0.0.0.0:8080 STATIC_DIR=/app/web UPLOAD_DIR=/app/data/uploads
EXPOSE 8080
CMD ["/app/server"]
