import * as XLSX from 'xlsx';
import { fileKindFrom } from '@teakflow/shared';

export function spreadsheetPreview(
  body: Buffer,
  originalName: string,
  contentType: string,
): string[][] | undefined {
  if (fileKindFrom(contentType, originalName) !== 'spreadsheet') {
    return undefined;
  }
  try {
    const workbook = XLSX.read(body, { type: 'buffer', sheetRows: 12 });
    const name = workbook.SheetNames[0];
    if (!name) {
      return undefined;
    }
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
      workbook.Sheets[name]!,
      {
        header: 1,
        defval: '',
        raw: false,
      },
    );
    return rows
      .slice(0, 12)
      .map((row) => row.slice(0, 8).map((cell) => String(cell ?? '')));
  } catch {
    return undefined;
  }
}
