-- FK opcional entre ministry_members e members
ALTER TABLE public.ministry_members
  ADD COLUMN IF NOT EXISTS member_id uuid
  REFERENCES public.members(id) ON DELETE SET NULL;
