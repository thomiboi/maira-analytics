import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 💰 Formatea un número como precio en formato chileno (con puntos como separador de miles)
 * 
 * @param price El precio a formatear
 * @param includeDecimals Si debe incluir decimales (por defecto: false)
 * @returns String formateado en formato chileno (ej: $2.035)
 * 
 * @example
 * formatPrice(2035.50) // "$2.035"
 * formatPrice(2035.50, true) // "$2.035,50"
 * formatPrice(1500000) // "$1.500.000"
 */
export function formatPrice(price: number, includeDecimals: boolean = false): string {
  if (isNaN(price) || price === null || price === undefined) {
    return "$0";
  }

  // Redondear a 2 decimales
  const roundedPrice = Math.round(price * 100) / 100;

  // Separar parte entera y decimal
  const parts = roundedPrice.toFixed(2).split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1];

  // Formatear la parte entera con puntos como separador de miles
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  // Retornar con o sin decimales
  if (includeDecimals && decimalPart && decimalPart !== "00") {
    return `$${formattedInteger},${decimalPart}`;
  }

  return `$${formattedInteger}`;
}

/**
 * Encuentra el índice de la fila que contiene los encabezados de los productos.
 * Analiza las primeras 15 filas buscando palabras clave relacionadas con productos.
 * 
 * @param jsonData Los datos crudos extraídos del archivo XLSX.
 * @returns El índice de la fila de encabezado, o -1 si no se encuentra.
 * 
 * @example
 * // Si jsonData[7] contiene:
 * // { "__EMPTY": "Descripcion", "__EMPTY_3": "Precio", "__EMPTY_1": "Laboratorio" }
 * // La función retornará 7
 */
export function findHeaderRowIndex(
  jsonData: Array<Record<string, unknown>>
): number {
  // Palabras clave que identifican una fila de encabezados
  const keywords = [
    "descripcion",
    "descriptor",
    "descripción del artículo",  // Clinical Market específico
    "precio",
    "precio neto",
    "Precio Unitario Pack",
    "Precio neto",
    "oferta",
    "lista",
    "codigo",
    "código de barras",  // Clinical Market específico
    "ean",
    "ean 13",
    "barcode",
    "categoria",
    "categoría",
    "stock",
    "sku",
  ];

  // Analizar hasta las primeras 20 filas (o menos si el archivo es más corto)
  const maxRows = Math.min(20, jsonData.length);

  // 🔍 DEBUG: Mostrar TODAS las filas que coinciden con criterios
  console.log("🔍 DEBUG: Analizando las primeras 20 filas para encontrar encabezados:");

  for (let i = 0; i < maxRows; i++) {
    const row = jsonData[i];

    // Convertir todos los valores de la fila a un solo string en minúsculas
    const rowText = Object.values(row)
      .map(value => String(value || "").toLowerCase())
      .join(" ");

    // Contar cuántas palabras clave están presentes
    const keywordMatches = keywords.filter(keyword =>
      rowText.includes(keyword)
    ).length;

    console.log(`  Fila ${i}: ${keywordMatches} palabras clave → ${keywordMatches >= 2 ? '✅ CANDIDATA' : '❌ descartada'}`);
    if (keywordMatches >= 2) {
      console.log(`    Contenido:`, Object.values(row).slice(0, 5));

      // 🚫 VALIDACIÓN ADICIONAL: Verificar que la fila no sea solo títulos de campaña
      const values = Object.values(row).map(v => String(v || "").trim()).filter(v => v);

      // Si solo hay 1 valor, probablemente es un título de campaña, NO encabezados
      if (values.length === 1) {
        console.log(`  ⚠️ Fila ${i} solo tiene 1 columna, probablemente es título de campaña, continuando búsqueda...`);
        continue;
      }

      const campaignTitleCount = values.filter(val =>
        /(^|\s)(continua|nueva|especial)\s+(oferta|promocion|promoción|campaña)|(oferta|promocion|promoción|campaña)\s+(especial|de\s+la\s+semana|del\s+mes|navideña?|20\d{2})|lista\s+de\s+precios\s+\w+\s*:|actualizado\s+al\s+\d+/i.test(val)
      ).length;

      // Si la mayoría de las columnas son títulos de campaña, saltar esta fila
      if (campaignTitleCount > 0 && campaignTitleCount === values.length) {
        console.log(`  ⚠️ Fila ${i} solo contiene títulos de campaña (${campaignTitleCount}/${values.length}), continuando búsqueda...`);
        continue;
      }
    }

    // Si encontramos al menos 2 palabras clave, esta es la fila de encabezados
    if (keywordMatches >= 2) {
      console.log(`✅ Usando fila ${i} como encabezados`);
      return i;
    }
  }

  // No se encontró una fila de encabezados
  return -1;
}

/**
 * Tipo para el mapeo de columnas de un proveedor.
 */
export interface ColumnMapping {
  productName: string; // Nombre de la columna de producto en el Excel
  price: string;       // Nombre de la columna de precio en el Excel
  ean: string;         // Nombre de la columna de EAN en el Excel
}

/**
 * 🔑 Objeto de aliases: Define todos los posibles nombres que pueden tener las columnas
 * en los diferentes archivos Excel de proveedores.
 * 
 * Permite detectar automáticamente las columnas sin necesidad de configurar cada proveedor.
 */
export const columnAliases = {
  productName: [
    // Español - Descripciones (ORDEN: más específicas primero)
    "descripción del artículo",  // ⬅️ PRIORIDAD 1: Clinical Market usa este exacto
    "descripcion del articulo",  // Variante sin acentos
    "descriptor",                // Otros proveedores usan "descriptor"
    "descripcion",
    "descripción",
    "descripcion larga",
    "descripción larga",
    "descriptor larga",
    "descripcion corta",
    "descripción corta",
    "nombre producto",
    "nombre del producto",
    "producto",
    "nombre",
    "articulo",
    "artículo",
    "item",
    "detalle",
    "medicamento",
    "droga",
    "presentacion",
    "presentación",
    // Inglés
    "description",
    "product description",
    "product name",
    "product",
    "item name",
    "name",
    "medicine",
    "drug",
  ],
  price: [
    // ⬅️ PRIORIDAD 1: Columnas específicas de proveedores (orden importa!)
    "oferta",              // PROVEFARMA usa "OFERTA" para precios
    "lista",               // MEDIKAR usa "LISTA" para precios
    "precio neto",         // CLINICAL MARKET y otros usan "PRECIO NETO" - antes de "total"
    "precio venta",        // MEDIKAR también puede usar "PRECIO VENTA"
    "descuento comercial", // MEDIKAR puede usar esta columna alternativa
    "total neto",
    // Español - Términos generales
    "precio",
    "precio unitario",
    "precio unit",
    "precio unitario pack",
    "precio lista",
    "precio final",
    "valor",
    "costo",
    "importe",
    "monto",
    "total",               // EVITAR: Clinical Market tiene columna "TOTAL" que NO es el precio correcto
    // Español - Términos comerciales
    "p.v.p",
    "pvp",
    "precio publico",
    "precio público",
    "tarifa",
    "precio farmacia",
    "precio farma",
    "precio drogueria",
    "precio droguería",
    "hasta",
    "desde",
    "psl forzado",
    "psl",
    // Variaciones sin espacio
    "preciounitario",
    "precioneto",
    "precioventa",
    // Inglés
    "price",
    "unit price",
    "net price",
    "list price",
    "offer",
    "cost",
    "amount",
    "value",
  ],
  ean: [
    // Códigos de barras - Clinical Market específico
    "código de barras",    // ⬅️ PRIORIDAD 1: Clinical Market usa este exacto
    "codigo de barras",    // Variante sin acentos
    "ean",
    "ean13",
    "ean 13",
    "ean-13",
    "barcode",
    "bar code",
    "codigo de barra",
    "codigo barras",
    "código barras",
    "codigobarras",
    "códigobarras",
    // Códigos generales
    "codigo",
    "código",
    "cod",
    "code",
    "sku",
    "upc",
    "gtin",
    "ref",
    "referencia",
    "reference",
    "cum",
    "invima",
    "registro",
    // Variantes adicionales
    "cod ean",
    "cod. ean",
    "codigo ean",
    "código ean",
  ],
} as const;

/**
 * 🧹 Normaliza un string para comparación: remueve acentos, espacios extra, puntuación.
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    // Remover acentos
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Remover puntuación y caracteres especiales
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    // Reemplazar múltiples espacios por uno solo
    .replace(/\s+/g, " ");
}

/**
 * 🔍 Calcula la similitud entre dos strings (0 = diferentes, 1 = idénticos)
 * Usa el algoritmo de Levenshtein simplificado
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  // Si uno está contenido en el otro, alta similitud
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }

  // Calcular palabras en común
  const words1 = s1.split(" ");
  const words2 = s2.split(" ");

  const commonWords = words1.filter(word =>
    words2.some(w => w === word || w.includes(word) || word.includes(w))
  );

  if (commonWords.length > 0) {
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  return 0;
}

/**
 * 🔍 Encuentra el mapeo de columnas automáticamente usando aliases.
 * 
 * Esta función analiza los encabezados de un Excel y los compara contra
 * un diccionario de aliases para identificar qué columnas corresponden a
 * productName, price y ean.
 * 
 * Usa fuzzy matching (coincidencia aproximada) para ser más tolerante con variaciones.
 * 
 * @param headerRow La fila de encabezados extraída del Excel
 * @returns El mapeo de columnas si se encontraron al menos producto y precio, o null
 * 
 * @example
 * const headerRow = { "__EMPTY": "Descriptor", "__EMPTY_1": "Precio neto", "__EMPTY_2": "Codigo" };
 * const mapping = findMappingByAliases(headerRow);
 * // Retorna: { productName: 'Descriptor', price: 'Precio neto', ean: 'Codigo' }
 */
export function findMappingByAliases(
  headerRow: Record<string, unknown>
): ColumnMapping | null {
  const result: Partial<ColumnMapping> = {
    productName: undefined,
    price: undefined,
    ean: undefined,
  };

  // Convertir los valores del headerRow a un mapa normalizado
  // key: nombre COMPLETAMENTE normalizado (sin acentos, puntuación, espacios extra)
  // value: nombre original de la columna tal como aparece en el Excel
  const headerMap = new Map<string, string>();

  console.log("🔍 Analizando encabezados de la fila:", headerRow);

  Object.entries(headerRow).forEach(([key, value]) => {
    // ⚠️ CRÍTICO: El nombre de la columna puede estar en el KEY o en el VALUE
    // - Si el Excel tiene encabezados en la primera fila: key="A", value="Descripción"
    // - Si el Excel tiene columnas nombradas: key="__OFERTA_CAMPAÑA...", value="DESCRIPTOR"
    // Necesitamos filtrar ambos casos

    const columnKey = String(key || "").trim();
    const cellValue = String(value || "").trim();

    // 🚫 FILTRO 1: Ignorar si el KEY parece ser un título de campaña
    const keyIsLikelyCampaignTitle =
      columnKey.length > 50 || // Muy largo
      /(^|\s)(continua|nueva|especial)\s+(oferta|promocion|promoción|campaña)|(oferta|promocion|promoción|campaña)\s+(especial|de\s+la\s+semana|del\s+mes|navideña?|20\d{2})|lista\s+de\s+precios\s+\w+\s*:|actualizado\s+al\s+\d+|black.*friday/i.test(columnKey);

    if (keyIsLikelyCampaignTitle) {
      console.log(`🚫 Ignorando columna con key de campaña: "${columnKey}"`);
      return; // Saltar esta columna completamente
    }

    // Usar el value como nombre de columna (comportamiento normal)
    const originalName = cellValue;
    const normalizedName = normalizeString(originalName);

    // 🚫 FILTRO 2: Ignorar si el VALUE está vacío o parece ser título de campaña
    const valueIsLikelyCampaignTitle =
      !originalName ||
      originalName.length > 50 ||
      /(^|\s)(continua|nueva|especial)\s+(oferta|promocion|promoción|campaña)|(oferta|promocion|promoción|campaña)\s+(especial|de\s+la\s+semana|del\s+mes|navideña?|20\d{2})|lista\s+de\s+precios\s+\w+\s*:|actualizado\s+al\s+\d+|black.*friday/i.test(originalName);

    console.log(`   Columna [${key}]: "${originalName}" (normalizado: "${normalizedName}") ${valueIsLikelyCampaignTitle ? '🚫 IGNORADO' : '✅ VÁLIDO'}`);

    if (normalizedName && !valueIsLikelyCampaignTitle) {
      headerMap.set(normalizedName, originalName);
    } else if (valueIsLikelyCampaignTitle && originalName) {
      console.log(`🚫 Ignorando título de campaña en value: "${originalName}"`);
    }
  });

  console.log("🔍 Encabezados válidos encontrados:", Array.from(headerMap.values()));
  console.log("🔍 Encabezados normalizados:", Array.from(headerMap.keys()));

  // 🎯 NUEVA ESTRATEGIA: Búsqueda con fuzzy matching
  // Para cada campo, buscar la mejor coincidencia
  for (const [field, aliases] of Object.entries(columnAliases)) {
    let bestMatch: { header: string; score: number } | null = null;
    let foundExactMatch = false; // ⬅️ Flag para salir de ambos loops

    console.log(`\n🔎 Buscando campo "${field}"...`);

    // Iterar sobre cada alias posible
    for (const alias of aliases) {
      const aliasNormalized = normalizeString(alias);

      // Buscar coincidencia en todos los encabezados
      for (const [normalizedHeader, originalHeader] of headerMap.entries()) {
        // normalizedHeader ya está normalizado (sin acentos, puntuación, espacios extra)

        // 1️⃣ Coincidencia exacta (prioridad máxima)
        if (normalizedHeader === aliasNormalized) {
          result[field as keyof ColumnMapping] = originalHeader;
          console.log(`✅ Campo "${field}" encontrado: "${originalHeader}" (coincidencia exacta con "${alias}")`);
          bestMatch = { header: originalHeader, score: 1.0 };
          foundExactMatch = true; // ⬅️ Marcar que encontramos coincidencia exacta
          break; // Sale del loop de encabezados
        }

        // 2️⃣ Coincidencia parcial (el encabezado contiene el alias)
        if (normalizedHeader.includes(aliasNormalized)) {
          // 🎯 MEJORA: Penalizar coincidencias parciales si el header es mucho más largo
          const lengthRatio = aliasNormalized.length / normalizedHeader.length;
          let score = 0.9;

          // Si el alias es mucho más corto que el header (ej: "descriptor" vs "descriptor largo")
          // reducir el score para dar preferencia a coincidencias más cercanas
          if (lengthRatio < 0.7) {
            score = 0.7; // Reducir de 0.9 a 0.7
            console.log(`   ⚠️ Coincidencia parcial penalizada: "${originalHeader}" (ratio: ${(lengthRatio * 100).toFixed(0)}%) score: ${score}`);
          }

          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { header: originalHeader, score };
          }
        }

        // 3️⃣ Fuzzy matching (similitud por palabras en común)
        const similarity = calculateSimilarity(normalizedHeader, alias);
        if (similarity >= 0.6) { // Umbral de 60% de similitud
          if (!bestMatch || similarity > bestMatch.score) {
            bestMatch = { header: originalHeader, score: similarity };
          }
        }
      }

      // Si encontramos una coincidencia exacta, salir del loop de aliases también
      if (foundExactMatch) {
        break; // ⬅️ Ahora sí sale del loop de aliases
      }
    }

    // Asignar la mejor coincidencia encontrada SOLO si no hay resultado aún
    if (bestMatch && !result[field as keyof ColumnMapping]) {
      result[field as keyof ColumnMapping] = bestMatch.header;
      console.log(`✅ Campo "${field}" encontrado: "${bestMatch.header}" (score: ${(bestMatch.score * 100).toFixed(0)}%)`);
    }
  }

  // Validar que al menos tengamos producto y precio (EAN es opcional)
  if (!result.productName || !result.price) {
    console.warn("⚠️ No se encontraron columnas mínimas requeridas:", {
      productName: result.productName || "❌ NO ENCONTRADO",
      price: result.price || "❌ NO ENCONTRADO",
      ean: result.ean || "⚠️ Opcional - no encontrado",
    });

    // 💡 Sugerir columnas disponibles
    console.log("📋 Columnas disponibles en el archivo:", Array.from(headerMap.values()));

    // Sugerir posibles coincidencias
    if (!result.productName) {
      const suggestions = suggestColumn(Array.from(headerMap.values()), columnAliases.productName);
      console.log("💡 Posibles columnas para PRODUCTO:", suggestions.slice(0, 3));
    }
    if (!result.price) {
      const suggestions = suggestColumn(Array.from(headerMap.values()), columnAliases.price);
      console.log("💡 Posibles columnas para PRECIO:", suggestions.slice(0, 3));
    }

    return null;
  }

  // Si no se encontró EAN, usar string vacío como fallback
  const finalMapping: ColumnMapping = {
    productName: result.productName,
    price: result.price,
    ean: result.ean || "", // EAN es opcional
  };

  console.log("✅ Mapeo generado exitosamente:", finalMapping);

  return finalMapping;
}

/**
 * 💡 Sugiere columnas basándose en similitud con aliases conocidos
 */
function suggestColumn(
  availableHeaders: string[],
  aliases: readonly string[]
): string[] {
  const suggestions: Array<{ header: string; score: number }> = [];

  for (const header of availableHeaders) {
    let maxScore = 0;

    for (const alias of aliases) {
      const score = calculateSimilarity(header, alias);
      if (score > maxScore) {
        maxScore = score;
      }
    }

    if (maxScore > 0.3) { // Umbral mínimo del 30%
      suggestions.push({ header, score: maxScore });
    }
  }

  // Ordenar por score descendente
  suggestions.sort((a, b) => b.score - a.score);

  return suggestions.map(s => `${s.header} (${(s.score * 100).toFixed(0)}%)`);
}

/**
 * Tipo para el producto limpio y estandarizado.
 */
export interface CleanProduct {
  productName: string;
  price: number;
  ean: string;
}

/**
 * Limpia y mapea los datos crudos de un proveedor a una estructura estandarizada.
 * 
 * @param jsonData Los datos crudos extraídos del archivo XLSX.
 * @param mapping El mapeo de columnas para este proveedor específico.
 * @returns Un arreglo de productos limpios y estandarizados.
 * 
 * @example
 * const mapping = { productName: 'Descripcion', price: 'Precio', ean: 'EAN' };
 * const cleanData = cleanAndMapData(rawData, mapping);
 * // Retorna: [{ productName: "3A OFTENO SOL OFT X 5 ML", price: 11624, ean: "736085402551" }, ...]
 */

/**
 * Limpia y mapea los datos crudos de un proveedor a una estructura estandarizada.
 * * @param jsonData Los datos crudos extraídos del archivo XLSX.
 * @param mapping El mapeo de columnas con los nombres de encabezado detectados.
 * @returns Un arreglo de productos limpios y estandarizados.
 */
export function cleanAndMapData(
  jsonData: Array<Record<string, unknown>>,
  mapping: ColumnMapping
): CleanProduct[] {
  // 1. Encontrar el índice de la fila de encabezados
  const headerRowIndex = findHeaderRowIndex(jsonData);

  if (headerRowIndex === -1) {
    console.warn("⚠️ No se encontraron encabezados en el archivo. Retornando arreglo vacío.");
    return [];
  }

  // 2. Obtener el objeto de la fila de encabezados
  const headerRow = jsonData[headerRowIndex];

  // 3. ✨ MEJORA CLAVE: Crear un "mapa invertido" para encontrar la clave interna de cada columna
  // Este mapa conecta el nombre legible del encabezado (ej. "Precio Neto") con su clave interna
  // en el JSON (ej. "__EMPTY_4").
  let productNameKey: string | undefined;
  let priceKey: string | undefined;
  let eanKey: string | undefined;

  // Normalizamos COMPLETAMENTE los nombres del mapping (igual que en findMappingByAliases)
  const productNameNormalized = normalizeString(mapping.productName);
  const priceNormalized = normalizeString(mapping.price);
  const eanNormalized = mapping.ean ? normalizeString(mapping.ean) : "";

  console.log("🔍 Buscando claves internas para:", {
    productName: mapping.productName + " → " + productNameNormalized,
    price: mapping.price + " → " + priceNormalized,
    ean: mapping.ean ? mapping.ean + " → " + eanNormalized : "N/A"
  });

  console.log("🔍 Analizando headerRow completo:", headerRow);

  for (const [key, value] of Object.entries(headerRow)) {
    // 🚫 CRÍTICO: Aplicar el mismo filtro de campaña que en findMappingByAliases
    const columnKey = String(key || "").trim();
    const keyIsLikelyCampaignTitle =
      columnKey.length > 50 ||
      /(^|\s)(continua|nueva|especial)\s+(oferta|promocion|promoción|campaña)|(oferta|promocion|promoción|campaña)\s+(especial|de\s+la\s+semana|del\s+mes|navideña?|20\d{2})|lista\s+de\s+precios\s+\w+\s*:|actualizado\s+al\s+\d+|black.*friday/i.test(columnKey);

    if (keyIsLikelyCampaignTitle) {
      console.log(`   🚫 Ignorando columna de campaña: [${key}]`);
      continue; // Saltar esta columna
    }

    const headerValue = String(value || "");
    const headerValueNormalized = normalizeString(headerValue); // ⬅️ USAR normalizeString() completo

    console.log(`   [${key}] = "${headerValue}" (normalizado: "${headerValueNormalized}")`);

    if (headerValueNormalized === productNameNormalized) {
      productNameKey = key;
      console.log(`✅ productNameKey encontrado: ${key} → "${headerValue}"`);
    }
    if (headerValueNormalized === priceNormalized) {
      priceKey = key;
      console.log(`✅ priceKey encontrado: ${key} → "${headerValue}"`);
    }
    if (eanNormalized && headerValueNormalized === eanNormalized) {
      eanKey = key;
      console.log(`✅ eanKey encontrado: ${key} → "${headerValue}"`);
    }
  }

  // 4. Validar que encontramos las claves para las columnas esenciales
  if (!productNameKey || !priceKey) {
    console.error("❌ Error Crítico: No se pudo encontrar la clave interna para las columnas mapeadas.", {
      mapping,
      headerRow,
      keysFound: { productNameKey, priceKey, eanKey },
    });
    return [];
  }

  console.log("✅ Claves internas identificadas:", { productNameKey, priceKey, eanKey: eanKey || "N/A" });

  // 5. Obtener solo las filas de datos (después del encabezado)
  const productRows = jsonData.slice(headerRowIndex + 1);

  // 6. Iterar y limpiar cada fila usando las claves correctas
  const cleanProducts: CleanProduct[] = [];

  // 🔍 DEBUG: Mostrar las primeras 3 filas de datos para diagnóstico
  console.log("🔍 DEBUG: Primeras 3 filas de datos:");
  productRows.slice(0, 3).forEach((row, idx) => {
    console.log(`  Fila ${idx + 1}:`, {
      [productNameKey]: row[productNameKey],
      [priceKey]: row[priceKey],
      [eanKey || 'N/A']: eanKey ? row[eanKey] : 'N/A'
    });
  });

  for (const row of productRows) {
    // Extraer valores usando las claves internas encontradas
    const rawProductName = row[productNameKey];
    const rawPrice = row[priceKey];
    const rawEan = eanKey ? row[eanKey] : undefined;

    // Limpiar el nombre del producto
    const productName = String(rawProductName || "").trim();

    // Limpiar y convertir el precio a número
    let price: number | null = null;
    if (rawPrice !== null && rawPrice !== undefined && String(rawPrice).trim() !== "") {
      const priceStr = String(rawPrice)
        .replace(/[$.]/g, "") // Eliminar símbolos de moneda y puntos de miles
        .replace(/,/g, ".")  // Reemplazar coma decimal por punto
        .trim();

      const parsedPrice = parseFloat(priceStr);
      if (!isNaN(parsedPrice)) {
        price = parsedPrice;
      }
    }

    // Limpiar el EAN
    const ean = String(rawEan || "").trim();

    // Validar que el producto tenga datos mínimos válidos
    if (!productName || price === null || price <= 0) {
      continue; // Saltar productos sin nombre o precio válido
    }

    // Agregar el producto limpio al resultado
    cleanProducts.push({
      productName,
      price,
      ean,
    });
  }

  console.log(`✅ Se limpiaron ${cleanProducts.length} productos de ${productRows.length} filas.`);

  // 🔧 DE-DUPLICACIÓN: Eliminar productos duplicados por nombre, guardando el más barato
  console.log("🔍 Aplicando de-duplicación por nombre de producto (guardando el precio más bajo)...");

  const uniqueProductsMap = new Map<string, CleanProduct>();
  let duplicatesRemoved = 0;

  for (const product of cleanProducts) {
    // Crear una clave única basada en nombre normalizado
    // (simula el fingerprint que creará la API)
    const key = normalizeString(product.productName);

    if (uniqueProductsMap.has(key)) {
      const existingProduct = uniqueProductsMap.get(key)!;

      // 💰 Comparar precios: quedarse con el más barato
      if (product.price < existingProduct.price) {
        console.log(`💰 Duplicado encontrado - usando precio más barato: "${product.productName}"`);
        console.log(`   Anterior: $${existingProduct.price} → Nuevo: $${product.price} (ahorro: $${(existingProduct.price - product.price).toFixed(2)})`);
        uniqueProductsMap.set(key, product); // Reemplazar con el más barato
      } else {
        console.log(`💰 Duplicado encontrado - manteniendo precio más barato: "${product.productName}"`);
        console.log(`   Manteniendo: $${existingProduct.price} (descartando: $${product.price})`);
      }

      duplicatesRemoved++;
    } else {
      uniqueProductsMap.set(key, product);
    }
  }

  const uniqueProducts = Array.from(uniqueProductsMap.values());

  console.log(`✅ De-duplicación completada:`);
  console.log(`   - Productos originales: ${cleanProducts.length}`);
  console.log(`   - Productos únicos: ${uniqueProducts.length}`);
  console.log(`   - Duplicados eliminados: ${duplicatesRemoved}`);
  console.log(`   - Estrategia: Siempre se guardó el precio más bajo`);

  return uniqueProducts;
}

/**
 * 📤 Envía un catálogo de productos limpio a la API de Next.js.
 * 
 * @param providerName El nombre del proveedor.
 * @param cleanProducts El arreglo de productos limpios.
 * @param clearPrevious Si es true, elimina los precios anteriores del proveedor antes de insertar los nuevos.
 * @returns `true` si la subida es exitosa, `false` si falla.
 * 
 * @example
 * const success = await sendCatalogToAPI('Empsephar', cleanProducts, true);
 * if (success) {
 *   console.log('✅ Catálogo guardado');
 * }
 */
export async function sendCatalogToAPI(
  providerName: string,
  cleanProducts: CleanProduct[],
  clearPrevious: boolean = false
): Promise<boolean> {
  try {
    console.log(`📤 Enviando catálogo de ${providerName} con ${cleanProducts.length} productos${clearPrevious ? ' (reemplazando anteriores)' : ' (añadiendo/actualizando)'}...`);

    // Hacer la petición POST a la API
    const response = await fetch('/api/catalog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providerName,
        products: cleanProducts,
        clearPrevious
      })
    });

    // Verificar si la respuesta es exitosa
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ Error del servidor (${response.status}):`, errorData);
      return false;
    }

    // Parsear la respuesta exitosa
    const result = await response.json();

    console.log(`✅ Catálogo enviado exitosamente:`, result);

    if (result.stats) {
      console.log(`📊 Estadísticas:`, {
        total: result.stats.total,
        procesados: result.stats.processed,
        errores: result.stats.errors
      });
    }

    return true;

  } catch (error) {
    // Manejar errores de red u otros errores
    console.error('❌ Error al enviar el catálogo:', error);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('💡 Error de red: Verifica tu conexión o que el servidor esté corriendo.');
    }

    return false;
  }
}
