-- F-D: Campos customizados por tipo de evento + anexos

-- Definição dos campos customizados de cada tipo de evento
CREATE TABLE public.event_type_fields (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id uuid        NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  field_key     text        NOT NULL,
  label         text        NOT NULL,
  field_type    text        NOT NULL CHECK (field_type IN ('number','text','textarea','boolean','date','member_relation')),
  is_required   boolean     NOT NULL DEFAULT false,
  sort_order    int         NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_type_id, field_key)
);

ALTER TABLE public.event_type_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_type_fields_select ON public.event_type_fields FOR SELECT
  USING (event_type_id IN (
    SELECT et.id FROM public.event_types et
    WHERE et.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
  ));

CREATE POLICY event_type_fields_insert ON public.event_type_fields FOR INSERT
  WITH CHECK (
    event_type_id IN (
      SELECT et.id FROM public.event_types et
      WHERE et.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

CREATE POLICY event_type_fields_update ON public.event_type_fields FOR UPDATE
  USING (
    event_type_id IN (
      SELECT et.id FROM public.event_types et
      WHERE et.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_type_fields TO authenticated;
GRANT SELECT ON TABLE public.event_type_fields TO anon;
GRANT ALL ON TABLE public.event_type_fields TO service_role;

-- Valores escalares dos campos customizados por evento
CREATE TABLE public.event_field_values (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  field_id      uuid        NOT NULL REFERENCES public.event_type_fields(id) ON DELETE CASCADE,
  value_text    text,
  value_number  numeric,
  value_boolean boolean,
  value_date    date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, field_id)
);

ALTER TABLE public.event_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_field_values_select ON public.event_field_values FOR SELECT
  USING (event_id IN (
    SELECT e.id FROM public.events e
    WHERE e.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
  ));

CREATE POLICY event_field_values_insert ON public.event_field_values FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

CREATE POLICY event_field_values_update ON public.event_field_values FOR UPDATE
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

CREATE POLICY event_field_values_delete ON public.event_field_values FOR DELETE
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_field_values TO authenticated;
GRANT SELECT ON TABLE public.event_field_values TO anon;
GRANT ALL ON TABLE public.event_field_values TO service_role;

-- Relação de membros vinculados a campos do tipo member_relation
CREATE TABLE public.event_field_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  field_id   uuid        NOT NULL REFERENCES public.event_type_fields(id) ON DELETE CASCADE,
  member_id  uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, field_id, member_id)
);

ALTER TABLE public.event_field_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_field_members_select ON public.event_field_members FOR SELECT
  USING (event_id IN (
    SELECT e.id FROM public.events e
    WHERE e.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
  ));

CREATE POLICY event_field_members_insert ON public.event_field_members FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

CREATE POLICY event_field_members_delete ON public.event_field_members FOR DELETE
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_field_members TO authenticated;
GRANT SELECT ON TABLE public.event_field_members TO anon;
GRANT ALL ON TABLE public.event_field_members TO service_role;

-- Anexos genéricos de evento (ata, comprovantes, etc.)
CREATE TABLE public.event_attachments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  file_url    text        NOT NULL,
  file_name   text        NOT NULL,
  file_size   bigint,
  uploaded_by uuid        REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_attachments_select ON public.event_attachments FOR SELECT
  USING (event_id IN (
    SELECT e.id FROM public.events e
    WHERE e.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
  ));

CREATE POLICY event_attachments_insert ON public.event_attachments FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

CREATE POLICY event_attachments_delete ON public.event_attachments FOR DELETE
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id IN (SELECT church_id FROM public.user_churches WHERE user_id = auth.uid() AND is_active = true)
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_attachments TO authenticated;
GRANT SELECT ON TABLE public.event_attachments TO anon;
GRANT ALL ON TABLE public.event_attachments TO service_role;

-- Bucket de storage para anexos de evento (mesmo padrão já usado em
-- ministry-photos / patrimonio-nfe: bucket público, isolamento por path
-- ${church_id}/... feito na aplicação, não em RLS de storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-attachments', 'event-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY event_attachments_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-attachments');

CREATE POLICY event_attachments_storage_select ON storage.objects FOR SELECT
  USING (bucket_id = 'event-attachments');

CREATE POLICY event_attachments_storage_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'event-attachments');
