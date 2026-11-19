-- Remove registros sem vínculo com membro cadastrado (73 registros legados)
-- e torna member_id NOT NULL (obrigatório)
DELETE FROM public.ministry_members WHERE member_id IS NULL;
ALTER TABLE public.ministry_members ALTER COLUMN member_id SET NOT NULL;
