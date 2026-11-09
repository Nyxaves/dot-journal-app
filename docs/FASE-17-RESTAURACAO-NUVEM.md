
# Fase 17 — Restauração de backups privados da nuvem

## Objetivo

Permitir recuperar no Android um backup `.djbackup` guardado no bucket privado do Supabase, usando a chave de recuperação pessoal. O SQLite local continua sendo o banco principal.

## Fluxo

1. O usuário entra na mesma conta Supabase.
2. Em um aparelho novo, importa a chave de recuperação de 64 caracteres na tela Backup privado e confirma que guardou uma cópia externa.
3. O aplicativo lista os backups da pasta privada do usuário.
4. O usuário escolhe um arquivo e toca em **Baixar e verificar para restaurar**.
5. O aplicativo baixa o objeto autenticado do Storage.
6. Confere o cabeçalho `DJBK` e a versão do formato.
7. Descriptografa localmente com AES-256-GCM. A chave nunca é enviada ao Supabase.
8. Deserializa o SQLite em memória, executa `PRAGMA integrity_check`, verifica as tabelas essenciais e conta os registros.
9. A tela mostra o resumo e exige digitar `RESTAURAR`.
10. Antes de substituir o banco ativo, cria uma cópia de recuperação em `Documents`.
11. Usa `SQLite.backupDatabaseAsync` para aplicar o snapshot.
12. Executa nova verificação de integridade. Se a escrita falhar, tenta rollback usando o snapshot anterior.

## Tabelas verificadas

- `daily_entries`
- `daily_checks`
- `habits`
- `journal_events`
- `annual_goals`
- `personal_day_tracking`
- `wellness_entries`
- `routine_blocks`
- `routine_categories`
- `routine_settings`
- `weekly_goals`
- `micro_goals`

## Proteção de aparelho novo

A verificação automática diária não envia o primeiro backup quando não existe um horário de backup bem-sucedido registrado localmente. Isso evita que um celular recém-configurado envie um banco vazio antes de o usuário restaurar seu histórico. Depois de uma restauração bem-sucedida, o horário local é atualizado para evitar um upload automático imediato.

## Segurança e limitações

- A restauração substitui o banco SQLite inteiro; não existe mesclagem.
- A chave precisa ser a mesma usada para criptografar o arquivo.
- A chave é importada e armazenada localmente no SecureStore.
- O backup baixado e descriptografado permanece no processo local do aparelho.
- A cópia do banco anterior é salva em `Documents` antes da substituição.
- Depois da restauração, feche completamente e reabra o Dot Journal para que as telas/repositórios recarreguem os dados.
- Não desinstale o aplicativo nem limpe os dados durante o processo.
- A restauração da nuvem deve ser testada primeiro com um backup e dados que possam ser recuperados.

## Validação manual recomendada

1. Confirme que existe ao menos um backup no Storage.
2. Faça uma cópia externa do banco atual pelo fluxo de backup local.
3. Prepare a restauração e confira nome, integridade, tabelas e contagem de registros.
4. Cancele uma primeira vez para confirmar que nada foi alterado.
5. Prepare novamente e confirme com `RESTAURAR`.
6. Feche completamente e reabra o aplicativo.
7. Confira diário, hábitos, metas, eventos, humor, ciclo menstrual, bem-estar e rotina.
8. Confira se o arquivo de recuperação do banco anterior foi criado em `Documents`.

## Automação diária

A automação diária existente continua sendo uma verificação ao abrir a central de backup, não uma tarefa garantida em segundo plano pelo Android. Em um aparelho novo, o primeiro backup é sempre manual até que exista um horário local de backup registrado.
