-- Tabela de tipos de evento gerenciáveis por igreja
CREATE TABLE public.event_types (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id  uuid        NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_types_select ON public.event_types FOR SELECT
  USING (church_id = (SELECT church_id FROM get_my_profile()));

CREATE POLICY event_types_insert ON public.event_types FOR INSERT
  WITH CHECK (
    church_id = (SELECT church_id FROM get_my_profile())
    AND (SELECT role FROM get_my_profile()) IN ('admin', 'super_admin')
  );

CREATE POLICY event_types_update ON public.event_types FOR UPDATE
  USING (
    church_id = (SELECT church_id FROM get_my_profile())
    AND (SELECT role FROM get_my_profile()) IN ('admin', 'super_admin')
  );

CREATE POLICY event_types_delete ON public.event_types FOR DELETE
  USING (
    church_id = (SELECT church_id FROM get_my_profile())
    AND (SELECT role FROM get_my_profile()) IN ('admin', 'super_admin')
  );

-- FK em events (nullable para não quebrar eventos existentes)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type_id uuid
  REFERENCES public.event_types(id) ON DELETE SET NULL;

-- Seed: 14 tipos para a igreja Poiema Blumenau
INSERT INTO public.event_types (church_id, name) VALUES
  ('8db14705-9da8-4844-8b01-a73845297831', 'Culto'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Batismo'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Influa'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Base'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Zadok Music Bnu'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Zadok Local'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Reunião de Liderança'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Reunião de Ministérios'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Curso de Noivos'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Welcome Coffee'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Curso de Finanças'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Bereanos'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Timothy'),
  ('8db14705-9da8-4844-8b01-a73845297831', 'Leadersheep');
