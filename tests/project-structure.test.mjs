import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const source = readFileSync('src/app/_layout.tsx', 'utf8');
for (const name of ['index','annual','monthly','weekly','wellness','routine','backup','restore','insights','privacy']) {
  test(`rota ${name} registrada e tela presente`, () => {
    assert.ok(source.includes(`name="${name}"`));
    assert.ok(existsSync(`src/app/${name}.tsx`));
  });
}
test('backups não chamam deleteDatabaseAsync', () => {
  const code = readFileSync('src/database/restoreRepository.ts', 'utf8');
  assert.equal(code.includes('deleteDatabaseAsync('), false);
  assert.ok(code.includes('integrity_check'));
  assert.ok(code.includes('recoveryFile.write'));
});
