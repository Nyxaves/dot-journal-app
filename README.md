# ✿ Dot Journal App

**Seu planejamento, seus hábitos, sua rotina. Um dia de cada vez.**

O **Dot Journal App** é um aplicativo mobile de organização pessoal inspirado no método *Bullet Journal*, que transforma a experiência de um caderno de planejamento em uma solução digital, intuitiva e personalizável.

O projeto tem como objetivo centralizar metas, hábitos, compromissos, anotações e planejamento diário, semanal, mensal e anual em um único ambiente.

Desenvolvido com **React Native, Expo e TypeScript**, o aplicativo utiliza **SQLite** para armazenar informações localmente, permitindo a utilização das funcionalidades implementadas sem depender de conexão com a internet.

O desenvolvimento segue uma metodologia incremental, com versionamento no GitHub, branches dedicadas, commits semânticos, Pull Requests e validação das funcionalidades antes da integração.

---

## 1. Sobre o projeto

O Dot Journal App surgiu da ideia de digitalizar um sistema pessoal de organização baseado em cadernos pontilhados (*bullet grid*).

A proposta é preservar a simplicidade e a liberdade de um Bullet Journal tradicional, acrescentando recursos digitais como:

- Organização integrada entre diferentes períodos.
- Acompanhamento de hábitos e objetivos.
- Armazenamento automático das informações.
- Visualização de progresso.
- Calendários interativos.
- Planejamento personalizável.
- Histórico de atividades e conquistas.

O aplicativo prioriza uma experiência acolhedora, minimalista e funcional, evitando interfaces excessivamente complexas.

### Objetivos principais

- Centralizar a organização pessoal.
- Facilitar o acompanhamento de hábitos.
- Incentivar a constância por meio de pequenas metas.
- Organizar compromissos e datas importantes.
- Permitir o acompanhamento do progresso.
- Disponibilizar os registros mesmo sem internet.
- Evoluir para uma solução com gráficos, estatísticas e sincronização na nuvem.

---

## 2. Funcionalidades implementadas

### 2.1. Planejamento diário

A página diária é o núcleo principal do aplicativo.

**Funcionalidades:**

- Navegação entre diferentes datas.
- Três micro-metas diárias.
- Checkboxes para conclusão das micro-metas.
- Lista de hábitos ativos.
- Barra de progresso dos hábitos.
- Campo para anotações e atividades do dia.
- Campo de gratidão.
- Visualização dos compromissos cadastrados.
- Horários de início e término dos compromissos.
- Acesso à agenda de eventos.
- Salvamento e recuperação das informações pelo SQLite.

Os registros são independentes por data, permitindo consultar e modificar informações de dias anteriores.

### 2.2. Micro-metas personalizáveis

Cada dia possui três micro-metas independentes.

O usuário pode:

- Editar o título das micro-metas.
- Sortear sugestões de pequenas atividades.
- Substituir uma sugestão por outra.
- Marcar ou desmarcar a conclusão.
- Personalizar as metas de diferentes dias.

Exemplos de sugestões
## Estatísticas, restauração e privacidade

- **Estatísticas:** painel mensal local de anotações, hábitos, micro-metas, eventos, médias de sono/tela e humores.
- **Restauração de backup:** inspeção isolada, validação de integridade, confirmação explícita, cópia de segurança local e tentativa de rollback. **Recurso experimental:** valide primeiro em uma instalação de testes; restauração substitui o banco completo, sem mesclar registros.
- **Privacidade:** documentos SQLite exportados contêm informações pessoais, inclusive humor e menstruação; não são criptografados pelo aplicativo.
- **Qualidade:** o GitHub Actions executa TypeScript e testes estruturais em Pull Requests.

Consulte `docs/ENTREGA-UNIFICADA.md` para instruções e limitações. O Supabase está integrado somente para backup privado criptografado; não há sincronização de registros entre dispositivos nem restauração a partir da nuvem nesta fase.


---

## Backup privado na nuvem (Fase 16)

O SQLite permanece como banco principal no Android. A integração opcional com Supabase é utilizada somente para autenticação pessoal e armazenamento de cópias criptografadas do banco.

- Conta pessoal por e-mail e senha.
- Sessão guardada no Android SecureStore.
- Snapshot SQLite validado antes do envio.
- Criptografia local AES-256-GCM com `expo-crypto`.
- Bucket privado e políticas de Storage limitadas à pasta do usuário.
- Chave de recuperação gerada localmente; não é enviada ao Supabase.
- Verificação diária de backup ao abrir a central, além do envio manual.

**Atenção:** guarde a chave de recuperação fora do celular. Sem ela, os arquivos criptografados não podem ser recuperados em outro aparelho. A restauração dos backups da nuvem será implementada na Fase 17.

Consulte `docs/FASE-16-BACKUP-PRIVADO.md` para configuração do projeto Supabase, SQL, variáveis de ambiente e roteiro de validação.


---

## Restauração de backups privados (Fase 17)

A central de backup permite restaurar um arquivo criptografado `.djbackup` do bucket privado do Supabase.

- Download autenticado da pasta do próprio usuário.
- Validação do envelope e versão do arquivo.
- Descriptografia local AES-256-GCM.
- Verificação do SQLite em memória antes de tocar no banco ativo.
- Conferência das tabelas essenciais e contagem de registros.
- Confirmação destrutiva digitando `RESTAURAR`.
- Cópia de recuperação do banco atual em `Documents`.
- Aplicação via SQLite Backup API e tentativa de rollback se ocorrer falha.
- Proteção contra envio automático de banco vazio em um aparelho recém-configurado.

A restauração substitui o banco inteiro e não mescla registros. Após a conclusão, feche completamente e reabra o aplicativo. Consulte `docs/FASE-17-RESTAURACAO-NUVEM.md`.
