# Fase 16 — Backup privado na nuvem

## Objetivo

O SQLite continua sendo o banco principal e único banco de dados do aplicativo. O Supabase é usado somente para autenticação pessoal e armazenamento de cópias criptografadas do arquivo SQLite. Não há sincronização de registros nem tabelas de diário no PostgreSQL.

## Dependências

Na raiz do projeto, execute:

```powershell
npx expo install @supabase/supabase-js expo-crypto expo-secure-store react-native-url-polyfill
```

Depois confira as versões:

```powershell
npx expo install --check
```

## Configurar o Supabase

1. Crie um projeto no painel do Supabase.
2. Abra **Project Settings → API** (ou o painel **Connect**) e copie o Project URL e a Publishable key.
3. Crie `.env.local` na raiz do projeto, usando `.env.example` como modelo:

```env
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
```

4. Nunca use nem coloque no aplicativo uma chave `service_role` ou secret key.
5. Abra **SQL Editor**, cole o conteúdo de `supabase/setup.sql` e execute.
6. O script cria o bucket privado `dot-journal-private-backups` e políticas de Storage que restringem cada usuário à própria pasta.
7. Abra **Authentication → Providers → Email** e mantenha e-mail/senha habilitado.
8. Inicie o aplicativo e acesse **Proteção dos meus dados → Backup privado**.
9. Crie sua conta pessoal. Se a confirmação de e-mail estiver habilitada, confirme a mensagem antes de entrar.
10. Depois de criar sua única conta, desative novos cadastros em Authentication → Settings, para impedir registros adicionais.
11. Gere a chave de recuperação, copie os 64 caracteres e guarde-os em um gerenciador de senhas ou em local físico seguro.
12. Confirme que guardou a chave e envie o primeiro backup.

## Instalação local

Depois de preencher `.env.local`:

```powershell
npx expo start -c
```

Para testar no APK, gere uma nova build depois de instalar as dependências nativas:

```powershell
eas build --platform android --profile preview
```

## Como a proteção funciona

- O banco SQLite é serializado no aparelho.
- A integridade SQLite é verificada antes do envio.
- O snapshot é criptografado no aparelho com AES-256-GCM usando `expo-crypto`.
- Somente o arquivo cifrado é enviado ao bucket privado.
- A chave de recuperação não é enviada ao Supabase.
- A sessão de autenticação é guardada no Android SecureStore.
- O bucket exige autenticação e políticas de Storage limitam acesso à pasta do próprio usuário.
- O backup diário é verificado quando a central de backup é aberta. Se já passou 24 horas desde o último envio bem-sucedido, o aplicativo tenta enviar uma nova cópia.

## Chave de recuperação — MUITO IMPORTANTE

A chave tem 64 caracteres hexadecimais e é a única forma de descriptografar os backups em um aparelho novo nesta versão.

- Guarde a chave fora do celular.
- Não envie a chave para o Supabase.
- Não coloque a chave no GitHub, em screenshots ou junto dos arquivos de backup.
- Se perder a chave, os backups criptografados não poderão ser recuperados.
- No aparelho atual, a chave fica no SecureStore. Em Android, ela não deve ser considerada recuperável após desinstalar o aplicativo ou perder o aparelho.

## Limitações desta entrega

- Esta fase implementa conta, chave, envio criptografado e listagem de backups.
- A restauração diretamente da nuvem será implementada na Fase 17.
- A verificação automática diária acontece ao abrir a central de backup; não é uma tarefa garantida em segundo plano quando o Android encerra o aplicativo.
- A conta Supabase é pessoal. Após criá-la, desative novos cadastros.
- O projeto Supabase precisa permanecer ativo para permitir os envios e a recuperação futura.
- A primeira configuração e o primeiro envio exigem internet.

## Testes antes de confiar nos backups

1. Crie a conta e confirme o e-mail, se solicitado.
2. Gere e salve a chave fora do celular.
3. Envie um backup.
4. Confira se o arquivo aparece na lista da central e no bucket privado.
5. Verifique que o objeto termina em `.djbackup` e não abre como SQLite comum.
6. Saia e entre novamente na conta.
7. Confirme que a sessão e a lista continuam funcionando.
8. Não apague o banco local nem desinstale o app. A restauração de nuvem será validada na próxima fase.

## Segurança

O arquivo é criptografado antes do upload com AES-GCM, que autentica o conteúdo cifrado. A chave é gerada localmente e mantida no SecureStore. O bucket é privado e as políticas RLS restringem operações à pasta cujo primeiro segmento corresponde ao ID autenticado.

A Publishable key é usada no cliente e não é um segredo administrativo; a segurança depende das políticas do bucket. Nunca inclua uma service role key no aplicativo.
