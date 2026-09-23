# Build from the repository root: docker build -f worker/Dockerfile .
FROM node:24-slim

# PDF text extraction (poppler) and OCR for scanned pages (Tesseract, Spanish).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates poppler-utils tesseract-ocr tesseract-ocr-spa \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

# Install only the worker's dependencies from the workspace lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY worker/package.json worker/
RUN pnpm install --frozen-lockfile --filter ./worker

# Shared modules the worker imports through the "@/..." alias. They must not
# import packages: only the worker's dependencies are installed in this image.
COPY types ./types
COPY lib/ai ./lib/ai
COPY worker ./worker

WORKDIR /app/worker
ENV NODE_ENV=production

# node as PID 1 receives SIGTERM directly, so in-flight jobs finish on deploys.
CMD ["node", "--import", "tsx", "src/main.ts"]
