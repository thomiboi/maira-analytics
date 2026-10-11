


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."product_upload" AS (
	"ean" "text",
	"productname" "text",
	"price" numeric,
	"activeingredient" "text"
);


ALTER TYPE "public"."product_upload" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_product_stats"() RETURNS TABLE("products_with_multiple_suppliers" integer, "avg_price_difference" numeric, "avg_price_difference_percentage" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH price_stats AS (
    -- 1️⃣ Agrupar precios por producto y calcular estadísticas básicas
    SELECT 
      product_id,
      COUNT(*) as supplier_count,
      MIN(price) as min_price,
      MAX(price) as max_price,
      (MAX(price) - MIN(price)) as price_difference
    FROM 
      provider_prices
    GROUP BY 
      product_id
    HAVING 
      COUNT(*) > 1  -- Solo productos con múltiples proveedores
  ),
  aggregated_stats AS (
    -- 2️⃣ Calcular estadísticas agregadas
    SELECT
      COUNT(*)::INTEGER as products_count,
      AVG(price_difference)::NUMERIC as avg_diff,
      AVG(
        CASE 
          WHEN min_price > 0 THEN (price_difference / min_price * 100)
          ELSE 0
        END
      )::NUMERIC as avg_diff_percentage
    FROM 
      price_stats
  )
  -- 3️⃣ Retornar los resultados finales
  SELECT 
    products_count,
    ROUND(avg_diff, 2) as avg_price_difference,
    ROUND(avg_diff_percentage, 2) as avg_price_difference_percentage
  FROM 
    aggregated_stats;
END;
$$;


ALTER FUNCTION "public"."calculate_product_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_product_stats"() IS 'Calcula estadísticas agregadas de productos con múltiples proveedores: 
conteo de productos, diferencia promedio de precios (absoluta y porcentual)';



CREATE OR REPLACE FUNCTION "public"."createfingerprint"("p_name" "text", "p_active_ingredient" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT regexp_replace(
    lower(concat(p_name, p_active_ingredient)),
    '[^a-z0-9]', -- Expresión regular: "todo lo que NO sea una letra de la a-z o un número del 0-9"
    '', -- Reemplázalo con "nada" (es decir, elimínalo)
    'g' -- 'g' significa "global", para que reemplace todas las ocurrencias, no solo la primera
  );
$$;


ALTER FUNCTION "public"."createfingerprint"("p_name" "text", "p_active_ingredient" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_metricas_dashboard"("p_start_date" "date" DEFAULT '2020-01-01'::"date", "p_end_date" "date" DEFAULT '2099-12-31'::"date", "p_sucursal_id" integer DEFAULT NULL::integer) RETURNS TABLE("total_documentos" bigint, "total_ingresos" numeric, "ticket_promedio" numeric, "total_productos" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH boletas_filtradas AS (
        SELECT b.folio, b.montoneto, b.sucursal_id
        FROM boletas b
        WHERE b.fecha >= p_start_date 
          AND b.fecha <= p_end_date
          AND (
            (p_sucursal_id IS NULL AND b.sucursal_id IS NULL)  -- solo matriz
            OR (b.sucursal_id = p_sucursal_id)                 -- sucursal específica
            OR (p_sucursal_id = 0)                             -- todas las sucursales
          )
    )
    SELECT 
        COUNT(*) AS total_documentos,
        COALESCE(SUM(montoneto), 0) AS total_ingresos,
        CASE 
            WHEN COUNT(*) > 0 THEN COALESCE(SUM(montoneto), 0) / COUNT(*)
            ELSE 0 
        END AS ticket_promedio,
        (
            SELECT COUNT(DISTINCT bd.codigo)
            FROM boletas_detalles bd
            JOIN boletas_filtradas bf ON bf.folio = bd.boleta_folio
        ) AS total_productos
    FROM boletas_filtradas;
END;
$$;


ALTER FUNCTION "public"."get_metricas_dashboard"("p_start_date" "date", "p_end_date" "date", "p_sucursal_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_top_productos_agregados"("p_start_date" "date" DEFAULT '2020-01-01'::"date", "p_end_date" "date" DEFAULT '2099-12-31'::"date", "p_sucursal_id" integer DEFAULT NULL::integer, "p_limit" integer DEFAULT 10) RETURNS TABLE("codigo" character varying, "nombre_producto" "text", "total_cantidad" numeric, "total_ingresos" numeric, "transacciones" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bd.codigo,
        -- Usamos MIN() para tomar el primer nombre
        -- (alfabéticamente) que encuentre para ese código.
        MIN(bd.nombre) AS nombre_producto, 
        SUM(bd.cantidad) AS total_cantidad,
        SUM(bd.cantidad * bd.precio) AS total_ingresos,
        COUNT(*)::BIGINT AS transacciones
    FROM boletas_detalles bd
    INNER JOIN boletas b ON bd.boleta_folio = b.folio
    -- YA NO HAY LEFT JOIN A productos_normalizados --
    WHERE b.fecha >= p_start_date 
      AND b.fecha <= p_end_date
      AND (
          (p_sucursal_id IS NULL AND b.sucursal_id IS NULL)
          OR (b.sucursal_id = p_sucursal_id)
          OR (p_sucursal_id = 0)
      )
    -- Agrupamos SOLAMENTE por el código --
    GROUP BY bd.codigo
    ORDER BY SUM(bd.cantidad * bd.precio) DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_top_productos_agregados"("p_start_date" "date", "p_end_date" "date", "p_sucursal_id" integer, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_provider_catalog"("p_provider_name" "text", "p_products" "public"."product_upload"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_provider_id UUID;
  v_product RECORD;
  product_map RECORD;
BEGIN
  -- Paso 1: Buscar o crear el proveedor y obtener su ID.
  -- Esto se llama "UPSERT".
  INSERT INTO providers (name)
  VALUES (p_provider_name)
  ON CONFLICT (name) DO UPDATE SET name = p_provider_name
  RETURNING id INTO v_provider_id;

  -- Paso 2: ¡CRÍTICO! Borrar TODOS los precios antiguos de este proveedor.
  -- Gracias a ON DELETE CASCADE que ya configuraste, esto es seguro.
  -- Pero aquí lo hacemos explícito para mayor claridad.
  DELETE FROM provider_prices WHERE provider_id = v_provider_id;

  -- Paso 3: Iterar sobre cada producto del arreglo que recibimos.
  -- Esto es más robusto que un bulk upsert directo cuando se combina con la lógica de precios.
  FOR v_product IN SELECT * FROM unnest(p_products)
  LOOP
    -- Paso 3a: Buscar o crear el producto maestro en la tabla 'products'.
    -- Usamos la misma lógica jerárquica de antes (EAN > Fingerprint).
    WITH upserted_product AS (
      INSERT INTO products (ean, name, active_ingredient, fingerprint)
      VALUES (
        CASE WHEN v_product.ean ~ '^\d{12,13}$' THEN v_product.ean ELSE NULL END,
        v_product.productName,
        v_product.activeIngredient,
        CASE WHEN v_product.ean ~ '^\d{12,13}$' THEN NULL ELSE public.createfingerprint(v_product.productName, v_product.activeIngredient) END
      )
      ON CONFLICT (ean) WHERE ean IS NOT NULL DO UPDATE
        SET name = EXCLUDED.name, active_ingredient = EXCLUDED.active_ingredient
      RETURNING id

      -- Unión con el caso de fingerprint
      -- Esta parte es compleja, pero asegura que no haya errores de conflicto.
    )
    SELECT id INTO product_map FROM upserted_product;
    
    -- Si no se encontró por EAN, se busca o inserta por Fingerprint
    IF product_map.id IS NULL THEN
        WITH upserted_product_fp AS (
          INSERT INTO products (fingerprint, name, active_ingredient)
          VALUES (
            public.createfingerprint(v_product.productName, v_product.activeIngredient),
            v_product.productName,
            v_product.activeIngredient
          )
          ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL DO UPDATE
            SET name = EXCLUDED.name, active_ingredient = EXCLUDED.active_ingredient
          RETURNING id
        )
        SELECT id INTO product_map FROM upserted_product_fp;
    END IF;

    -- Paso 3b: Insertar el nuevo precio en 'provider_prices'
    -- vinculando el producto encontrado/creado con el proveedor.
    IF product_map.id IS NOT NULL AND v_product.price IS NOT NULL THEN
      INSERT INTO provider_prices (provider_id, product_id, price)
      VALUES (v_provider_id, product_map.id, v_product.price);
    END IF;

  END LOOP;

END;
$_$;


ALTER FUNCTION "public"."replace_provider_catalog"("p_provider_name" "text", "p_products" "public"."product_upload"[]) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."boletas" (
    "folio" integer NOT NULL,
    "id" integer,
    "sucursal_id" real,
    "tipodoc" character varying(10),
    "fecha" "date",
    "rut" character varying(20),
    "rs" "text",
    "montoneto" numeric(12,2),
    "montoexento" numeric(12,2),
    "montoiva" numeric(12,2),
    "montonf" numeric(12,2),
    "montototal" numeric(12,2),
    "pdf" "text",
    "xml" "text",
    "estado" character varying(50),
    "trackid" character varying(100),
    "referencias" "jsonb",
    "timestamp_descarga" timestamp without time zone
);


ALTER TABLE "public"."boletas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boletas_detalles" (
    "id" integer NOT NULL,
    "boleta_folio" integer,
    "item_index" integer,
    "codigo" character varying(100),
    "nombre" "text",
    "cantidad" numeric(10,3),
    "unidad" character varying(20),
    "precio" numeric(12,2),
    "descuento" numeric(10,2),
    "exento" integer,
    "bodega" integer,
    "costo_unitario_neto" "jsonb"
);


ALTER TABLE "public"."boletas_detalles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."boletas_detalles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."boletas_detalles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."boletas_detalles_id_seq" OWNED BY "public"."boletas_detalles"."id";



CREATE TABLE IF NOT EXISTS "public"."boletas_pagos" (
    "id" integer NOT NULL,
    "boleta_folio" integer,
    "fecha" timestamp without time zone,
    "mediopago" integer,
    "monto" numeric(12,2),
    "glosa" "text",
    "cobrar" integer
);


ALTER TABLE "public"."boletas_pagos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."boletas_pagos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."boletas_pagos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."boletas_pagos_id_seq" OWNED BY "public"."boletas_pagos"."id";



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#3B82F6'::"text",
    "created_at" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mensaje_destinatarios" (
    "id" bigint NOT NULL,
    "mensaje_id" bigint NOT NULL,
    "destinatario_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."mensaje_destinatarios" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mensaje_destinatarios_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."mensaje_destinatarios_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mensaje_destinatarios_id_seq" OWNED BY "public"."mensaje_destinatarios"."id";



CREATE TABLE IF NOT EXISTS "public"."mensajes" (
    "id" bigint NOT NULL,
    "remitente_id" "uuid" NOT NULL,
    "asunto" character varying(160) NOT NULL,
    "cuerpo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mensajes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mensajes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."mensajes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mensajes_id_seq" OWNED BY "public"."mensajes"."id";



CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "resource" "text" NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "published" boolean DEFAULT false NOT NULL,
    "author_id" "uuid" NOT NULL,
    "created_at" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos_normalizados" (
    "codigo" character varying(100) NOT NULL,
    "nombre_oficial" "text" NOT NULL,
    "actualizado_en" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."productos_normalizados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos_pos" (
    "id" bigint NOT NULL,
    "nombre" "text" NOT NULL,
    "codigo" character varying(100),
    "unidad" character varying(20),
    "descripcion" "text",
    "exento" boolean,
    "fraccionable" boolean,
    "activo" boolean DEFAULT true,
    "param1" "text",
    "param2" "text",
    "param3" "text",
    "param4" "text",
    "preciocompraneto" numeric(12,2),
    "precioventabruto" numeric(12,2),
    "cod_imp_venta" character varying(20),
    "cod_imp_compra" character varying(20),
    "peso" numeric(12,3),
    "largo" numeric(12,2),
    "ancho" numeric(12,2),
    "alto" numeric(12,2),
    "stocks" "jsonb",
    "atributos" "jsonb",
    "otrosprecios" "jsonb",
    "timestamp_descarga" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_dimensiones_no_negativas" CHECK (((("peso" IS NULL) OR ("peso" >= (0)::numeric)) AND (("largo" IS NULL) OR ("largo" >= (0)::numeric)) AND (("ancho" IS NULL) OR ("ancho" >= (0)::numeric)) AND (("alto" IS NULL) OR ("alto" >= (0)::numeric)))),
    CONSTRAINT "chk_precios_no_negativos" CHECK (((("preciocompraneto" IS NULL) OR ("preciocompraneto" >= (0)::numeric)) AND (("precioventabruto" IS NULL) OR ("precioventabruto" >= (0)::numeric))))
);


ALTER TABLE "public"."productos_pos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ean" "text",
    "fingerprint" "text",
    "name" "text" NOT NULL,
    "active_ingredient" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_prices" (
    "id" bigint NOT NULL,
    "product_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "last_updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."provider_prices" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."provider_prices_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."provider_prices_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."provider_prices_id_seq" OWNED BY "public"."provider_prices"."id";



CREATE TABLE IF NOT EXISTS "public"."providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_minimo" (
    "producto_id" bigint NOT NULL,
    "bodega_id" bigint NOT NULL,
    "stock_minimo" numeric NOT NULL
);


ALTER TABLE "public"."stock_minimo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "avatar" "text",
    "bio" "text",
    "phone" "text",
    "created_at" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role_id" "uuid",
    "created_at" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(3) without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."boletas_detalles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."boletas_detalles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."boletas_pagos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."boletas_pagos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mensaje_destinatarios" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mensaje_destinatarios_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mensajes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mensajes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."provider_prices" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."provider_prices_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."boletas_detalles"
    ADD CONSTRAINT "boletas_detalles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boletas_pagos"
    ADD CONSTRAINT "boletas_pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boletas"
    ADD CONSTRAINT "boletas_pkey" PRIMARY KEY ("folio");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mensaje_destinatarios"
    ADD CONSTRAINT "mensaje_destinatarios_mensaje_id_destinatario_id_key" UNIQUE ("mensaje_id", "destinatario_id");



ALTER TABLE ONLY "public"."mensaje_destinatarios"
    ADD CONSTRAINT "mensaje_destinatarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mensajes"
    ADD CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_normalizados"
    ADD CONSTRAINT "productos_normalizados_pkey" PRIMARY KEY ("codigo");



ALTER TABLE ONLY "public"."productos_pos"
    ADD CONSTRAINT "productos_pos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_ean_key" UNIQUE ("ean");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_fingerprint_key" UNIQUE ("fingerprint");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_prices"
    ADD CONSTRAINT "provider_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_prices"
    ADD CONSTRAINT "provider_prices_product_id_provider_id_key" UNIQUE ("product_id", "provider_id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_minimo"
    ADD CONSTRAINT "stock_minimo_pkey" PRIMARY KEY ("producto_id", "bodega_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "categories_name_key" ON "public"."categories" USING "btree" ("name");



CREATE INDEX "idx_boletas_detalles_boleta_folio" ON "public"."boletas_detalles" USING "btree" ("boleta_folio");



CREATE INDEX "idx_boletas_detalles_codigo" ON "public"."boletas_detalles" USING "btree" ("codigo");



CREATE INDEX "idx_boletas_detalles_folio" ON "public"."boletas_detalles" USING "btree" ("boleta_folio");



CREATE INDEX "idx_boletas_fecha" ON "public"."boletas" USING "btree" ("fecha");



CREATE INDEX "idx_boletas_fecha_sucursal" ON "public"."boletas" USING "btree" ("fecha", "sucursal_id");



CREATE INDEX "idx_boletas_pagos_folio" ON "public"."boletas_pagos" USING "btree" ("boleta_folio");



CREATE INDEX "idx_boletas_rut" ON "public"."boletas" USING "btree" ("rut");



CREATE INDEX "idx_md_inbox" ON "public"."mensaje_destinatarios" USING "btree" ("destinatario_id", "deleted_at", "read_at");



CREATE INDEX "idx_md_no_leidos" ON "public"."mensaje_destinatarios" USING "btree" ("destinatario_id", "deleted_at", "read_at") WHERE (("deleted_at" IS NULL) AND ("read_at" IS NULL));



CREATE INDEX "idx_msg_remitente" ON "public"."mensajes" USING "btree" ("remitente_id", "created_at" DESC);



CREATE INDEX "idx_prod_norm_nombre" ON "public"."productos_normalizados" USING "btree" ("nombre_oficial");



CREATE INDEX "idx_productos_activo" ON "public"."productos_pos" USING "btree" ("activo");



CREATE INDEX "idx_productos_atrib_gin" ON "public"."productos_pos" USING "gin" ("atributos");



CREATE INDEX "idx_productos_codigo" ON "public"."productos_pos" USING "btree" ("codigo");



CREATE INDEX "idx_productos_nombre_gin" ON "public"."productos_pos" USING "gin" ("to_tsvector"('"spanish"'::"regconfig", "nombre"));



CREATE INDEX "idx_productos_precios_gin" ON "public"."productos_pos" USING "gin" ("otrosprecios");



CREATE INDEX "idx_productos_stocks_gin" ON "public"."productos_pos" USING "gin" ("stocks");



CREATE INDEX "idx_products_ean" ON "public"."products" USING "btree" ("ean");



CREATE INDEX "idx_products_fingerprint" ON "public"."products" USING "btree" ("fingerprint");



CREATE UNIQUE INDEX "permissions_name_key" ON "public"."permissions" USING "btree" ("name");



CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "public"."role_permissions" USING "btree" ("role_id", "permission_id");



CREATE UNIQUE INDEX "roles_name_key" ON "public"."roles" USING "btree" ("name");



CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "public"."user_profiles" USING "btree" ("user_id");



CREATE UNIQUE INDEX "users_email_key" ON "public"."users" USING "btree" ("email");



ALTER TABLE ONLY "public"."boletas_detalles"
    ADD CONSTRAINT "boletas_detalles_boleta_folio_fkey" FOREIGN KEY ("boleta_folio") REFERENCES "public"."boletas"("folio") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boletas_pagos"
    ADD CONSTRAINT "boletas_pagos_boleta_folio_fkey" FOREIGN KEY ("boleta_folio") REFERENCES "public"."boletas"("folio") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mensaje_destinatarios"
    ADD CONSTRAINT "mensaje_destinatarios_mensaje_id_fkey" FOREIGN KEY ("mensaje_id") REFERENCES "public"."mensajes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_prices"
    ADD CONSTRAINT "provider_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_prices"
    ADD CONSTRAINT "provider_prices_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE "public"."mensaje_destinatarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mensajes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "p_insert_md" ON "public"."mensaje_destinatarios" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."mensajes" "m"
  WHERE (("m"."id" = "mensaje_destinatarios"."mensaje_id") AND ("m"."remitente_id" = "auth"."uid"())))));



CREATE POLICY "p_insert_msg" ON "public"."mensajes" FOR INSERT WITH CHECK (("auth"."uid"() = "remitente_id"));



CREATE POLICY "p_mis_enviados" ON "public"."mensajes" FOR SELECT USING (("auth"."uid"() = "remitente_id"));



CREATE POLICY "p_mis_recibidos" ON "public"."mensajes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."mensaje_destinatarios" "md"
  WHERE (("md"."mensaje_id" = "mensajes"."id") AND ("md"."destinatario_id" = "auth"."uid"()) AND ("md"."deleted_at" IS NULL)))));



CREATE POLICY "p_select_md" ON "public"."mensaje_destinatarios" FOR SELECT USING (("destinatario_id" = "auth"."uid"()));



CREATE POLICY "p_update_md" ON "public"."mensaje_destinatarios" FOR UPDATE USING (("destinatario_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."calculate_product_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_product_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_product_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."createfingerprint"("p_name" "text", "p_active_ingredient" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."createfingerprint"("p_name" "text", "p_active_ingredient" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."createfingerprint"("p_name" "text", "p_active_ingredient" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_metricas_dashboard"("p_start_date" "date", "p_end_date" "date", "p_sucursal_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_metricas_dashboard"("p_start_date" "date", "p_end_date" "date", "p_sucursal_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_metricas_dashboard"("p_start_date" "date", "p_end_date" "date", "p_sucursal_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top_productos_agregados"("p_start_date" "date", "p_end_date" "date", "p_sucursal_id" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_productos_agregados"("p_start_date" "date", "p_end_date" "date", "p_sucursal_id" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_productos_agregados"("p_start_date" "date", "p_end_date" "date", "p_sucursal_id" integer, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_provider_catalog"("p_provider_name" "text", "p_products" "public"."product_upload"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."replace_provider_catalog"("p_provider_name" "text", "p_products" "public"."product_upload"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_provider_catalog"("p_provider_name" "text", "p_products" "public"."product_upload"[]) TO "service_role";


















GRANT ALL ON TABLE "public"."boletas" TO "anon";
GRANT ALL ON TABLE "public"."boletas" TO "authenticated";
GRANT ALL ON TABLE "public"."boletas" TO "service_role";



GRANT ALL ON TABLE "public"."boletas_detalles" TO "anon";
GRANT ALL ON TABLE "public"."boletas_detalles" TO "authenticated";
GRANT ALL ON TABLE "public"."boletas_detalles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."boletas_detalles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."boletas_detalles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."boletas_detalles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."boletas_pagos" TO "anon";
GRANT ALL ON TABLE "public"."boletas_pagos" TO "authenticated";
GRANT ALL ON TABLE "public"."boletas_pagos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."boletas_pagos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."boletas_pagos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."boletas_pagos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."mensaje_destinatarios" TO "anon";
GRANT ALL ON TABLE "public"."mensaje_destinatarios" TO "authenticated";
GRANT ALL ON TABLE "public"."mensaje_destinatarios" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mensaje_destinatarios_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mensaje_destinatarios_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mensaje_destinatarios_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mensajes" TO "anon";
GRANT ALL ON TABLE "public"."mensajes" TO "authenticated";
GRANT ALL ON TABLE "public"."mensajes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mensajes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mensajes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mensajes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."productos_normalizados" TO "anon";
GRANT ALL ON TABLE "public"."productos_normalizados" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_normalizados" TO "service_role";



GRANT ALL ON TABLE "public"."productos_pos" TO "anon";
GRANT ALL ON TABLE "public"."productos_pos" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_pos" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."provider_prices" TO "anon";
GRANT ALL ON TABLE "public"."provider_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_prices" TO "service_role";



GRANT ALL ON SEQUENCE "public"."provider_prices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."provider_prices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."provider_prices_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."providers" TO "anon";
GRANT ALL ON TABLE "public"."providers" TO "authenticated";
GRANT ALL ON TABLE "public"."providers" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."stock_minimo" TO "anon";
GRANT ALL ON TABLE "public"."stock_minimo" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_minimo" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































