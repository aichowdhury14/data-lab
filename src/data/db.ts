import initSqlJs, { type Database, type SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { DATASETS, columnsOf } from "./generate";
import { SCHEMA } from "./schema";

export { SCHEMA };

let dbPromise: Promise<Database> | null = null;

/** Opens an in-memory SQLite database preloaded with the demo datasets. */
export function getDb(): Promise<Database> {
  dbPromise ??= (async () => {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const db = new SQL.Database();
    for (const ds of DATASETS) {
      const cols = columnsOf(ds.rows);
      db.run(`CREATE TABLE ${ds.id} (${SCHEMA[ds.id]});`);
      const stmt = db.prepare(`INSERT INTO ${ds.id} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`);
      db.run("BEGIN");
      for (const r of ds.rows) stmt.run(cols.map((c) => r[c]) as SqlValue[]);
      db.run("COMMIT");
      stmt.free();
    }
    return db;
  })();
  return dbPromise;
}

/** Drops the shared database so the next query rebuilds it from the sample data. */
export function resetDb() {
  dbPromise = null;
}

export interface QueryResult {
  columns: string[];
  rows: SqlValue[][];
  ms: number;
}

export async function runQuery(sql: string): Promise<QueryResult> {
  const db = await getDb();
  const t0 = performance.now();
  const res = db.exec(sql);
  const ms = performance.now() - t0;
  const last = res[res.length - 1];
  return last ? { columns: last.columns, rows: last.values, ms } : { columns: [], rows: [], ms };
}

/** A throw-away database for the pipeline demo, so learners can't break the shared one. */
export async function sandboxQuery(setup: string, sql: string): Promise<QueryResult> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database();
  try {
    db.run(setup);
    const t0 = performance.now();
    const res = db.exec(sql);
    const ms = performance.now() - t0;
    const last = res[res.length - 1];
    return last ? { columns: last.columns, rows: last.values, ms } : { columns: [], rows: [], ms };
  } finally {
    db.close();
  }
}
