// Thin csv-parse wrappers. Rows come back as header-keyed string records
// (columns: true); BOM is stripped; strict quoting (relax_quotes stays off).
import { createReadStream } from 'node:fs';
import { parse, type Options as CsvParseOptions } from 'csv-parse';

export type CsvRow = Record<string, string>;

export interface CsvOptions {
  delimiter?: string;
  /** Stream encoding; default utf-8. */
  encoding?: BufferEncoding;
  /** Skip fully empty lines; default true. */
  skipEmptyLines?: boolean;
}

function parserOptions(opts: CsvOptions): CsvParseOptions {
  return {
    columns: true,
    bom: true,
    delimiter: opts.delimiter ?? ',',
    skip_empty_lines: opts.skipEmptyLines ?? true,
    relax_quotes: false,
  };
}

/**
 * Stream a CSV file row by row (constant memory — fit for the multi-GB USDA
 * and OFF dumps). `onRow` may be async; rows are processed sequentially.
 * Returns the number of data rows read.
 */
export async function streamCsv(
  filePath: string,
  onRow: (row: CsvRow, index: number) => void | Promise<void>,
  opts: CsvOptions = {},
): Promise<number> {
  const parser = createReadStream(filePath, { encoding: opts.encoding ?? 'utf-8' }).pipe(
    parse(parserOptions(opts)),
  );
  let index = 0;
  for await (const row of parser as AsyncIterable<CsvRow>) {
    await onRow(row, index);
    index += 1;
  }
  return index;
}

/** Read a small CSV file fully into memory. */
export async function readCsvAll(filePath: string, opts: CsvOptions = {}): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];
  await streamCsv(
    filePath,
    (row) => {
      rows.push(row);
    },
    opts,
  );
  return rows;
}
