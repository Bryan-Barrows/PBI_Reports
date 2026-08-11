import Papa from "papaparse";
import type { ImportRow } from "./types";

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

// Parses pasted or uploaded text (CSV, TSV, or a copy-pasted table which
// browsers usually give as tab-separated) into headers + rows.
export function parseTable(text: string): ParsedTable {
  const result = Papa.parse<string[]>(text.trim(), {
    skipEmptyLines: true,
  });
  const data = result.data.filter((row) => row.length > 0);
  if (data.length === 0) return { headers: [], rows: [] };

  const [headerRow, ...rest] = data;
  return { headers: headerRow.map((h) => h.trim()), rows: rest };
}

export interface ColumnMapping {
  name: number | null;
  team: number | null;
  position: number | null;
  bye: number | null;
  value: number | null; // rank or ADP column
}

// Best-effort guess at which column is which, based on common header names
// used by FantasyPros, Fantasy Points, Draft Sharks, Sleeper exports, etc.
export function guessMapping(headers: string[]): ColumnMapping {
  const find = (patterns: RegExp[]): number | null => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (patterns.some((p) => p.test(h))) return i;
    }
    return null;
  };

  return {
    name: find([/^name$/, /player/, /^name/]),
    team: find([/^team$/, /^tm$/]),
    position: find([/^pos/]),
    bye: find([/^bye/]),
    value: find([/^rank/, /^ecr/, /^adp/, /overall/, /^rk$/]),
  };
}

export function applyMapping(
  table: ParsedTable,
  mapping: ColumnMapping
): ImportRow[] {
  const rows: ImportRow[] = [];
  table.rows.forEach((row, idx) => {
    const name = mapping.name !== null ? row[mapping.name]?.trim() : "";
    if (!name) return;
    const team =
      mapping.team !== null ? row[mapping.team]?.trim().toUpperCase() : "";
    const position =
      mapping.position !== null
        ? row[mapping.position]?.trim().toUpperCase()
        : "";
    const byeRaw = mapping.bye !== null ? row[mapping.bye] : null;
    const bye = byeRaw ? parseInt(byeRaw, 10) : null;
    const valueRaw = mapping.value !== null ? row[mapping.value] : null;
    // Fall back to row order (1-based) as the rank if no value column mapped.
    const value = valueRaw
      ? parseFloat(valueRaw.replace(/[^0-9.]/g, ""))
      : idx + 1;

    rows.push({
      name,
      team: team || "",
      position: position || "",
      bye: bye && !Number.isNaN(bye) ? bye : null,
      value: Number.isNaN(value) ? null : value,
    });
  });
  return rows;
}
