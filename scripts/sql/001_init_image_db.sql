-- Initial schema for API clients and image generation tracking.
-- Safe to run multiple times thanks to IF NOT EXISTS / ON CONFLICT.

CREATE TABLE IF NOT EXISTS api_clients (
    -- Logical identifier for the client, e.g. 'admin', 'web', 'partner_x'.
    id            TEXT PRIMARY KEY,
    display_name  TEXT NOT NULL,
    role          TEXT NOT NULL,           -- e.g. 'admin' | 'first_party' | 'third_party'
    api_key_hash  TEXT NOT NULL,           -- SHA-256 of the raw API key
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_clients_key_hash
    ON api_clients (api_key_hash);


CREATE TABLE IF NOT EXISTS image_generation_batches (
    -- Batch identifier. For the web UI this should match metadata.batch_id (UUID string).
    id                  UUID PRIMARY KEY,

    -- Which API client triggered this batch (may be NULL for anonymous / local usage).
    api_client_id       TEXT REFERENCES api_clients (id),

    -- Optional label for the caller (e.g. user id); currently unused.
    caller_label        TEXT,

    -- Shared generation parameters for this batch.
    prompt              TEXT NOT NULL,
    negative_prompt     TEXT,
    width               INTEGER NOT NULL,
    height              INTEGER NOT NULL,
    num_inference_steps INTEGER NOT NULL,
    guidance_scale      DOUBLE PRECISION NOT NULL,
    base_seed           BIGINT,
    batch_size          INTEGER NOT NULL,

    -- Aggregated status across all tasks in this batch.
    status              TEXT NOT NULL DEFAULT 'pending', -- pending | running | success | partial | error | cancelled
    success_count       INTEGER NOT NULL DEFAULT 0,
    failed_count        INTEGER NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,

    -- Extra configuration payload (model variant, device info, etc.).
    metadata            JSONB
);

CREATE INDEX IF NOT EXISTS idx_image_generation_batches_client_created
    ON image_generation_batches (api_client_id, created_at DESC);


CREATE TABLE IF NOT EXISTS image_generation_tasks (
    -- Celery task id for this generation.
    task_id               TEXT PRIMARY KEY,

    -- Batch information.
    batch_id              UUID NOT NULL REFERENCES image_generation_batches (id) ON DELETE CASCADE,
    batch_index           INTEGER NOT NULL,
    seed                  BIGINT,

    -- Per-image status.
    status                TEXT NOT NULL, -- pending | running | success | error | cancelled
    error_code            TEXT,
    error_hint            TEXT,
    error_message         TEXT,

    -- Actual generation parameters used for this image.
    prompt                TEXT NOT NULL,
    negative_prompt       TEXT,
    width                 INTEGER NOT NULL,
    height                INTEGER NOT NULL,
    num_inference_steps   INTEGER NOT NULL,
    guidance_scale        DOUBLE PRECISION NOT NULL,
    cfg_normalization     BOOLEAN,
    cfg_truncation        DOUBLE PRECISION,
    max_sequence_length   INTEGER,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at           TIMESTAMPTZ,

    -- File paths for the generated image.
    image_id              TEXT,
    output_path           TEXT,
    preview_path          TEXT,
    relative_path         TEXT,
    preview_relative_path TEXT,

    metadata              JSONB
);

CREATE INDEX IF NOT EXISTS idx_image_generation_tasks_batch
    ON image_generation_tasks (batch_id, batch_index);

CREATE INDEX IF NOT EXISTS idx_image_generation_tasks_status
    ON image_generation_tasks (status);

