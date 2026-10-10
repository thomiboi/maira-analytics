// components/suppliers/ExcelUploadForm.tsx
"use client";

import React, { useCallback, useState, FormEvent } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import * as XLSX from "xlsx";
import {
  cleanAndMapData,
  ColumnMapping,
  CleanProduct,
  sendCatalogToAPI,
} from "@/lib/utils";

// Tipo genérico para los datos del Excel (crudo)
type ExcelRow = Record<string, string | number | boolean>;

// 🔧 Mapeos de columnas para cada proveedor conocido
const providerMappings: Record<string, ColumnMapping> = {
  mediven: {
    productName: "Descripcion",
    price: "Precio",
    ean: "BARCODE",
  },
  ethon: {
    productName: "DESCRIPCIÓN",
    price: "Precio",
    ean: "EAN",
  },
  canastas: {
    productName: "Descriptor",
    price: "Precio Unitario Pack",
    ean: "Codigo",
  },
  medikar: {
    productName: "descripcion",
    price: "lista",
    ean: "Codigo",
  },
  // 🔧 Mapeo genérico (fallback) para proveedores nuevos
  default: {
    productName: "Descripcion",
    price: "Precio",
    ean: "EAN",
  },
};

/**
 * 🔍 Busca el mapeo de columnas para un proveedor.
 * Si no existe, retorna el mapeo por defecto.
 */
function getMappingForProvider(providerName: string): ColumnMapping {
  const normalized = providerName.toLowerCase().trim();

  // Buscar coincidencia exacta
  if (providerMappings[normalized]) {
    return providerMappings[normalized];
  }

  // Buscar coincidencia parcial
  for (const [key, mapping] of Object.entries(providerMappings)) {
    if (key === "default") continue;

    if (normalized.includes(key) || key.includes(normalized)) {
      console.log(
        `✅ Usando mapeo de '${key}' para proveedor '${providerName}'`
      );
      return mapping;
    }
  }

  // Si no se encuentra, usar el mapeo por defecto
  console.log(`⚠️ Usando mapeo por defecto para proveedor '${providerName}'`);
  return providerMappings["default"];
}

interface ExcelUploadFormProps {
  onUploadComplete?: () => void;
}

function ExcelUploadForm({ onUploadComplete }: ExcelUploadFormProps) {
  // 📝 Estados del formulario
  const [providerName, setProviderName] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [cleanedProducts, setCleanedProducts] = useState<CleanProduct[]>([]);

  // 🎨 Estados de UI
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  /**
   * 📂 Callback cuando se suelta un archivo en la zona de dropzone
   */
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      // Limpiar errores previos
      setError(null);
      setSaveResult(null);
      setCleanedProducts([]);

      if (fileRejections.length > 0) {
        setError("Archivo no válido. Por favor, sube un archivo .xls o .xlsx.");
        return;
      }

      if (acceptedFiles.length === 0) {
        return;
      }

      // Solo tomar el primer archivo (maxFiles: 1)
      const file = acceptedFiles[0];
      setUploadedFile(file);

      console.log(`📂 Archivo cargado: ${file.name}`);
    },
    []
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
      maxFiles: 1, // Solo un archivo a la vez
      multiple: false,
    });

  /**
   * 🔄 Procesa el archivo XLSX y extrae los productos
   */
  const processFile = async (
    file: File,
    provider: string
  ): Promise<CleanProduct[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event: ProgressEvent<FileReader>) => {
        if (!event.target?.result) {
          reject(new Error("No se pudo leer el archivo"));
          return;
        }

        try {
          // 1️⃣ Leer el archivo Excel
          const bstr = event.target.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const rawData = XLSX.utils.sheet_to_json<ExcelRow>(ws);

          console.log(`📄 Procesando ${file.name}: ${rawData.length} filas`);

          // 2️⃣ Obtener el mapeo de columnas para este proveedor
          const mapping = getMappingForProvider(provider);

          // 3️⃣ Limpiar y mapear los datos
          const cleanData = cleanAndMapData(rawData, mapping);

          if (cleanData.length === 0) {
            reject(
              new Error(
                "No se encontraron productos válidos en el archivo. Verifica el formato."
              )
            );
            return;
          }

          console.log(`✅ ${cleanData.length} productos extraídos`);
          resolve(cleanData);
        } catch (err) {
          console.error("Error al procesar archivo:", err);
          reject(
            new Error(
              `Error al procesar el archivo. Asegúrate de que sea un Excel válido.`
            )
          );
        }
      };

      reader.onerror = () => {
        reject(new Error("Error al leer el archivo"));
      };

      reader.readAsBinaryString(file);
    });
  };

  /**
   * 📤 Maneja el envío del formulario
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Limpiar estados previos
    setError(null);
    setSaveResult(null);
    setUploadProgress("");

    // ✅ Validar que ambos campos están completos
    if (!providerName.trim()) {
      setError("Por favor, ingresa el nombre del proveedor");
      return;
    }

    if (!uploadedFile) {
      setError("Por favor, carga un archivo Excel");
      return;
    }

    try {
      // 1️⃣ Procesar el archivo
      setIsProcessing(true);
      setUploadProgress("📄 Procesando archivo Excel...");

      const products = await processFile(uploadedFile, providerName);
      setCleanedProducts(products);

      // 2️⃣ Enviar a la API con chunking
      setIsSaving(true);
      const CHUNK_SIZE = 500;
      const totalProducts = products.length;

      if (totalProducts <= CHUNK_SIZE) {
        // Archivo pequeño: enviar todo de una vez
        setUploadProgress(
          `📦 Enviando ${totalProducts} productos a la base de datos...`
        );

        const success = await sendCatalogToAPI(providerName, products);

        setSaveResult({
          success,
          message: success
            ? `✅ ${totalProducts} productos guardados exitosamente`
            : "❌ Error al guardar el catálogo",
        });
      } else {
        // Archivo grande: dividir en chunks
        const totalChunks = Math.ceil(totalProducts / CHUNK_SIZE);
        console.log(
          `📊 ${providerName}: ${totalProducts} productos → ${totalChunks} lotes`
        );

        let successfulChunks = 0;
        let totalSaved = 0;

        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min((i + 1) * CHUNK_SIZE, totalProducts);
          const chunk = products.slice(start, end);

          setUploadProgress(
            `📦 Enviando lote ${i + 1}/${totalChunks} (${
              start + 1
            }-${end} de ${totalProducts} productos)...`
          );

          console.log(
            `   → Lote ${i + 1}/${totalChunks}: ${chunk.length} productos`
          );

          try {
            const success = await sendCatalogToAPI(providerName, chunk);

            if (success) {
              successfulChunks++;
              totalSaved += chunk.length;
            } else {
              console.error(`❌ Error en lote ${i + 1}/${totalChunks}`);
            }
          } catch (chunkError) {
            console.error(
              `❌ Excepción en lote ${i + 1}/${totalChunks}:`,
              chunkError
            );
          }
        }

        const allSuccess = successfulChunks === totalChunks;
        setSaveResult({
          success: allSuccess,
          message: allSuccess
            ? `✅ ${totalSaved} productos guardados en ${totalChunks} lotes`
            : `⚠️ ${totalSaved}/${totalProducts} productos guardados (${successfulChunks}/${totalChunks} lotes exitosos)`,
        });
      }

      setUploadProgress("✅ Proceso completado");

      // 3️⃣ Llamar al callback si fue exitoso
      if (saveResult?.success && onUploadComplete) {
        console.log("🔄 Recargando datos de comparación...");
        onUploadComplete();
      }

      // 4️⃣ Limpiar el formulario después del éxito
      if (saveResult?.success) {
        setTimeout(() => {
          setProviderName("");
          setUploadedFile(null);
          setCleanedProducts([]);
          setSaveResult(null);
          setUploadProgress("");
        }, 3000);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Error desconocido al procesar el archivo";
      setError(errorMessage);
      console.error("❌ Error en handleSubmit:", err);
    } finally {
      setIsProcessing(false);
      setIsSaving(false);
    }
  };

  /**
   * 🗑️ Eliminar el archivo cargado
   */
  const handleRemoveFile = () => {
    setUploadedFile(null);
    setCleanedProducts([]);
    setError(null);
    setSaveResult(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 📝 Campo de texto para el nombre del proveedor */}
      <div>
        <label
          htmlFor="providerName"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Nombre del Proveedor <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="providerName"
          value={providerName}
          onChange={(e) => setProviderName(e.target.value)}
          placeholder="Ej: Mediven, Ethon, Canastas..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-colors duration-200"
          disabled={isProcessing || isSaving}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Escribe el nombre exacto del proveedor para este catálogo
        </p>
      </div>

      {/* 📂 Zona de Drag and Drop */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Archivo Excel <span className="text-red-500">*</span>
        </label>

        {!uploadedFile ? (
          // Mostrar dropzone si no hay archivo cargado
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-all duration-200 ease-in-out
              ${
                isDragActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : isDragReject
                  ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                  : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500"
              }
              ${isProcessing || isSaving ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            <input {...getInputProps()} disabled={isProcessing || isSaving} />

            <div className="flex flex-col items-center gap-3">
              <svg
                className="w-12 h-12 text-gray-400"
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

              {isDragReject ? (
                <p className="text-red-600 dark:text-red-400 font-medium">
                  ❌ Tipo de archivo no soportado
                </p>
              ) : isDragActive ? (
                <p className="text-blue-600 dark:text-blue-400 font-medium">
                  📂 Suelta el archivo aquí...
                </p>
              ) : (
                <>
                  <p className="text-gray-700 dark:text-gray-300 font-medium">
                    Arrastra y suelta un archivo Excel aquí
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Formatos soportados: .xls, .xlsx
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          // Mostrar información del archivo cargado
          <div className="border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <svg
                    className="w-10 h-10 text-green-600 dark:text-green-400"
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
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {uploadedFile.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {(uploadedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={isProcessing || isSaving}
                className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Eliminar archivo"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ⚠️ Mensajes de error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-red-700 dark:text-red-400 font-medium">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* 📊 Progreso de subida */}
      {uploadProgress && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-3">
            {(isProcessing || isSaving) && (
              <svg
                className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400"
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
            <p className="text-blue-700 dark:text-blue-300 font-medium">
              {uploadProgress}
            </p>
          </div>
        </div>
      )}

      {/* ✅ Resultado del guardado */}
      {saveResult && (
        <div
          className={`p-4 rounded-lg border ${
            saveResult.success
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">{saveResult.success ? "✅" : "⚠️"}</span>
            <p
              className={`font-medium ${
                saveResult.success
                  ? "text-green-700 dark:text-green-300"
                  : "text-yellow-700 dark:text-yellow-300"
              }`}
            >
              {saveResult.message}
            </p>
          </div>
        </div>
      )}

      {/* 📊 Vista previa de productos procesados */}
      {cleanedProducts.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            📦 Productos procesados: {cleanedProducts.length}
          </h4>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Ver primeros 10 productos
            </summary>
            <pre className="mt-2 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(cleanedProducts.slice(0, 10), null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* 🚀 Botón de envío */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={
            isProcessing || isSaving || !providerName.trim() || !uploadedFile
          }
          className={`
            flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-200
            flex items-center justify-center gap-2
            ${
              isProcessing || isSaving || !providerName.trim() || !uploadedFile
                ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl"
            }
          `}
        >
          {isProcessing || isSaving ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
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
              <span>Procesando...</span>
            </>
          ) : (
            <>
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <span>Subir Catálogo</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default ExcelUploadForm;
