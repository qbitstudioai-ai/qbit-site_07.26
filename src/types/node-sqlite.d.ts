/**
 * Типы встроенного модуля `node:sqlite`.
 *
 * В проекте стоит `@types/node@20`, где этого модуля ещё нет, а рантайм — Node 24, где он есть.
 * Объявление описывает ровно ту часть API, которой пользуется `src/server/db/client.ts`; когда
 * `@types/node` обновится до 24-й версии, файл можно будет удалить.
 */
declare module "node:sqlite" {
  export type SQLInputValue = string | number | bigint | boolean | null | Uint8Array;
  export type SQLOutputValue = string | number | bigint | null | Uint8Array;

  export interface StatementSync {
    all(...params: SQLInputValue[]): Record<string, SQLOutputValue>[];
    get(...params: SQLInputValue[]): Record<string, SQLOutputValue> | undefined;
    run(...params: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }

  export interface DatabaseSyncOptions {
    open?: boolean;
    readOnly?: boolean;
    enableForeignKeyConstraints?: boolean;
  }

  export class DatabaseSync {
    constructor(path: string, options?: DatabaseSyncOptions);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
