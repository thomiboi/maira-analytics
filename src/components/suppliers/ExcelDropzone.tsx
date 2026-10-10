// components/ExcelDropzone.tsx
"use client";

import React, { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import * as XLSX from "xlsx";
import {
  cleanAndMapData,
  CleanProduct,
  sendCatalogToAPI,
  findMappingByAliases,
  findHeaderRowIndex,
} from "@/lib/utils";
import ReplaceConfirmModal from "@/components/suppliers/ReplaceConfirmModal";

// Tipo genérico para los datos del Excel (crudo)
type ExcelRow = Record<string, string | number | boolean>;

// Tipo para almacenar datos limpios de un proveedor
interface ProviderCleanData {
  provider: string;
  fileName: string;
  data: CleanProduct[];
}

// Tipo para el producto unificado (con múltiples precios de proveedores)
interface UnifiedProduct {
  productName: string;
  ean: string;
  prices: Array<{
    provider: string;
    price: number;
  }>;
}

/**
 * 🔄 Unifica los catálogos de múltiples proveedores en un solo arreglo.
 * Agrupa productos por EAN y muestra todos los precios disponibles.
 */
function unifyCatalogs(providersData: ProviderCleanData[]): UnifiedProduct[] {
  const productMap: Map<string, UnifiedProduct> = new Map();

  // Iterar sobre cada proveedor
  for (const providerData of providersData) {
    const { provider, data } = providerData;

    // Iterar sobre cada producto del proveedor
    for (const product of data) {
      const key = product.ean || product.productName; // Usar EAN como clave principal

      if (productMap.has(key)) {
        // El producto ya existe, agregar el precio de este proveedor
        const existing = productMap.get(key)!;
        existing.prices.push({
          provider,
          price: product.price,
        });
      } else {
        // Producto nuevo, crearlo
        productMap.set(key, {
          productName: product.productName,
          ean: product.ean,
          prices: [
            {
              provider,
              price: product.price,
            },
          ],
        });
      }
    }
  }

  // Convertir el mapa a un arreglo y ordenar por nombre
  return Array.from(productMap.values()).sort((a, b) =>
    a.productName.localeCompare(b.productName)
  );
}

function ExcelDropzone({
  onUploadComplete,
}: {
  onUploadComplete?: () => void;
}) {
  const [cleanedData, setCleanedData] = useState<ProviderCleanData[]>([]);
  const [unifiedData, setUnifiedData] = useState<UnifiedProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 💾 Estados para el guardado en la API
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    Record<string, { success: boolean; message: string }>
  >({});
  const [uploadProgress, setUploadProgress] = useState<string>("");

  // 📝 Estados para el nombre de proveedor
  const [providerName, setProviderName] = useState("");
  const [providerNameError, setProviderNameError] = useState<string | null>(
    null
  );
  const [isUpdate, setIsUpdate] = useState(false); // Nuevo estado

  // Estado para el modal de confirmación de reemplazo
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [pendingReplace, setPendingReplace] = useState(false);

  // 📤 Función para guardar todos los catálogos en la API CON CHUNKING
  const handleSaveAllCatalogs = async () => {
    // 🔍 Verificar si el proveedor ya existe
    try {
      const checkResponse = await fetch(`/api/providers`);
      if (checkResponse.ok) {
        const data = await checkResponse.json();
        const existingProvider = data.providers?.find(
          (p: { name: string }) =>
            p.name.toLowerCase() === providerName.toLowerCase()
        );

        if (existingProvider) {
          // 🚨 Proveedor existe - Mostrar modal de confirmación
          setIsUpdate(true);
          setReplaceModalOpen(true);
          return; // Esperar confirmación del usuario
        } else {
          setIsUpdate(false);
        }
      }
    } catch (error) {
      console.error("Error al verificar proveedor existente:", error);
      // Continuar de todas formas si falla la verificación
    }

    // Si no existe el proveedor o ya se confirmó, proceder con el guardado
    await executeSave();
  };

  // Función separada para ejecutar el guardado
  const executeSave = async () => {
    setReplaceModalOpen(false); // Cerrar modal si estaba abierto
    setPendingReplace(false);

    setIsSaving(true);
    setSaveStatus({});
    setUploadProgress("");
    const results: Record<string, { success: boolean; message: string }> = {};

    // 🔧 Configuración de chunking
    const CHUNK_SIZE = 500; // Reducido de 500 a 250 para evitar timeouts con archivos grandes

    console.log(`💾 Guardando ${cleanedData.length} catálogos con chunking...`);

    for (const providerData of cleanedData) {
      try {
        const totalProducts = providerData.data.length;

        // Si el catálogo es pequeño (< 500 productos), enviar todo de una vez
        if (totalProducts <= CHUNK_SIZE) {
          setUploadProgress(
            `📦 ${providerData.provider}: Enviando ${totalProducts} productos...`
          );

          // Enviar con clearPrevious: true para eliminar precios anteriores
          const success = await sendCatalogToAPI(
            providerData.provider,
            providerData.data,
            true // clearPrevious
          );

          results[providerData.provider] = {
            success,
            message: success
              ? `${totalProducts} productos guardados`
              : "Error al guardar el catálogo",
          };
        } else {
          // 🚀 Catálogo grande: dividir en chunks
          const totalChunks = Math.ceil(totalProducts / CHUNK_SIZE);
          console.log(
            `📊 ${providerData.provider}: ${totalProducts} productos → ${totalChunks} lotes`
          );

          let successfulChunks = 0;
          let totalSaved = 0;

          // Enviar cada chunk secuencialmente
          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min((i + 1) * CHUNK_SIZE, totalProducts);
            const chunk = providerData.data.slice(start, end);

            // Actualizar progreso en tiempo real
            setUploadProgress(
              `📦 ${providerData.provider}: Enviando lote ${
                i + 1
              }/${totalChunks} (${
                start + 1
              }-${end} de ${totalProducts} productos)...`
            );

            console.log(
              `   → Lote ${i + 1}/${totalChunks}: ${chunk.length} productos`
            );

            try {
              // 🕐 Agregar delay de 300ms entre lotes para evitar rate limiting
              if (i > 0) {
                await new Promise((resolve) => setTimeout(resolve, 300));
              }

              // 🔑 clearPrevious: true SOLO en el primer lote (i === 0)
              const success = await sendCatalogToAPI(
                providerData.provider,
                chunk,
                i === 0 // Solo limpiar precios anteriores en el primer lote
              );

              if (success) {
                successfulChunks++;
                totalSaved += chunk.length;
              } else {
                // Si falla un chunk, registrar el error pero continuar con los siguientes
                console.error(
                  `❌ Error en lote ${i + 1}/${totalChunks} de ${
                    providerData.provider
                  }`
                );
              }
            } catch (chunkError) {
              console.error(
                `❌ Excepción en lote ${i + 1}/${totalChunks}:`,
                chunkError
              );
              // Continuar con el siguiente chunk
            }
          }

          // Resultado final del proveedor
          const allSuccess = successfulChunks === totalChunks;
          results[providerData.provider] = {
            success: allSuccess,
            message: allSuccess
              ? `${totalSaved} productos guardados en ${totalChunks} lotes`
              : `${totalSaved}/${totalProducts} productos guardados (${successfulChunks}/${totalChunks} lotes exitosos)`,
          };
        }
      } catch (error) {
        results[providerData.provider] = {
          success: false,
          message: error instanceof Error ? error.message : "Error desconocido",
        };
      }
    }

    setSaveStatus(results);
    setIsSaving(false);
    setUploadProgress("✅ Proceso completado");

    // Resumen en consola
    const successCount = Object.values(results).filter((r) => r.success).length;
    console.log(
      `✅ ${successCount}/${cleanedData.length} catálogos guardados exitosamente`
    );

    // Llamar al callback si existe y hubo al menos un guardado exitoso
    if (onUploadComplete && successCount > 0) {
      console.log("🔄 Recargando datos de comparación...");
      onUploadComplete();
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      // Limpiar estado anterior
      setCleanedData([]);
      setUnifiedData([]);
      setError(null);

      if (fileRejections.length > 0) {
        setError(
          `${fileRejections.length} archivo(s) no válido(s). Por favor, sube archivos .xls o .xlsx.`
        );
        return;
      }

      if (acceptedFiles.length === 0) {
        return;
      }

      // �️ Validar que el nombre del proveedor esté ingresado antes de procesar
      if (!providerName.trim()) {
        setProviderNameError(
          "Por favor, ingresa el nombre del proveedor antes de subir archivos"
        );
        return;
      }

      // Limpiar error si existe
      setProviderNameError(null);

      // �📦 Procesar todos los archivos aceptados
      const allCleanData: ProviderCleanData[] = [];
      let filesProcessed = 0;

      acceptedFiles.forEach((file) => {
        const reader = new FileReader();

        reader.onload = (event: ProgressEvent<FileReader>) => {
          // Aseguramos que el resultado no es nulo
          if (!event.target?.result) {
            setError(`No se pudo leer el archivo: ${file.name}`);
            return;
          }

          const bstr = event.target.result;
          try {
            // 1️⃣ Leer el archivo Excel (datos crudos)
            const wb = XLSX.read(bstr, { type: "binary" });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const rawData = XLSX.utils.sheet_to_json<ExcelRow>(ws);

            console.log(
              `📄 Procesando archivo: ${file.name} (${rawData.length} filas)`
            );

            // 2️⃣ Encontrar la fila de encabezados
            const headerRowIndex = findHeaderRowIndex(rawData);

            if (headerRowIndex === -1) {
              console.error(
                `❌ No se encontraron encabezados en: ${file.name}`
              );
              setError(
                `No se encontraron encabezados válidos en: ${file.name}`
              );
              filesProcessed++;
              return;
            }

            const headerRow = rawData[headerRowIndex];
            console.log(
              `🔍 Encabezados encontrados en fila ${headerRowIndex}:`,
              headerRow
            );

            // 3️⃣ ✨ Detectar el mapeo automáticamente usando aliases
            const mapping = findMappingByAliases(headerRow);

            if (!mapping) {
              console.error(
                `❌ No se pudo detectar el mapeo de columnas en: ${file.name}`
              );

              // Obtener los nombres de las columnas disponibles
              const availableColumns = Object.values(headerRow)
                .map((v) => String(v || ""))
                .filter((v) => v.trim() !== "")
                .join(", ");

              setError(
                `❌ No se pudieron identificar las columnas necesarias en: ${file.name}\n\n` +
                  `📋 Columnas encontradas: ${availableColumns}\n\n` +
                  `💡 Tip: Revisa la consola del navegador (F12) para ver sugerencias de columnas.`
              );
              filesProcessed++;
              return;
            }

            // 4️⃣ Usar el nombre del proveedor ingresado por el usuario
            console.log(`🏢 Proveedor ingresado: ${providerName}`);

            // 5️⃣ Limpiar los datos usando el mapeo detectado
            const cleanData = cleanAndMapData(rawData, mapping);

            if (cleanData.length === 0) {
              console.warn(
                `⚠️ No se encontraron productos válidos en: ${file.name}`
              );
            } else {
              console.log(
                `✅ ${cleanData.length} productos limpios extraídos de ${file.name}`
              );
            }

            // 6️⃣ Agregar los datos limpios al arreglo principal
            allCleanData.push({
              provider: providerName,
              fileName: file.name,
              data: cleanData,
            });

            filesProcessed++;

            // 7️⃣ Cuando todos los archivos estén procesados, unificar catálogos
            if (filesProcessed === acceptedFiles.length) {
              console.log("✅ Todos los archivos procesados:", allCleanData);

              // Unificar los catálogos de todos los proveedores
              const unified = unifyCatalogs(allCleanData);

              console.log(
                `🎯 Catálogo unificado: ${unified.length} productos únicos`
              );

              setCleanedData(allCleanData);
              setUnifiedData(unified);
            }
          } catch (e) {
            setError(
              `Error al procesar ${file.name}. Asegúrate de que el formato sea correcto.`
            );
            console.error(e);
          }
        };

        reader.onerror = () => {
          setError(`Error al leer el archivo: ${file.name}`);
        };

        reader.readAsBinaryString(file);
      });
    },
    [providerName]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        "application/vnd.ms-excel": [".xls"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
          ".xlsx",
        ],
      },
      maxFiles: 5,
    });

  return (
    <div className="space-y-6">
      {/* 📝 Sección del nombre del proveedor con diseño mejorado */}
      <div
        className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 
                      border border-blue-200 dark:border-blue-800 rounded-xl p-6 shadow-sm"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Información del Proveedor
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Identifica el proveedor antes de importar el catálogo
            </p>
            <div className="flex items-start gap-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
              <svg
                className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Nota:</strong> Si el proveedor ya existe, todos sus
                precios anteriores serán reemplazados con los nuevos.
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Nombre del Proveedor <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={providerName}
              onChange={(e) => {
                setProviderName(e.target.value);
                setProviderNameError(null);
              }}
              placeholder="Ej: Empsephar, Medikar, Clinical Market..."
              className={`w-full pl-10 pr-4 py-3 border rounded-lg 
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       focus:ring-2 focus:border-transparent
                       placeholder-gray-400 dark:placeholder-gray-500
                       transition-all duration-200 text-base
                       ${
                         providerName.trim()
                           ? "border-green-300 dark:border-green-700 focus:ring-green-500"
                           : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                       }`}
            />
            {providerName.trim() && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <svg
                  className="h-5 w-5 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>

          {providerNameError && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {providerNameError}
              </p>
            </div>
          )}

          <div className="mt-2 flex items-start gap-2">
            <svg
              className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Requerido antes de subir archivos. Ej: Empsephar, Medikar, etc.
            </p>
          </div>
        </div>
      </div>

      {/* 📂 Zona de drag and drop mejorada */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-300 ease-in-out group
          ${
            isDragActive
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-105 shadow-lg"
              : isDragReject
              ? "border-red-500 bg-red-50 dark:bg-red-900/20 scale-105"
              : "border-gray-300 dark:border-gray-600 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md"
          }
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4">
          {/* Icono animado */}
          <div
            className={`
            w-16 h-16 rounded-full flex items-center justify-center
            transition-all duration-300
            ${
              isDragActive
                ? "bg-blue-100 dark:bg-blue-900/50 scale-110"
                : "bg-gray-200 dark:bg-gray-700 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:scale-110"
            }
          `}
          >
            {isDragReject ? (
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : isDragActive ? (
              <svg
                className="w-8 h-8 text-blue-600 animate-bounce"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            ) : (
              <svg
                className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            )}
          </div>

          {/* Texto principal */}
          {isDragReject ? (
            <div>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400 mb-1">
                ❌ Tipo de archivo no soportado
              </p>
              <p className="text-sm text-red-500 dark:text-red-400">
                Solo archivos .xls y .xlsx
              </p>
            </div>
          ) : isDragActive ? (
            <div>
              <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-1">
                📂 Suelta el archivo aquí
              </p>
              <p className="text-sm text-blue-500 dark:text-blue-400">
                Procesaremos tu catálogo inmediatamente
              </p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Arrastra tu archivo Excel aquí
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                o haz clic para seleccionarlo desde tu computadora
              </p>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                            hover:bg-blue-700 transition-colors shadow-sm"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Seleccionar archivo
              </div>
            </div>
          )}

          {/* Info adicional */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Formatos: .xls, .xlsx
            </span>
            <span className="flex items-center gap-1"></span>
          </div>
        </div>
      </div>

      {error && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg shadow-sm">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                  Error al procesar archivo
                </h4>
                <p className="text-sm text-red-700 dark:text-red-400">
                  {error}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📊 Vista de datos procesados mejorada */}
      {cleanedData.length > 0 && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          {/* Header con estadísticas */}
          <div
            className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 
                        border border-green-200 dark:border-green-800 rounded-xl p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    ✅ Archivo Procesado Exitosamente
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    {cleanedData.reduce((acc, p) => acc + p.data.length, 0)}{" "}
                    productos encontrados
                  </p>
                </div>
              </div>

              {/* Badge de estado */}
              <div
                className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 
                            border border-green-300 dark:border-green-700 rounded-lg"
              >
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-sm font-semibold text-green-800 dark:text-green-300">
                  Listo para guardar
                </span>
              </div>
            </div>

            {/* Resumen de archivos */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {cleanedData.map((providerData, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-green-200 dark:border-green-800/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-5 h-5 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {providerData.fileName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      Productos:
                    </span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {providerData.data.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 💾 Botón para guardar en la base de datos - Diseño mejorado */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg">
            <div className="flex items-start gap-4 mb-4">
              <div
                className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl 
                            flex items-center justify-center shadow-lg"
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                    Guardar en Base de Datos
                  </h4>
                  {isUpdate && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 
                                   text-orange-700 dark:text-orange-300 text-xs font-semibold rounded-full border border-orange-300 dark:border-orange-700"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
                      </svg>
                      ACTUALIZACIÓN
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isUpdate
                    ? "Se reemplazarán todos los precios existentes con la fecha de hoy"
                    : "Los productos se guardarán en Supabase y estarán disponibles para comparación de precios"}
                </p>
              </div>
            </div>

            <button
              onClick={handleSaveAllCatalogs}
              disabled={isSaving || !providerName.trim()}
              className={`
                w-full px-6 py-4 rounded-xl font-semibold text-base
                flex items-center justify-center gap-3
                transition-all duration-300 transform
                ${
                  isSaving || !providerName.trim()
                    ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                }
              `}
            >
              {isSaving ? (
                <>
                  <svg
                    className="animate-spin h-6 w-6 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span className="text-lg">
                    Guardando catálogo{cleanedData.length > 1 ? "s" : ""}...
                  </span>
                </>
              ) : !providerName.trim() ? (
                <>
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Ingresa el nombre del proveedor para continuar</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={
                        isUpdate
                          ? "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          : "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      }
                    />
                  </svg>
                  <span>
                    {isUpdate ? "Actualizar" : "Guardar"}{" "}
                    {cleanedData.reduce((acc, p) => acc + p.data.length, 0)}{" "}
                    Productos
                  </span>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </>
              )}
            </button>

            {/* ⚠️ Mensaje cuando falta el nombre del proveedor - Mejorado */}
            {!providerName.trim() && cleanedData.length > 0 && (
              <div
                className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 
                            border-l-4 border-yellow-500 dark:border-yellow-600 rounded-lg animate-pulse"
              >
                <div className="flex items-start gap-3">
                  <svg
                    className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                      Nombre del proveedor requerido
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      Ingresa el nombre del proveedor en la parte superior para
                      habilitar el guardado
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 📊 Indicador de progreso en tiempo real */}
            {uploadProgress && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium flex items-center gap-2">
                  {isSaving && (
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  <span>{uploadProgress}</span>
                </p>
              </div>
            )}

            {/* 📊 Estado de guardado por proveedor */}
            {Object.keys(saveStatus).length > 0 && (
              <div className="mt-4 space-y-2">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Estado del guardado:
                </h5>
                {Object.entries(saveStatus).map(([provider, status]) => (
                  <div
                    key={provider}
                    className={`
                      flex items-center justify-between p-3 rounded-lg
                      ${
                        status.success
                          ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                          : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {status.success ? "✅" : "❌"}
                      </span>
                      <div>
                        <p
                          className={`font-medium ${
                            status.success
                              ? "text-green-800 dark:text-green-300"
                              : "text-red-800 dark:text-red-300"
                          }`}
                        >
                          {provider}
                        </p>
                        <p
                          className={`text-sm ${
                            status.success
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {status.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🎯 Vista de catálogo unificado */}

      {/* Modal de confirmación de reemplazo */}
      <ReplaceConfirmModal
        isOpen={replaceModalOpen}
        onClose={() => {
          setReplaceModalOpen(false);
          setIsUpdate(false);
          setPendingReplace(false);
        }}
        onConfirm={() => {
          console.log("✅ Usuario confirmó el reemplazo del catálogo");
          setPendingReplace(true);
          executeSave();
        }}
        providerName={providerName}
        productsCount={cleanedData.reduce((acc, p) => acc + p.data.length, 0)}
        isProcessing={isSaving}
      />
    </div>
  );
}

export default ExcelDropzone;
