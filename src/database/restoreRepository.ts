import * as SQLite from 'expo-sqlite';
import { File, FileMode, Paths } from 'expo-file-system';

const DB_NAME = 'dot-journal.db';
const HEADER = [83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0];
const REQUIRED = ['daily_entries', 'daily_checks', 'habits'];
export type RestorePreview = { fileName: string; bytes: number; tables: string[]; totalRows: number; integrity: string };
export type PreparedRestore = { preview: RestorePreview; bytes: Uint8Array };

async function readSqliteBytes(file: File): Promise<Uint8Array> {
  if (!file.exists || !file.size || file.size < 100 || file.size > 25 * 1024 * 1024) {
    throw new Error('Selecione um SQLite entre 100 bytes e 25 MB.');
  }
  const handle = file.open(FileMode.ReadOnly);
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < file.size) {
      const chunk = await handle.readBytes(Math.min(1024 * 1024, file.size - size));
      if (chunk.length === 0) throw new Error('Leitura incompleta do arquivo.');
      chunks.push(chunk);
      size += chunk.length;
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  } finally { handle.close(); }
}

/**
 * Bancos do Dot Journal usam WAL. O deserialize para ':memory:' pode falhar
 * no Android ao abrir um snapshot com cabeçalho WAL. Portanto, inspecionamos
 * uma cópia TEMPORÁRIA escrita no cache interno, nunca o banco principal.
 *
 * Fecha a conexão antes de apagar os arquivos auxiliares -wal/-shm.
 */
async function withTemporaryDatabase<T>(
  bytes: Uint8Array,
  action: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const name = `dot-journal-inspect-${Date.now()}-${Math.random().toString(36).slice(2, 12)}.sqlite`;
  const temporaryFile = new File(Paths.cache, name);
  let temporaryDb: SQLite.SQLiteDatabase | null = null;
  await temporaryFile.write(bytes);
  if (!temporaryFile.exists || temporaryFile.size !== bytes.length) {
    throw new Error('Não foi possível criar a cópia temporária para validação.');
  }
  try {
    // SQLite espera um diretório nativo do Android, não uma URI file://.
    const directory = decodeURIComponent(Paths.cache.uri.replace(/^file:\/\//, ''));
    temporaryDb = await SQLite.openDatabaseAsync(name, { useNewConnection: true }, directory);
    return await action(temporaryDb);
  } finally {
    if (temporaryDb) await temporaryDb.closeAsync();
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const file = new File(Paths.cache, name + suffix);
      if (file.exists) {
        try { file.delete(); } catch (error) {
          console.warn('Falha ao limpar arquivo temporário de restauração:', suffix, error);
        }
      }
    }
  }
}

async function inspect(bytes: Uint8Array, requiredTables: readonly string[] = REQUIRED): Promise<Omit<RestorePreview, 'fileName' | 'bytes'>> {
  if (bytes.length < 100 || HEADER.some((b, i) => bytes[i] !== b)) throw new Error('Arquivo não é um banco SQLite válido.');
  return withTemporaryDatabase(bytes, async (restored) => {
    const result = await restored.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (result?.integrity_check !== 'ok') throw new Error('O banco selecionado falhou no teste de integridade.');
    const rows = await restored.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tables = rows.map(x => x.name);
    const missing = requiredTables.filter((table) => !tables.includes(table));
    if (tables.length === 0) {
      throw new Error('O SQLite temporário abriu sem tabelas. O arquivo pode estar vazio, incompleto ou incompatível. Nenhum dado local foi alterado.');
    }
    if (missing.length > 0) throw new Error(`Backup incompatível: faltam tabelas essenciais do Dot Journal: ${missing.join(', ')}.`);
    let totalRows = 0;
    for (const table of tables) {
      if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(table)) throw new Error('Nome de tabela inesperado.');
      const n = await restored.getFirstAsync<{ value: number }>(`SELECT COUNT(*) AS value FROM "${table}"`);
      totalRows += n?.value ?? 0;
    }
    return { tables, totalRows, integrity: 'ok' };
  });
}

/**
 * Valida bytes SQLite sem modificar o banco ativo.
 * Também é usado pela restauração de backups criptografados da nuvem.
 */
export async function prepareRestoreBytes(
  fileName: string,
  bytes: Uint8Array,
  requiredTables: readonly string[] = REQUIRED
): Promise<PreparedRestore> {
  if (bytes.length < 100 || bytes.length > 25 * 1024 * 1024) {
    throw new Error('O backup precisa ter entre 100 bytes e 25 MB.');
  }
  const safeBytes = new Uint8Array(bytes);
  const details = await inspect(safeBytes, requiredTables);
  return {
    bytes: safeBytes,
    preview: { fileName, bytes: safeBytes.length, ...details },
  };
}

/** Seleciona e INSPECIONA um backup sem tocar no banco real. */
export async function prepareRestore(): Promise<PreparedRestore | null> {
  const picked = await File.pickFileAsync();
  const file = Array.isArray(picked) ? picked[0] : picked;
  if (!file) return null;
  const bytes = await readSqliteBytes(file);
  return prepareRestoreBytes(file.name, bytes);
}

/**
 * Restauração experimental e protegida: mantém um arquivo de recuperação ANTES
 * de modificar o banco real e tenta rollback via SQLite online backup.
 * Executar apenas com as outras telas fechadas e reiniciar o app em seguida.
 */
export async function applyRestore(prepared: PreparedRestore): Promise<string> {
  await inspect(prepared.bytes); // repete a validação no momento da escrita
  const live = await SQLite.openDatabaseAsync(DB_NAME);
  const state = await live.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
  if (state?.integrity_check !== 'ok') throw new Error('Banco atual com integridade inválida. Restauração bloqueada.');
  const safety = await live.serializeAsync();
  const recoveryName = `dot-journal-recovery-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
  const recoveryFile = new File(Paths.document, recoveryName);
  await recoveryFile.write(safety);
  if (!recoveryFile.exists || recoveryFile.size !== safety.length) throw new Error('Não foi possível salvar a cópia de segurança. Nada foi alterado.');
  let touched = false;
  try {
    await withTemporaryDatabase(prepared.bytes, async (source) => {
      touched = true;
      await SQLite.backupDatabaseAsync({
        sourceDatabase: source, destDatabase: live,
        sourceDatabaseName: 'main', destDatabaseName: 'main',
      });
    });
    const after = await live.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (after?.integrity_check !== 'ok') throw new Error('Falha na integridade após restaurar.');
    return recoveryName;
  } catch (error) {
    if (touched) {
      try {
        await withTemporaryDatabase(safety, async (rescue) => {
          await SQLite.backupDatabaseAsync({
            sourceDatabase: rescue, destDatabase: live,
            sourceDatabaseName: 'main', destDatabaseName: 'main',
          });
        });
      } catch (rollbackError) {
        throw new Error('Falha crítica ao recuperar o banco atual. Preserve o arquivo de recuperação e não faça novas alterações. ' + String(rollbackError));
      }
    }
    throw error;
  }
}
