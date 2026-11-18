# Teknike Painéis VR

Treino em realidade virtual (WebXR) para montar e testar um painel elétrico: a partida direta do motor **-M151** do projeto **PAINEL MIÚDOS** (folha 12 força, folha 40 comando), testada com o procedimento **RE-33**.

Roda no navegador do óculos (Meta Quest, Pico e outros com WebXR) e também no computador, com mouse e teclado. Não precisa instalar nada.

## Missões

1. **Interpretar o projeto**: folhas, grade de coordenadas, tags, circuito de força e de comando, layout, lista de materiais e lista de fios, com um quiz (incluindo perguntas de "toque no desenho").
2. **Montagem mecânica**: aparafusar os trilhos, colocar os componentes conforme o layout (a bandeja tem peças erradas de propósito: GV2ME14 e LC1D09M7) e instalar o link GV2AF3.
3. **Cabos e ligações**: escolher bitola e cor, cortar no comprimento, decapar (6, 10 ou 15 mm), colocar a ponteira da cor certa, crimpar até a catraca completar, ligar origem e destino e apertar os parafusos.
4. **Placa no quadro**: abrir a porta, instalar a placa, apertar as porcas e ligar a cordoalha de aterramento da porta.
5. **Testes RE-33**: 23 itens adaptados do RE-33 (inspeção, tração, aterramento, curto-circuito, energização, 24 Vcc, regulagem do disjuntor-motor, acionamento por saída do CLP e partida do motor), com multímetro (Ω, V~, V⎓) e marcação OK / NOK / NA.

Com um fio na mão, o botão **Mostrar onde ligar** destaca os bornes de origem e destino na placa, para quem ainda está aprendendo a ler a lista de fios.

**Desafio**: um painel já montado com 3 defeitos escondidos, sorteados entre 15 possíveis, para o aluno encontrar com o checklist.

## Erros que o aluno pode cometer (e como aparecem)

| Erro | Onde aparece |
|---|---|
| Componente fora do layout | 1.3 |
| Peça com código errado (GV2ME14, LC1D09M7) | 1.4, 6.7, 8.7 |
| Trilho sem parafuso | 1.6 |
| Bitola ou cor errada | 1.9 |
| Decapagem curta, ponteira grande, crimpagem incompleta, parafuso solto | 1.13 (o fio solta no teste de tração) |
| Ponteira pequena demais | na hora (o cabo não entra) |
| Fio cortado curto | na hora (não alcança, é descartado) |
| Porca da placa solta | 1.14 |
| Link GV2AF3 frouxo | 1.15 |
| Porta sem aterramento | 2.3 |
| Fio no borne errado | curto (arco elétrico ao energizar), falta de fase ou sentido de giro invertido |
| Energizar sem testar curto ou sem isolar a área | relatório de segurança |
| Medir resistência energizado, mexer na fiação energizada | relatório de segurança |
| Disjuntor-motor mal regulado | 6.7, e desarma por sobrecarga na partida |
| Cobre exposto ou sobra de cabo | 10.2 |

## Testes automáticos (desenvolvimento)

Abra com `?pc` para pular a tela inicial. O objeto `window.__game` expõe o estado e funções (`goMission`, `autoBuild`, `truth`, `startChallenge`...) e `E.loop()` avança um quadro, útil quando a aba está em segundo plano.

## Rodar localmente

Qualquer servidor estático serve, por exemplo:

```
python -m http.server 8765
```

Abra `http://localhost:8765`. O WebXR exige HTTPS fora do `localhost`, e o GitHub Pages já usa HTTPS.

## Controles

- **Óculos**: aponte o laser e use o gatilho para tocar. Segure o gatilho para apertar parafusos e crimpar. O analógico gira o corpo em passos de 30°, o botão A/X troca a ferramenta e o B/Y traz o painel-guia para a sua frente. Também funciona com rastreamento de mãos (pinça).
- **Computador**: clique para tocar e segure para apertar. Botão direito (ou arrastar em área vazia) olha em volta, W A S D andam, Q e E sobem e descem. As teclas 1, 2 e 3 trocam a ferramenta e a tecla H esconde ou mostra o painel-guia.

## Virar app (APK) no futuro

Com o modo desenvolvedor do óculos ativo, o mesmo site pode ser empacotado como PWA:

- **Meta Quest**: `ovr-platform-util create-pwa` (Meta Quest Developer Hub) gera o APK a partir do `manifest.webmanifest`. Depois é só instalar com `adb install`.
- **Genérico**: Bubblewrap (Trusted Web Activity).

O jogo não depende de CDN: o Three.js (r170) está em `vendor/` e as fontes e o logo em `assets/teknike/`.

## Estrutura

- `src/engine.js`: renderer, WebXR, ponteiros (laser e mouse), teleporte, tablet e toasts
- `src/world.js`: sala, bancadas, quadro de projeto, quadro elétrico e console de testes
- `src/models.js`: modelos procedurais (bornes, GV2ME, LC1D, relé, trilho, placa)
- `src/game.js`: estado, missões, interações, fios, checklist e relatório
- `src/sim.js`: simulador elétrico (continuidade, tensões, curtos, bobinas e motor)
- `src/diagrams.js`: desenho das folhas do projeto
- `src/data.js`: textos, quiz, lista de fios e checklist RE-33
