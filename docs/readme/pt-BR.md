![Hydra Nexus — Extend your Hydra experience](../../assets/promo/overview.jpg)

[English](../../README.md) · [Português (Brasil)](pt-BR.md) · [Español](es.md) · [Русский](ru.md) · [العربية](ar.md) · [Français](fr.md) · [Deutsch](de.md) · [Türkçe](tr.md) · [Polski](pl.md)

# Hydra Nexus

Hydra Nexus é uma extensão comunitária do Hydra Launcher para Windows. Adiciona gerenciamento de armazenamento, backups de saves e conquistas locais, contas Steam por jogo, atividade, abas, notas e fundos próprios. Ative as ferramentas desejadas em Plugins. A interface acompanha o idioma do Hydra e usa controles nativos compatíveis com o tema. É necessário ter o Hydra Launcher instalado.

**[Baixar instalador](https://github.com/M0KA40/Hydra-Nexus/releases/latest/download/Hydra_Nexus.bat)** · [Notas da versão](../../docs/releases/2.0.0/pt-BR.md) · [Relatar problema](https://github.com/M0KA40/Hydra-Nexus/issues/new/choose)

## Steam launch settings

![Steam launch settings](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/ac0b8e5df56367c357d743ffb2c01ea4b1fc9c9a/assets/features/steam.webp)

Associe a cada jogo uma conta Steam salva e um modo de inicialização. Default / standalone não solicita ao Nexus iniciar o Steam nem trocar de conta; uma sessão aberta permanece igual. Steam online usa uma conta pessoal conectada. Steam offline força o modo offline da conta escolhida, inclusive compartilhada. Só aparecem contas já salvas. Desative a pergunta de escolha de conta ao iniciar o Steam para permitir a troca automática.

**Onde usar:** Library → game page → Steam button beside Play

## Game Storage Manager

![Game Storage Manager](../../assets/features/storage.webp)

Veja jogos instalados por unidade, espaço livre e tamanho medido. Pesquise e ordene por tamanho ou último uso. Abra pastas ou mova jogos após revisar destino e espaço. As cópias são verificadas antes de atualizar caminhos e remover os originais. Pastas incertas e medições parciais são sinalizadas. Registros de outros launchers e atalhos não são alterados.

**Onde usar:** Settings → below Big Picture → Game Storage Manager

## Play Activity

![Play Activity](../../assets/features/activity.webp)

Confira sessões, tempo de jogo e a última data jogada. Resumos semanais e mensais mostram jogos, dias ativos e conquistas com data disponíveis. Ajuste avisos no sino ou desative resumos e avisos mantendo o rastreamento. O histórico detalhado começa com o Nexus; totais antigos não recriam sessões anteriores.

**Onde usar:** Sidebar → Play activity; per-game graph beside playtime

## Game Backup

![Game Backup](../../assets/features/backup.png)

Guarde pontos de recuperação separados para saves e conquistas locais. Restaure, abra a pasta ou extraia uma cópia verificada sem substituir os saves atuais. Adicione pastas ou pare novos backups de um jogo preservando o histórico. Para a nuvem, selecione uma pasta sincronizada pelo Google Drive para computador; o Drive sincroniza sem login Google no Nexus. Feche os jogos antes de restaurar. Conquistas locais restauradas não desbloqueiam conquistas da conta Steam/Epic.

**Onde usar:** Sidebar → Backup; game Options → General → Backup

## Extract Path

![Extract Path](../../assets/features/extract.webp)

Baixe arquivos em uma unidade e extraia o jogo em outra. Ative a extração automática e escolha Extract path. O Nexus lembra o último destino aceito e o destino de cada download na fila, criando uma pasta por jogo. Os arquivos permanecem no local de download para retomada/seeding, salvo se você ativar sua exclusão após extração separadamente.

**Onde usar:** Download settings → automatic extraction → Extract path

## Download Finish Actions

![Download Finish Actions](../../assets/features/finish.webp)

Escolha notificação, suspensão ou desligamento do PC ao terminar toda a fila e as extrações ativadas. Há 60 segundos para cancelar ações de energia. Novos downloads retomam a espera; fechar o Hydra cancela. Ativar o plugin exige reiniciar o Hydra, sem armar automaticamente uma ação.

**Onde usar:** Downloads → beside Cancel → Download Finish Actions

## Invisible Mode

![Invisible Mode](../../assets/features/invisible.webp)

Controle o compartilhamento de atividade no Hydra mantendo progresso local e imagens. Ativar o plugin liga Invisible Mode imediatamente; depois altere pelo menu da conta. A atividade privada continua local após desligar até você retomar explicitamente o compartilhamento. A presença pode demorar a atualizar, e avisos dependem também dos servidores Hydra.

**Onde usar:** Account menu → below Friends → Invisible Mode

## Game Tabs

![Game Tabs](../../assets/features/tabs.webp)

Abra várias páginas de jogos em abas da mesma janela. Resultados, filtros e rolagem do catálogo são preservados. Clique com o botão direito no Catálogo ou Biblioteca e escolha Open in New Tab; alterne pela barra e feche com ×. As abas pertencem à sessão atual e não voltam após reiniciar totalmente o aplicativo.

**Onde usar:** Catalogue or Library → right-click → Open in New Tab

## Custom backgrounds

https://github.com/user-attachments/assets/f69ff1b4-6250-43b1-a5d7-98ca3722d952

Escolha uma imagem ou vídeo local como fundo. Ajuste escurecimento e desfoque, pause opcionalmente o vídeo com Hydra inativo e restaure o fundo do tema com Reset. A reprodução depende do codec; recomenda-se H.264 MP4 ou WebM.

**Onde usar:** Hydra Nexus Settings → Themes → Choose image or video

## Outras ferramentas

- Game Notes — texto e links por jogo, janela independente, sempre no topo e atalho de foco.
- Nexus Mods — abre a página correspondente ou uma busca quando não há correspondência confiável.
- PC Compatibility — compara especificações confirmadas com requisitos mínimos publicados; não prevê FPS.
- Updater — verifica versões e o instalador baixado, atualiza e reinicia o Hydra.

## Idiomas da interface

| Idioma | Nome nativo | Interface Nexus |
| --- | --- | --- |
| en | English | ✓ Compatível |
| pt-BR | Português (Brasil) | ✓ Compatível |
| es | Español | ✓ Compatível |
| ru | Русский | ✓ Compatível |
| ar | العربية | ✓ Compatível |
| fr | Français | ✓ Compatível |
| de | Deutsch | ✓ Compatível |
| tr | Türkçe | ✓ Compatível |
| pl | Polski | ✓ Compatível |

## Instalação e atualização

1. Baixe Hydra_Nexus.bat em Releases.
2. Feche completamente o Hydra, incluindo o ícone da bandeja.
3. Execute o BAT e escolha Install / Update / Repair.
4. Abra Hydra → Settings → Hydra Nexus → Plugins.

O instalador não exige Node.js ou Python separados. Configurações, notas, histórico e backups são mantidos. Se uma atualização Hydra substituir as alterações, reaplique um Nexus compatível. Projeto independente de Hydra Launcher, Valve, Google e Nexus Mods. Informe versões e passos para reproduzir problemas.

## Mais informações

[Privacy](../../docs/privacy.md) · [Troubleshooting](../../docs/troubleshooting.md) · [Changelog](../../CHANGELOG.md) · [Contributing](../../CONTRIBUTING.md) · [MIT](../../LICENSE) · [Third-party notices](../../THIRD_PARTY_NOTICES.md)

## Compilar o código

```sh
python build.py
```
