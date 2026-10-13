-- Remove public/anonymous access from application data and expose only the
-- authenticated operations required by the application.

REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE USAGE ON SCHEMA public FROM PUBLIC, anon;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Future objects created by postgres must not become accessible by default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Keep row-level security enabled even on tables that are only used by Prisma.
ALTER TABLE public.boletas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletas_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletas_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensaje_destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_normalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_minimo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- This helper reads the application's role-permission mapping as the table
-- owner, avoiding recursive RLS checks from policies that need authorization.
CREATE OR REPLACE FUNCTION public.has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS u
    JOIN public.role_permissions AS rp ON rp.role_id = u.role_id
    JOIN public.permissions AS p ON p.id = rp.permission_id
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND p.name = p_permission
  );
$function$;

ALTER FUNCTION public.has_permission(text) OWNER TO postgres;
REVOKE ALL PRIVILEGES ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_message_sender(p_message_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.mensajes AS m
    WHERE m.id = p_message_id
      AND m.remitente_id = auth.uid()
  );
$function$;

ALTER FUNCTION public.is_message_sender(bigint) OWNER TO postgres;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_message_sender(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_message_sender(bigint) TO authenticated;

CREATE POLICY p_sender_reads_recipients ON public.mensaje_destinatarios
  FOR SELECT TO authenticated
  USING (public.is_message_sender(mensaje_id));

-- Business analytics are available only to roles that have an appropriate
-- dashboard, analytics, ranking, or pharmacy permission.
CREATE POLICY p_read_boletas ON public.boletas
  FOR SELECT TO authenticated
  USING (
    public.has_permission('dashboard.read')
    OR public.has_permission('analytics.read')
    OR public.has_permission('ranking.read')
    OR public.has_permission('pharmacy.read')
  );

CREATE POLICY p_read_boletas_detalles ON public.boletas_detalles
  FOR SELECT TO authenticated
  USING (
    public.has_permission('dashboard.read')
    OR public.has_permission('analytics.read')
    OR public.has_permission('ranking.read')
    OR public.has_permission('pharmacy.read')
  );

CREATE POLICY p_read_boletas_pagos ON public.boletas_pagos
  FOR SELECT TO authenticated
  USING (
    public.has_permission('dashboard.read')
    OR public.has_permission('analytics.read')
    OR public.has_permission('pharmacy.read')
  );

CREATE POLICY p_read_suppliers ON public.providers
  FOR SELECT TO authenticated
  USING (
    public.has_permission('proveedores.read')
    OR public.has_permission('proveedores.write')
  );

CREATE POLICY p_read_products ON public.products
  FOR SELECT TO authenticated
  USING (
    public.has_permission('proveedores.read')
    OR public.has_permission('proveedores.write')
  );

CREATE POLICY p_read_provider_prices ON public.provider_prices
  FOR SELECT TO authenticated
  USING (
    public.has_permission('proveedores.read')
    OR public.has_permission('proveedores.write')
  );

CREATE POLICY p_insert_suppliers ON public.providers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('proveedores.write'));

CREATE POLICY p_update_suppliers ON public.providers
  FOR UPDATE TO authenticated
  USING (public.has_permission('proveedores.write'))
  WITH CHECK (public.has_permission('proveedores.write'));

CREATE POLICY p_delete_suppliers ON public.providers
  FOR DELETE TO authenticated
  USING (public.has_permission('proveedores.write'));

CREATE POLICY p_insert_products ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('proveedores.write'));

CREATE POLICY p_update_products ON public.products
  FOR UPDATE TO authenticated
  USING (public.has_permission('proveedores.write'))
  WITH CHECK (public.has_permission('proveedores.write'));

CREATE POLICY p_insert_provider_prices ON public.provider_prices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('proveedores.write'));

CREATE POLICY p_update_provider_prices ON public.provider_prices
  FOR UPDATE TO authenticated
  USING (public.has_permission('proveedores.write'))
  WITH CHECK (public.has_permission('proveedores.write'));

CREATE POLICY p_delete_provider_prices ON public.provider_prices
  FOR DELETE TO authenticated
  USING (public.has_permission('proveedores.write'));

-- Authenticated users may find active coworkers for internal messaging.
CREATE POLICY p_read_active_users ON public.users
  FOR SELECT TO authenticated
  USING (is_active = true OR id = auth.uid());

CREATE POLICY p_read_active_user_profiles ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users AS u
      WHERE u.id = user_profiles.user_id
        AND u.is_active = true
    )
  );

-- Read access is column-limited so receipt identifiers and tax/customer fields
-- (for example rut, pdf, xml, and trackid) are not exposed through PostgREST.
GRANT SELECT (folio, fecha, sucursal_id, montoneto)
  ON public.boletas TO authenticated;
GRANT SELECT (id, boleta_folio, item_index, codigo, nombre, cantidad, unidad, precio, descuento, exento, bodega)
  ON public.boletas_detalles TO authenticated;
GRANT SELECT (id) ON public.boletas_pagos TO authenticated;

GRANT SELECT (id, email, is_active) ON public.users TO authenticated;
GRANT SELECT (user_id, first_name, last_name) ON public.user_profiles TO authenticated;

GRANT SELECT ON public.providers TO authenticated;
GRANT INSERT (name) ON public.providers TO authenticated;
GRANT UPDATE (name, created_at) ON public.providers TO authenticated;
GRANT DELETE ON public.providers TO authenticated;

GRANT SELECT ON public.products TO authenticated;
GRANT INSERT (ean, fingerprint, name, active_ingredient)
  ON public.products TO authenticated;
GRANT UPDATE (ean, fingerprint, name, active_ingredient)
  ON public.products TO authenticated;

GRANT SELECT ON public.provider_prices TO authenticated;
GRANT INSERT (product_id, provider_id, price, last_updated_at)
  ON public.provider_prices TO authenticated;
GRANT UPDATE (product_id, provider_id, price, last_updated_at)
  ON public.provider_prices TO authenticated;
GRANT DELETE ON public.provider_prices TO authenticated;

GRANT SELECT (id, remitente_id, asunto, cuerpo, created_at)
  ON public.mensajes TO authenticated;
GRANT INSERT (remitente_id, asunto, cuerpo)
  ON public.mensajes TO authenticated;
GRANT SELECT (id, mensaje_id, destinatario_id, read_at, archived_at, deleted_at)
  ON public.mensaje_destinatarios TO authenticated;
GRANT INSERT (mensaje_id, destinatario_id)
  ON public.mensaje_destinatarios TO authenticated;
GRANT UPDATE (read_at, archived_at, deleted_at)
  ON public.mensaje_destinatarios TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE public.mensajes_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.mensaje_destinatarios_id_seq TO authenticated;

-- Keep dashboard RPCs used by the application, but do not expose internal
-- helpers or the SECURITY DEFINER catalog replacement function to clients.
GRANT EXECUTE ON FUNCTION public.get_metricas_dashboard(date, date, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_productos_agregados(date, date, integer, integer)
  TO authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.calculate_product_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.createfingerprint(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.replace_provider_catalog(text, public.product_upload[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_provider_catalog(text, public.product_upload[])
  TO service_role;
ALTER FUNCTION public.replace_provider_catalog(text, public.product_upload[])
  SET search_path = pg_catalog, public;
