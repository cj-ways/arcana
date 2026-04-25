CREATE TABLE invoice_jobs (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
