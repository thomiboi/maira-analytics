import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProductRanking {
  ranking: number;
  codigo: string;
  nombre: string;
  unidades: number;
  ingresos: number;
  costo: number;
  margen: number;
  margenDinero: number;
  frecuencia: number;
  crecimiento: number;
}

interface ExportOptions {
  productos: ProductRanking[];
  fechaInicio: string;
  fechaFin: string;
  sucursal: string;
  viewMode: string;
}

// Formatear números para exportación
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('es-CL').format(num);
};

const formatCurrency = (num: number): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(num);
};

// Obtener nombre del modo de vista
const getViewModeName = (viewMode: string): string => {
  switch (viewMode) {
    case 'mas-vendidos':
      return 'Más Vendidos';
    case 'mayor-margen':
      return 'Mayor Margen';
    case 'frecuencia':
      return 'Mayor Frecuencia';
    case 'crecimiento':
      return 'Mayor Crecimiento';
    default:
      return 'Ranking';
  }
};

// Obtener nombre de sucursal
const getSucursalName = (sucursal: string): string => {
  switch (sucursal) {
    case 'todas':
      return 'Todas las Sucursales';
    case 'null':
      return 'Casa Matriz';
    case '2191':
      return 'FM Villa Independencia';
    default:
      return 'Desconocida';
  }
};

/**
 * Exportar ranking a Excel con diseño profesional
 */
export const exportToExcel = (options: ExportOptions): void => {
  const { productos, fechaInicio, fechaFin, sucursal, viewMode } = options;

  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Preparar datos con valores numéricos (sin formato de texto)
  // IMPORTANTE: Para porcentajes, guardar como decimal (ej: 0.25 para 25%)
  const excelData = productos.map((producto) => ({
    'Ranking': producto.ranking,
    'Código': producto.codigo,
    'Producto': producto.nombre,
    'Unidades': producto.unidades,
    'Costo Total': producto.costo,
    'Ingresos': producto.ingresos,
    'Margen %': producto.margen / 100, // Convertir 25 -> 0.25 para formato porcentaje
    'Margen $': producto.margenDinero,
    'Frecuencia': producto.frecuencia,
    'Crecimiento': producto.crecimiento / 100, // Convertir 10 -> 0.10 para formato porcentaje
  }));

  // Crear metadata en las primeras filas
  const metadata = [
    ['Ranking de Productos - Maira Analytics'],
    [`Vista: ${getViewModeName(viewMode)}`],
    [`Sucursal: ${getSucursalName(sucursal)}`],
    [`Período: ${new Date(fechaInicio).toLocaleDateString('es-CL')} - ${new Date(fechaFin).toLocaleDateString('es-CL')}`],
    [`Fecha de exportación: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}`],
    [], // Línea en blanco antes de los datos
  ];

  // Crear worksheet con metadata
  const ws = XLSX.utils.aoa_to_sheet(metadata);

  // Agregar los datos de productos comenzando en la fila 7
  XLSX.utils.sheet_add_json(ws, excelData, { origin: 'A7', skipHeader: false });

  const dataStartRow = 7; // Fila donde empiezan los encabezados
  const lastRow = dataStartRow + productos.length;

  // Aplicar estilos a las celdas
  // Título principal (A1)
  if (ws['A1']) {
    ws['A1'].s = {
      font: { bold: true, sz: 16, color: { rgb: '1F4788' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  // Metadata (A2:A5)
  for (let row = 2; row <= 5; row++) {
    const cell = `A${row}`;
    if (ws[cell]) {
      ws[cell].s = {
        font: { sz: 11 },
        alignment: { horizontal: 'left', vertical: 'center' }
      };
    }
  }

  // Encabezados de tabla (fila 7)
  const headers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  headers.forEach(col => {
    const cell = `${col}${dataStartRow}`;
    if (ws[cell]) {
      ws[cell].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: '3B82F6' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }
  });

  // Aplicar estilos a las filas de datos
  for (let row = dataStartRow + 1; row <= lastRow; row++) {
    const isEven = (row - dataStartRow - 1) % 2 === 0;
    const fillColor = isEven ? 'FFFFFF' : 'F9FAFB';

    // Obtener el valor del margen para colorear
    const margenCell = ws[`G${row}`];
    let margenValue = 0;
    if (margenCell && typeof margenCell.v === 'number') {
      margenValue = margenCell.v * 100;
    }
    
    let margenColor = fillColor;
    if (margenValue >= 30) margenColor = 'D1FAE5'; // Verde claro
    else if (margenValue >= 15) margenColor = 'FEF3C7'; // Amarillo claro
    else if (margenValue > 0) margenColor = 'FEE2E2'; // Rojo claro

    // Ranking (A) - Centrado
    if (ws[`A${row}`]) {
      ws[`A${row}`].s = {
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: fillColor } }
      };
    }

    // Código (B) - Izquierda
    if (ws[`B${row}`]) {
      ws[`B${row}`].s = {
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: { fgColor: { rgb: fillColor } },
        font: { sz: 10 }
      };
    }

    // Producto (C) - Izquierda
    if (ws[`C${row}`]) {
      ws[`C${row}`].s = {
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: { fgColor: { rgb: fillColor } },
        font: { sz: 10 }
      };
    }

    // Unidades (D) - Derecha con formato de número
    if (ws[`D${row}`]) {
      ws[`D${row}`].s = {
        alignment: { horizontal: 'right', vertical: 'center' },
        fill: { fgColor: { rgb: fillColor } },
        numFmt: '#,##0'
      };
    }

    // Costo Total (E) - Derecha con formato de moneda
    if (ws[`E${row}`]) {
      ws[`E${row}`].s = {
        alignment: { horizontal: 'right', vertical: 'center' },
        fill: { fgColor: { rgb: fillColor } },
        numFmt: '$#,##0'
      };
    }

    // Ingresos (F) - Derecha con formato de moneda
    if (ws[`F${row}`]) {
      ws[`F${row}`].s = {
        alignment: { horizontal: 'right', vertical: 'center' },
        fill: { fgColor: { rgb: fillColor } },
        numFmt: '$#,##0'
      };
    }

    // Margen % (G) - Derecha con formato de porcentaje y color condicional
    if (ws[`G${row}`]) {
      ws[`G${row}`].s = {
        alignment: { horizontal: 'right', vertical: 'center' },
        fill: { fgColor: { rgb: margenColor } },
        numFmt: '0.00%', // Formato de porcentaje con 2 decimales
        font: { bold: true }
      };
      // Asegurar que el valor esté como número decimal
      ws[`G${row}`].t = 'n'; // Tipo: número
    }

    // Margen $ (H) - Derecha con formato de moneda
    if (ws[`H${row}`]) {
      ws[`H${row}`].s = {
        alignment: { horizontal: 'right', vertical: 'center' },
        fill: { fgColor: { rgb: fillColor } },
        numFmt: '$#,##0'
      };
    }

    // Frecuencia (I) - Derecha con formato de número
    if (ws[`I${row}`]) {
      ws[`I${row}`].s = {
        alignment: { horizontal: 'right', vertical: 'center' },
        fill: { fgColor: { rgb: fillColor } },
        numFmt: '#,##0'
      };
    }

    // Crecimiento (J) - Derecha con formato de porcentaje
    if (ws[`J${row}`]) {
      ws[`J${row}`].s = {
        alignment: { horizontal: 'right', vertical: 'center' },
        fill: { fgColor: { rgb: fillColor } },
        numFmt: '0.00%' // Formato de porcentaje con 2 decimales
      };
      // Asegurar que el valor esté como número decimal
      ws[`J${row}`].t = 'n'; // Tipo: número
    }
  }

  // Configurar ancho de columnas
  ws['!cols'] = [
    { wch: 10 },  // Ranking
    { wch: 18 },  // Código
    { wch: 45 },  // Producto
    { wch: 12 },  // Unidades
    { wch: 15 },  // Costo Total
    { wch: 15 },  // Ingresos
    { wch: 12 },  // Margen %
    { wch: 15 },  // Margen $
    { wch: 12 },  // Frecuencia
    { wch: 13 },  // Crecimiento
  ];

  // Configurar altura de filas
  ws['!rows'] ??= [];
  ws['!rows'][0] = { hpt: 26 };  // Título
  ws['!rows'][6] = { hpt: 24 };  // Encabezados

  // Aplicar FILTROS AUTOMÁTICOS a los encabezados
  ws['!autofilter'] = { ref: `A${dataStartRow}:J${lastRow}` };

  // Agregar worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Ranking');

  // Generar nombre de archivo
  const fileName = `ranking_${viewMode}_${fechaInicio}_${fechaFin}.xlsx`;

  // Descargar archivo
  XLSX.writeFile(wb, fileName);
};

/**
 * Exportar ranking a PDF
 */
export const exportToPDF = (options: ExportOptions): void => {
  const { productos, fechaInicio, fechaFin, sucursal, viewMode } = options;

  // Crear documento PDF
  const doc = new jsPDF('landscape', 'mm', 'a4');

  // Agregar título
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Ranking de Productos - Maira Analytics', 14, 15);

  // Agregar información de contexto
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const contextY = 25;
  doc.text(`Vista: ${getViewModeName(viewMode)}`, 14, contextY);
  doc.text(`Sucursal: ${getSucursalName(sucursal)}`, 14, contextY + 5);
  doc.text(
    `Período: ${new Date(fechaInicio).toLocaleDateString('es-CL')} - ${new Date(fechaFin).toLocaleDateString('es-CL')}`,
    14,
    contextY + 10
  );
  doc.text(
    `Fecha de exportación: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}`,
    14,
    contextY + 15
  );

  // Preparar datos para la tabla
  const tableData = productos.map((producto) => [
    producto.ranking.toString(),
    producto.codigo,
    producto.nombre,
    formatNumber(producto.unidades),
    formatCurrency(producto.costo),
    formatCurrency(producto.ingresos),
    producto.margen.toFixed(1) + '%',
    formatCurrency(producto.margenDinero),
    producto.frecuencia.toString(),
    (producto.crecimiento >= 0 ? '+' : '') + producto.crecimiento.toFixed(1) + '%',
  ]);

  // Agregar tabla usando autoTable
  autoTable(doc, {
    head: [[
      '#',
      'Código',
      'Producto',
      'Unidades',
      'Costo Total',
      'Ingresos',
      'Margen %',
      'Margen $',
      'Frecuencia',
      'Crecimiento',
    ]],
    body: tableData,
    startY: contextY + 20,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246], // Blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 }, // Ranking
      1: { halign: 'left', cellWidth: 25 },   // Código
      2: { halign: 'left', cellWidth: 60 },   // Producto
      3: { halign: 'right', cellWidth: 18 },  // Unidades
      4: { halign: 'right', cellWidth: 25 },  // Costo Total
      5: { halign: 'right', cellWidth: 25 },  // Ingresos
      6: { halign: 'right', cellWidth: 18 },  // Margen %
      7: { halign: 'right', cellWidth: 25 },  // Margen $
      8: { halign: 'right', cellWidth: 18 },  // Frecuencia
      9: { halign: 'right', cellWidth: 20 },  // Crecimiento
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  });

  // Generar nombre de archivo
  const fileName = `ranking_${viewMode}_${fechaInicio}_${fechaFin}.pdf`;

  // Descargar PDF
  doc.save(fileName);
};
