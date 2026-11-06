import * as SQLite from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const DATABASE_NAME = 'dot-journal.db';

export type BackupSummary = {
  fileName: string;
  bytes: number;
  integrity: string;
};

/** Exporta uma cópia consistente. NÃO altera nem fecha conexões do app. */
export async function exportJournalBackup(): Promise<BackupSummary> {
  const supported = await Sharing.isAvailableAsync();
  if (!supported) throw new Error('Compartilhamento indisponível neste dispositivo.');

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  // Nao executa migracoes nem altera tabelas; verifica a base antes da exportacao.
  const check = await db.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
  const integrity = check?.integrity_check ?? 'unknown';
  if (integrity !== 'ok') {
    throw new Error(`Integridade SQLite não aprovada: ${integrity}`);
  }

  // serializeAsync inclui um snapshot consistente mesmo quando o journal é WAL.
  const data = await db.serializeAsync();
  const header = [83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0];
  if (data.byteLength < 100 || header.some((b, i) => data[i] !== b)) {
    throw new Error('O backup não contém um cabeçalho SQLite válido.');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `dot-journal-backup-${stamp}.sqlite`;
  const file = new File(Paths.cache, fileName);
  await file.write(data);
  if (!file.exists || file.size !== data.byteLength) {
    throw new Error('Não foi possível confirmar a gravação do backup.');
  }

  // O usuário precisa escolher um destino EXTERNO (Arquivos, Drive, etc.).
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.sqlite3',
    dialogTitle: 'Salvar backup do Dot Journal',
    UTI: 'public.database',
  });
  return { fileName, bytes: data.byteLength, integrity };
}
