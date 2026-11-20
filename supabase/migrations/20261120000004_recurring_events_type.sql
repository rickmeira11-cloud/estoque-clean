-- Permite associar um tipo de evento a cada regra recorrente, pra que
-- os eventos gerados pelo job saiam com event_type_id preenchido.
ALTER TABLE public.recurring_events
  ADD COLUMN IF NOT EXISTS event_type_id uuid REFERENCES public.event_types(id) ON DELETE SET NULL;
