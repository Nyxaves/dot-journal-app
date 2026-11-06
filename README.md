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