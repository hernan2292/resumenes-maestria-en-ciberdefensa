# Build reproducible y sin depender de acceso a proxy.golang.org en el
# momento del build: vendor/ ya trae todas las dependencias (ver
# vendor_from_apt.sh), así que "go build" detecta el modo vendor
# automáticamente a partir de go.mod (go >= 1.22) + vendor/modules.txt.
FROM golang:1.22-bookworm AS build
WORKDIR /src
COPY go.mod ./
COPY vendor/ vendor/
COPY cmd/ cmd/
COPY internal/ internal/
RUN CGO_ENABLED=0 go build -o /out/osa-api ./cmd/api

# Runtime: debian-slim en vez de distroless/scratch a propósito — este
# servidor es "custodio ciego" de datos médicos y en producción alguien
# eventualmente va a necesitar poder hacer `docker exec` para inspeccionar
# el proceso (logs, healthcheck manual, etc.); el costo de unos MB extra de
# imagen se paga solo la primera vez que hace falta debuggear en caliente.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --system --no-create-home --shell /usr/sbin/nologin osa
WORKDIR /app
COPY --from=build /out/osa-api ./osa-api
COPY migrations/ ./migrations
ENV MIGRATIONS_DIR=/app/migrations
USER osa
EXPOSE 8080
ENTRYPOINT ["/app/osa-api"]
