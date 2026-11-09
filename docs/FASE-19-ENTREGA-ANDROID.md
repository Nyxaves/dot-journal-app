# Fase 19 — Entrega pessoal Android

**Projeto:** Dot Journal  
**Plataforma:** Android  
**Objetivo:** preparar e entregar uma versão pessoal estável, sem publicação na Play Store.

## Escopo

- Consolidar a auditoria funcional da Fase 18 (39/39 verificações relatadas como aprovadas).
- Validar TypeScript, testes automatizados e compatibilidade Expo.
- Documentar instalação, backup e recuperação de dados.
- Preparar a configuração de build APK com ambiente `preview`.
- Integrar a entrega à `develop` e, depois, à `main` por Pull Requests revisados.

## Instalação segura

1. Identificar o perfil de build usado anteriormente e confirmar a geração de um APK, não apenas de um AAB.
2. Instalar o novo APK **por cima** do aplicativo existente, preservando os dados locais.
3. **Não desinstalar** o aplicativo e não usar a opção de limpar armazenamento.
4. Se a instalação for rejeitada, verificar o `android.package`, a assinatura do APK e a versão do build antes de prosseguir.
5. Conferir os registros no diário, hábitos e demais áreas após abrir o aplicativo.

## Backup e recuperação

### Antes de trocar de celular ou reinstalar

1. Criar backup manual no aplicativo.
2. Confirmar que aparece na listagem privada da nuvem.
3. Baixar e verificar o backup, conferindo integridade do SQLite, tabelas e registros.
4. Manter a chave de recuperação fora do celular, em um local seguro. **Não publicar no GitHub**.
5. Sempre que possível, exportar também uma cópia local para armazenamento externo seguro.

### Em outro aparelho

1. Instalar uma versão compatível do aplicativo.
2. Entrar na conta correta do Supabase.
3. Recuperar/importar a chave de recuperação conforme o fluxo disponível no aplicativo.
4. Selecionar o backup pretendido e realizar a pré-visualização.
5. Conferir data, integridade, tabelas e total de registros.
6. Somente então confirmar a restauração completa.
7. Reiniciar o aplicativo e verificar os registros.

**Atenção:** a restauração substitui o banco local. Evite restaurar sobre dados novos sem antes criar uma cópia independente. A aprovação no aparelho atual não substitui o teste de migração para outro aparelho.

## Segurança e privacidade

- SQLite é o banco principal, local ao Android.
- Supabase Auth e Storage são usados para backups privados.
- Os backups são criptografados no dispositivo antes do envio.
- A chave de recuperação não deve ser salva em README, commits, screenshots, issues ou PRs.
- `.env.local`, tokens, senhas e arquivos de backup pessoais não devem entrar no repositório.
- A execução automática de backup ao abrir a tela não equivale a agendamento garantido em segundo plano no Android.

## Checklist de homologação final

- [ ] Branch `feature/final-release` criada a partir de `develop` contendo a auditoria.
- [ ] Versão do aplicativo e `android.package` conferidos.
- [ ] `eas.json` revisado sem alterar assinaturas ou identificadores inadvertidamente.
- [ ] `npx tsc --noEmit` sem erros.
- [ ] `node --test tests/*.test.mjs` aprovado.
- [ ] `npx expo install --check` sem incompatibilidades.
- [ ] `git diff --check` sem problemas.
- [ ] Arquivos sensíveis ausentes do commit.
- [ ] Pull Request para `develop` revisado e integrado.
- [ ] Pull Request `develop` → `main` revisado e integrado.
- [ ] Build APK gerado a partir da versão integrada à `main`.
- [ ] APK instalado por cima da versão existente sem perda de dados.
- [ ] Funcionalidades essenciais e consulta a backups confirmadas após instalação.
- [ ] APK e orientações de recuperação arquivados em local seguro.

## Critério de encerramento

Considerar a Fase 19 concluída após o merge da documentação e da configuração de release, geração do APK a partir da `main` e instalação/checagem real no Android. Não assumir aprovação da instalação apenas com testes de TypeScript ou testes estruturais.
