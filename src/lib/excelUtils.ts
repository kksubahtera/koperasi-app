/**
 * Excel Utility Library using ExcelJS
 * 
 * This library replaces the vulnerable xlsx package with the safer exceljs library.
 * It provides utility functions for reading and writing Excel files.
 */

import ExcelJS from 'exceljs';

// ============= TYPES =============

export interface ColumnConfig {
  width: number;
  header?: string;
}

export interface SheetData {
  name: string;
  data: any[][];
  columns?: ColumnConfig[];
}

export interface JsonSheetData {
  name: string;
  data: Record<string, any>[];
  columns?: ColumnConfig[];
}

// ============= READING EXCEL FILES =============

/**
 * Reads an Excel file and returns JSON data from the first sheet
 */
export const readExcelFile = async (file: File): Promise<any[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }
  
  return worksheetToJson(worksheet);
};

/**
 * Reads an Excel file and returns raw array-of-arrays data from the first sheet
 * Useful when you need to access data by column index rather than header name
 */
export const readExcelFileRaw = async (file: File): Promise<any[][]> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in the file');
  }
  
  return worksheetToRawArray(worksheet);
};

/**
 * Reads an Excel file and returns data from all sheets
 */
export const readExcelFileAllSheets = async (file: File): Promise<Record<string, any[]>> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const result: Record<string, any[]> = {};
  
  workbook.worksheets.forEach(worksheet => {
    result[worksheet.name] = worksheetToJson(worksheet);
  });
  
  return result;
};

/**
 * Converts a worksheet to raw array of arrays
 */
const worksheetToRawArray = (worksheet: ExcelJS.Worksheet): any[][] => {
  const data: any[][] = [];
  
  worksheet.eachRow((row, rowNumber) => {
    const rowData: any[] = [];
    const lastColumn = row.cellCount;
    
    for (let colNum = 1; colNum <= lastColumn; colNum++) {
      const cell = row.getCell(colNum);
      rowData.push(cell.value);
    }
    
    data.push(rowData);
  });
  
  return data;
};

/**
 * Converts a worksheet to JSON array
 */
const worksheetToJson = (worksheet: ExcelJS.Worksheet): any[] => {
  const jsonData: any[] = [];
  const headers: string[] = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row is headers
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || '');
      });
    } else {
      // Data rows
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      // Only add row if it has at least one non-empty value
      if (Object.values(rowData).some(v => v !== null && v !== undefined && v !== '')) {
        jsonData.push(rowData);
      }
    }
  });
  
  return jsonData;
};

// ============= WRITING EXCEL FILES =============

/**
 * Creates a workbook from array-of-arrays data and downloads it
 */
export const createAndDownloadExcel = async (
  sheets: SheetData[],
  filename: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  
  sheets.forEach(sheet => {
    const worksheet = workbook.addWorksheet(sheet.name);
    
    // Add data rows
    sheet.data.forEach(row => {
      worksheet.addRow(row);
    });
    
    // Set column widths if provided
    if (sheet.columns) {
      worksheet.columns = sheet.columns.map((col, index) => ({
        width: col.width,
        key: String(index),
      }));
    }
    
    // Style header row (first row)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F5F5' }
    };
  });
  
  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
};

/**
 * Creates a workbook from JSON data and downloads it
 */
export const createAndDownloadExcelFromJson = async (
  sheets: JsonSheetData[],
  filename: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  
  sheets.forEach(sheet => {
    const worksheet = workbook.addWorksheet(sheet.name);
    
    if (sheet.data.length === 0) {
      return;
    }
    
    // Get headers from first object
    const headers = Object.keys(sheet.data[0]);
    
    // Add header row
    worksheet.addRow(headers);
    
    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F5F5' }
    };
    
    // Add data rows
    sheet.data.forEach(item => {
      const row = headers.map(header => item[header]);
      worksheet.addRow(row);
    });
    
    // Set column widths if provided, otherwise auto-calculate
    if (sheet.columns) {
      worksheet.columns = sheet.columns.map((col, index) => ({
        width: col.width,
        key: headers[index] || String(index),
      }));
    } else {
      // Auto-calculate column widths based on header length
      headers.forEach((header, index) => {
        const column = worksheet.getColumn(index + 1);
        column.width = Math.max(header.length + 2, 10);
      });
    }
  });
  
  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
};

/**
 * Creates a simple template Excel file with one sheet
 */
export const createTemplateExcel = async (
  templateData: Record<string, any>[],
  sheetName: string,
  filename: string,
  columnWidths?: number[]
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  
  if (templateData.length === 0) {
    throw new Error('Template data cannot be empty');
  }
  
  // Get headers from first object
  const headers = Object.keys(templateData[0]);
  
  // Add header row
  worksheet.addRow(headers);
  
  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' }
  };
  
  // Add data rows
  templateData.forEach(item => {
    const row = headers.map(header => item[header]);
    worksheet.addRow(row);
  });
  
  // Set column widths
  if (columnWidths) {
    columnWidths.forEach((width, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = width;
    });
  } else {
    // Auto-calculate based on header length
    headers.forEach((header, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = Math.max(header.length + 2, 12);
    });
  }
  
  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
};

/**
 * Creates a workbook buffer for custom processing
 */
export const createWorkbookBuffer = async (
  sheets: JsonSheetData[]
): Promise<ArrayBuffer> => {
  const workbook = new ExcelJS.Workbook();
  
  sheets.forEach(sheet => {
    const worksheet = workbook.addWorksheet(sheet.name);
    
    if (sheet.data.length === 0) {
      return;
    }
    
    // Get headers from first object
    const headers = Object.keys(sheet.data[0]);
    
    // Add header row
    worksheet.addRow(headers);
    
    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    
    // Add data rows
    sheet.data.forEach(item => {
      const row = headers.map(header => item[header]);
      worksheet.addRow(row);
    });
    
    // Auto-calculate column widths
    headers.forEach((header, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = Math.max(header.length + 2, 10);
    });
  });
  
  return await workbook.xlsx.writeBuffer() as ArrayBuffer;
};

// ============= HELPER FUNCTIONS =============

/**
 * Downloads a buffer as a file
 */
const downloadBuffer = (buffer: ExcelJS.Buffer, filename: string): void => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Converts column width from xlsx format (wch) to exceljs format
 * xlsx uses character width, exceljs is similar but slightly different
 */
export const convertColumnWidth = (xlsxWidth: number): number => {
  // ExcelJS width is roughly the same as xlsx wch
  return xlsxWidth;
};

// ============= MULTI-SHEET SUPPORT =============

export interface ArrayOfArraysSheetData {
  name: string;
  data: any[][];
  columns?: number[];
}

/**
 * Creates and downloads Excel with array-of-arrays data (supports multiple sheets)
 * This is useful for reports with headers and summary rows
 */
export const createAndDownloadExcelAoA = async (
  sheets: ArrayOfArraysSheetData[],
  filename: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  
  sheets.forEach(sheet => {
    const worksheet = workbook.addWorksheet(sheet.name);
    
    // Add data rows
    sheet.data.forEach((row, rowIndex) => {
      const excelRow = worksheet.addRow(row);
      
      // Style first row as header
      if (rowIndex === 0) {
        excelRow.font = { bold: true };
        excelRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' }
        };
      }
    });
    
    // Set column widths if provided
    if (sheet.columns) {
      sheet.columns.forEach((width, index) => {
        const column = worksheet.getColumn(index + 1);
        column.width = width;
      });
    }
  });
  
  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
};

/**
 * Creates and downloads Excel with mixed sheet types (JSON + Array-of-Arrays)
 */
export interface MixedSheetData {
  name: string;
  type: 'json' | 'aoa';
  data: any[] | any[][];
  columns?: number[];
}

export const createAndDownloadExcelMixed = async (
  sheets: MixedSheetData[],
  filename: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  
  sheets.forEach(sheet => {
    const worksheet = workbook.addWorksheet(sheet.name);
    
    if (sheet.type === 'json' && Array.isArray(sheet.data) && sheet.data.length > 0 && typeof sheet.data[0] === 'object' && !Array.isArray(sheet.data[0])) {
      // JSON data
      const jsonData = sheet.data as Record<string, any>[];
      const headers = Object.keys(jsonData[0]);
      
      // Add header row
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' }
      };
      
      // Add data rows
      jsonData.forEach(item => {
        const row = headers.map(header => item[header]);
        worksheet.addRow(row);
      });
      
      // Auto-calculate column widths
      if (!sheet.columns) {
        headers.forEach((header, index) => {
          const column = worksheet.getColumn(index + 1);
          column.width = Math.max(header.length + 2, 12);
        });
      }
    } else if (sheet.type === 'aoa') {
      // Array-of-arrays data
      const aoaData = sheet.data as any[][];
      aoaData.forEach((row, rowIndex) => {
        const excelRow = worksheet.addRow(row);
        
        // Style first row as header
        if (rowIndex === 0 && Array.isArray(row) && row.length > 0) {
          excelRow.font = { bold: true };
          excelRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          };
        }
      });
    }
    
    // Set column widths if provided
    if (sheet.columns) {
      sheet.columns.forEach((width, index) => {
        const column = worksheet.getColumn(index + 1);
        column.width = width;
      });
    }
  });
  
  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
};
