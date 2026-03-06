# ---- Stage 1: Chef (dependency planner) ----
FROM rust:1-bookworm AS chef
RUN cargo install cargo-chef
WORKDIR /app

# ---- Stage 2: Prepare dependency recipe ----
FROM chef AS planner
COPY Cargo.toml Cargo.lock* ./
COPY src/ src/
RUN cargo chef prepare --recipe-path recipe.json

# ---- Stage 3: Build dependencies then compile ----
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY Cargo.toml Cargo.lock* ./
COPY src/ src/
RUN cargo build --release

# ---- Stage 4: Runtime ----
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/vocal-split .
COPY public/ ./public/

VOLUME ["/app/uploads", "/app/outputs"]
EXPOSE 3000

CMD ["./vocal-split"]
