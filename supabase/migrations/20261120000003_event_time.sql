-- Adiciona horário a eventos pontuais e a regras de eventos recorrentes
ALTER TABLE public.events           ADD COLUMN IF NOT EXISTS event_time time;
ALTER TABLE public.recurring_events ADD COLUMN IF NOT EXISTS event_time time;
