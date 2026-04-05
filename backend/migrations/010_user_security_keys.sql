-- Per-user symmetric keys used by the app/security-service flow.
-- One active key per user.

CREATE TABLE IF NOT EXISTS public.user_security_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    symmetric_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_security_keys_user_id
    ON public.user_security_keys(user_id);

CREATE OR REPLACE FUNCTION public.touch_user_security_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_security_keys_updated_at
    ON public.user_security_keys;

CREATE TRIGGER trg_user_security_keys_updated_at
BEFORE UPDATE ON public.user_security_keys
FOR EACH ROW
EXECUTE FUNCTION public.touch_user_security_keys_updated_at();
