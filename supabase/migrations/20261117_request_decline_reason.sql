-- Apply manually to the StageLink Participant database after staging verification.
-- Existing declined requests retain NULL; no existing rows are deleted or rewritten.
BEGIN;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS decline_reason text;
-- NOT VALID preserves historical declines without reasons, while enforcing new writes.
ALTER TABLE public.requests ADD CONSTRAINT requests_decline_reason_required
  CHECK (status IS DISTINCT FROM 'declined' OR
    (decline_reason IS NOT NULL AND decline_reason ~ '[^[:space:]　]')) NOT VALID;
COMMIT;
