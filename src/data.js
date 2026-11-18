// Conteúdo didático e dados do circuito de treino.
// Base: projeto "PAINEL MIÚDOS" (folha 12 força, folha 40 comando) e RE-33 (teste de painel).

export const MOTOR = { tag: '-M151', kw: '0,75 kW', v: '380 V', hz: '60 Hz', inom: 1.9, rpm: '1720 rpm', polos: '4 polos' };

// Catálogo de peças da bandeja. `ok` = peça correta do projeto. Distratores existem de propósito.
export const PARTS = {
  X0:   { tag: '-X0',    name: 'Bornes de chegada', code: 'UT 4 (3x)', kind: 'bornes', pins: ['L1.2', 'L2.2', 'L3.2'], slot: 'a1', ok: true },
  QM:   { tag: '-QM151', name: 'Disjuntor-motor', code: 'GV2ME07 + GVAE11', kind: 'gv2', range: [1.6, 2.5], slot: 'a2', ok: true },
  QMx:  { tag: '-QM151', name: 'Disjuntor-motor', code: 'GV2ME14 + GVAE11', kind: 'gv2', range: [6, 10], slot: 'a2', ok: false, wrongWhy: 'GV2ME14 regula de 6 a 10 A. O motor tem 1,9 A: ele nunca desarmaria numa sobrecarga.' },
  RA:   { tag: '-RA26',  name: 'Relé de interface', code: 'RSB1A120BD', kind: 'relay', slot: 'a3', ok: true },
  X24:  { tag: '-X24',   name: 'Bornes 24 Vcc', code: 'UT 2,5 (2x)', kind: 'bornes', pins: ['S+', '0V'], slot: 'a4', ok: true },
  KM:   { tag: '-KM151', name: 'Contator', code: 'LC1D09BD', coil: 'DC24', kind: 'lc1d', slot: 'b2', ok: true },
  KMx:  { tag: '-KM151', name: 'Contator', code: 'LC1D09M7', coil: 'AC220', kind: 'lc1d', slot: 'b2', ok: false, wrongWhy: 'O sufixo M7 indica bobina 220 Vca. O comando deste projeto é 24 Vcc (sufixo BD): a bobina não atraca.' },
  XP:   { tag: '-XP3.0', name: 'Régua de bornes do motor', code: 'UT 4 (3x) + UT 4-PE', kind: 'bornes', pins: ['37', '38', '39', '40'], pe: '40', slot: 'c2', ok: true },
  LINK: { tag: '-BRI1',  name: 'Link disjuntor-contator', code: 'GV2AF3', kind: 'link', ok: true },
};
export const TRAY_ORDER = ['X0', 'QMx', 'QM', 'RA', 'X24', 'KM', 'KMx', 'XP', 'LINK'];

// Slots nos trilhos (coordenadas locais da placa, metros reais).
export const RAILS = { A: 0.13, B: 0.035, C: -0.14 };
export const SLOTS = {
  a1: { rail: 'A', x: -0.145 }, a2: { rail: 'A', x: -0.05 }, a3: { rail: 'A', x: 0.04 }, a4: { rail: 'A', x: 0.115 },
  b1: { rail: 'B', x: -0.145 }, b2: { rail: 'B', x: -0.05 }, b3: { rail: 'B', x: 0.06 },
  c1: { rail: 'C', x: -0.09 }, c2: { rail: 'C', x: -0.05 + 0.0 }, c3: { rail: 'C', x: 0.06 },
};
// c1 fica perto da barra PE; corrigimos c2 para alinhar com o contator
SLOTS.c1.x = -0.12; SLOTS.c2.x = -0.035; SLOTS.c3.x = 0.07;

// Lista de fios (o que o aluno precisa montar).
// cor: preto | vd-am | azul ; bitola em mm²
export const WIRES = [
  { id: 'L1.2', from: 'X0:L1.2a', to: 'QM:1', bitola: 2.5, cor: 'preto', grupo: 'Força' },
  { id: 'L2.2', from: 'X0:L2.2a', to: 'QM:3', bitola: 2.5, cor: 'preto', grupo: 'Força' },
  { id: 'L3.2', from: 'X0:L3.2a', to: 'QM:5', bitola: 2.5, cor: 'preto', grupo: 'Força' },
  { id: '177', from: 'KM:2', to: 'XP:37a', bitola: 2.5, cor: 'preto', grupo: 'Força' },
  { id: '178', from: 'KM:4', to: 'XP:38a', bitola: 2.5, cor: 'preto', grupo: 'Força' },
  { id: '179', from: 'KM:6', to: 'XP:39a', bitola: 2.5, cor: 'preto', grupo: 'Força' },
  { id: 'PE', from: 'PE:2', to: 'XP:40a', bitola: 2.5, cor: 'vd-am', grupo: 'Terra' },
  { id: 'S+', from: 'X24:S+a', to: 'RA:11', bitola: 0.75, cor: 'azul', grupo: 'Comando' },
  { id: '462', from: 'RA:14', to: 'QM:13', bitola: 0.75, cor: 'azul', grupo: 'Comando' },
  { id: '463', from: 'QM:14', to: 'KM:A1', bitola: 0.75, cor: 'azul', grupo: 'Comando' },
  { id: '0V', from: 'X24:0Vb', to: 'KM:A2', bitola: 0.75, cor: 'azul', grupo: 'Comando' },
];

export const CABLES = [
  { id: 'p25', bitola: 2.5, cor: 'preto', label: 'Cabo 2,5 mm² preto' },
  { id: 'p075', bitola: 0.75, cor: 'preto', label: 'Cabo 0,75 mm² preto' },
  { id: 'v25', bitola: 2.5, cor: 'vd-am', label: 'Cabo 2,5 mm² verde-amarelo' },
  { id: 'a075', bitola: 0.75, cor: 'azul', label: 'Cabo 0,75 mm² azul' },
];
export const CUT_OPTIONS = [0.15, 0.25, 0.35, 0.45, 0.60];
export const STRIP_OPTIONS = [6, 10, 15]; // mm; correto = 10 (comprimento da ponteira)
export const FERRULES = [
  { id: 'cinza', bitola: 0.75, label: 'Cinza · 0,75 mm²', hex: '#8d9396' },
  { id: 'vermelho', bitola: 1.0, label: 'Vermelha · 1,0 mm²', hex: '#c63c32' },
  { id: 'preto', bitola: 1.5, label: 'Preta · 1,5 mm²', hex: '#1b1b1b' },
  { id: 'azul', bitola: 2.5, label: 'Azul · 2,5 mm²', hex: '#2f63c9' },
];
export const WIRE_COLORS = { 'preto': '#1d1d1f', 'vd-am': '#3fae49', 'azul': '#1f4fbf' };

// ---------- Textos ----------
export const INTRO_CARDS = [
  { t: 'Bem-vindo à oficina de painéis', b: 'Aqui você vai montar, de ponta a ponta, a partida direta do motor -M151 do projeto PAINEL MIÚDOS: ler o projeto, fixar os componentes, preparar e ligar os cabos, instalar a placa no quadro e testar tudo com o procedimento RE-33.\n\nVocê pode errar à vontade. Os erros vão aparecer nos testes, do jeito que aconteceria na fábrica, e cada um vem com a explicação do que deu errado.' },
  { t: 'Como interagir', b: 'No óculos: aponte o laser do controle e aperte o gatilho para tocar. Segure o gatilho para apertar parafusos e crimpar. Use o analógico para girar o corpo. O botão A/X troca a ferramenta e o B/Y traz este painel para a sua frente.\n\nNo computador: clique para tocar e segure o botão para apertar. Arraste com o botão direito (ou em área vazia) para olhar em volta. W A S D movem a câmera.' },
  { t: 'Ferramentas', b: 'Na barra de baixo você escolhe a ferramenta ativa:\n\nMão: pegar, colocar, acionar e retirar peças ou fios.\nChave de fenda: segure sobre um parafuso para apertar, ou sobre o dial do disjuntor-motor para regular.\nMultímetro: toque no primeiro ponto (ponta vermelha) e depois no segundo (ponta preta).\n\nOs botões do topo levam você até cada estação: Projeto, Placa, Cabos e Quadro.' },
  { t: 'Segurança em primeiro lugar', b: 'Na vida real, toda montagem é feita com o painel desenergizado, e todo teste energizado só é feito por profissional habilitado (NR-10), com EPI e com a área isolada.\n\nNo simulador você pode energizar fora de hora para ver a consequência, mas cada atitude insegura entra no seu relatório final.' },
];

export const LESSON_CARDS = [
  { tab: 'f12', t: 'Como ler um projeto elétrico', b: 'O projeto é dividido em folhas numeradas. Cada folha tem um carimbo (cliente, projeto, número da folha) e uma grade de coordenadas: colunas de 1 a 12 no topo e linhas de A a H na lateral.\n\nAs referências cruzadas usam essa grade. "/40.G6" quer dizer: folha 40, linha G, coluna 6. É assim que você encontra a bobina de um contator que aparece em outra folha.' },
  { tab: 'f12', t: 'Tags: o nome de cada componente', b: 'Cada peça tem uma tag única que aparece no projeto, na etiqueta da peça e nos fios.\n\n-QM151: disjuntor-motor do circuito 151\n-KM151: contator do circuito 151\n-RA26: relé auxiliar de interface\n-XP3.0: régua de bornes de potência\n-M151: o motor no campo\n-A8: cartão de saídas do CLP\n\nO número 151 liga tudo que pertence ao mesmo motor.' },
  { tab: 'f12', t: 'Circuito de força (folha 12)', b: 'O barramento L1.2, L2.2 e L3.2 (380 Vca) chega da folha 11 e continua na folha 13.\n\nO caminho do motor: barramento → -QM151 (GV2ME07, regulagem 1,6 a 2,5 A) → link -BRI1 (GV2AF3) → -KM151 (LC1D09BD, 9 A) → fios 177, 178 e 179 → bornes 37, 38 e 39 da -XP3.0. O terra (PE) vai no borne 40.\n\nNa bancada, os bornes -X0 fazem o papel do barramento.' },
  { tab: 'f40', t: 'Circuito de comando (folha 40)', b: 'O comando é em 24 Vcc. O caminho que liga a bobina do contator:\n\nS+ (24 V) → contato 11-14 do -RA26 → fio 462 → contato auxiliar 13-14 do -QM151 (GVAE11) → fio 463 → bobina A1-A2 do -KM151 → 0V.\n\nO -RA26 é acionado pela saída OUT10 do cartão -A8 do CLP. O contato 13-14 do disjuntor-motor fica em série: se o QM151 desarmar, a bobina perde a alimentação e o motor para.' },
  { tab: 'lay', t: 'Layout e lista de materiais (folha 1)', b: 'O layout mostra onde cada peça fica na placa de montagem. A lista de materiais mostra o código exato de cada uma.\n\nAntes de montar, confira sempre o código impresso na peça com o projeto. Peças parecidas, como GV2ME07 e GV2ME14, ou LC1D09BD e LC1D09M7, têm comportamentos bem diferentes.' },
  { tab: 'fios', t: 'Lista de fios', b: 'A lista de fios diz, para cada condutor: o número (anilha), a origem, o destino, a bitola e a cor.\n\nNeste painel, a força usa cabo de 2,5 mm² preto, o terra usa verde-amarelo e o comando 24 Vcc usa 0,75 mm² azul. Essa é a convenção deste projeto de treino: na fábrica, siga sempre o padrão definido no projeto do cliente.' },
];

export const QUIZ = [
  { type: 'pick', tab: 'f12', q: 'Na folha 12, toque no componente que protege o motor contra curto-circuito e sobrecarga.', target: 'QM', ok: 'Isso. O -QM151 (GV2ME07) tem proteção magnética, contra curto, e térmica, contra sobrecarga, regulável de 1,6 a 2,5 A.', no: 'Ainda não. Procure o disjuntor-motor: a tag começa com -QM e ele fica logo abaixo do barramento.' },
  { type: 'mc', tab: 'f12', q: 'O que significa "GV2ME07 · 1,6/2,5 A"?', opts: ['Disjuntor-motor com regulagem térmica de 1,6 a 2,5 A', 'Contator com corrente máxima de 2,5 A', 'Fusível de 1,6 A com reserva de 2,5 A'], a: 0, ok: 'Certo. O dial do disjuntor-motor é regulado na corrente nominal do motor, dentro dessa faixa.', no: 'Não. GV2ME é a família de disjuntores-motores, e 1,6/2,5 A é a faixa de regulagem do relé térmico.' },
  { type: 'pick', tab: 'f40', q: 'Na folha 40, toque na bobina do contator -KM151.', target: 'KM_COIL', ok: 'Exato. A bobina (A1-A2) é o que puxa os contatos de força do contator.', no: 'Ainda não. A bobina é o retângulo com os bornes A1 e A2, na linha G.' },
  { type: 'mc', tab: 'f40', q: 'Por que o contato 13-14 do -QM151 está em série com a bobina do -KM151?', opts: ['Para aumentar a tensão da bobina', 'Para desligar o contator quando o disjuntor-motor estiver desarmado', 'Para ligar o motor em estrela'], a: 1, ok: 'Isso. O contato auxiliar só fecha com o disjuntor-motor armado. Se ele desarmar por sobrecarga, o contator cai.', no: 'Não. O contato 13-14 é um intertravamento de segurança: com o disjuntor-motor desarmado, a bobina não recebe 24 V.' },
  { type: 'mc', tab: 'fios', q: 'O fio 178 sai de onde e vai para onde?', opts: ['-QM151 borne 4 → -KM151 borne 3', '-KM151 borne 4 → -XP3.0 borne 38', '-XP3.0 borne 38 → motor fase W'], a: 1, ok: 'Correto. Esse fio leva a fase L2 da saída do contator até a régua de bornes do motor.', no: 'Confira a lista de fios: o 178 vai da saída 4 do contator até o borne 38 da régua -XP3.0.' },
  { type: 'mc', tab: 'f40', q: 'A referência "/40.G6" embaixo do -KM151 indica:', opts: ['Fio 40, borne G6', 'Folha 40, linha G, coluna 6', 'Página 6, borne 40'], a: 1, ok: 'Isso. Folha, linha e coluna: é o endereço da bobina no projeto.', no: 'Não. As referências cruzadas seguem o formato /folha.linha+coluna.' },
  { type: 'mc', tab: 'lay', q: 'Qual a tensão da bobina do contator LC1D09BD?', opts: ['220 Vca', '24 Vcc', '380 Vca'], a: 1, ok: 'Certo. O sufixo BD indica 24 Vcc. Um LC1D09M7, por exemplo, tem bobina de 220 Vca.', no: 'Não. O sufixo do código indica a bobina: BD = 24 Vcc, M7 = 220 Vca.' },
];

export const MOUNT_CARDS = [
  { t: 'Montagem mecânica', b: 'A placa de montagem já vem com canaletas e três trilhos DIN posicionados, mas os trilhos ainda estão soltos.\n\n1. Escolha a chave de fenda e segure sobre cada parafuso dos trilhos até travar (6 parafusos).\n2. Com a Mão, pegue cada componente na bandeja e toque no ponto do trilho onde ele vai, conforme o layout da folha 1.\n3. Instale o link GV2AF3 entre o disjuntor-motor e o contator, e aperte.' },
];

export const WIRE_CARDS = [
  { t: 'Preparando um cabo', b: 'Cada fio passa por 5 etapas na bancada de cabos:\n\n1. Escolher o cabo certo (bitola e cor da lista de fios)\n2. Medir e cortar, com uma folga de 5 a 10 cm além do trajeto\n3. Decapar as duas pontas no comprimento da ponteira (10 mm)\n4. Colocar a ponteira da cor da bitola: cinza para 0,75 mm², azul para 2,5 mm²\n5. Crimpar até o alicate soltar sozinho (catraca completa)\n\nA anilha com o número do fio é colocada automaticamente.' },
  { t: 'Por que cada detalhe importa', b: 'Decapagem curta: o cobre não preenche a ponteira e o fio se solta no teste de tração.\nDecapagem longa: sobra cobre exposto fora da ponteira, com risco de curto e choque.\nPonteira maior que o cabo: a crimpagem fica frouxa.\nCrimpagem incompleta: o fio sai na mão.\nParafuso sem aperto: mau contato, aquecimento e fio solto.\n\nTodos esses erros podem acontecer aqui, e o teste RE-33 vai encontrá-los.' },
  { t: 'Ligando na placa', b: 'Com o fio pronto, vá até a Placa e use a Mão: toque no borne de origem e depois no de destino. Então pegue a chave de fenda e segure sobre cada uma das pontas para apertar.\n\nPara refazer um fio, use a Mão e toque nele para retirá-lo.' },
];

export const ENCL_CARDS = [
  { t: 'Instalando a placa no quadro', b: '1. Abra a porta do quadro (Mão, na maçaneta).\n2. Pegue a placa montada na bancada (Mão, na borda laranja da placa) e toque no interior do quadro.\n3. Aperte as 4 porcas de fixação da placa (chave de fenda).\n4. Ligue a cordoalha de aterramento da porta: Mão na cordoalha.\n\nA placa e a porta precisam estar aterradas: é o que protege quem encostar no quadro se um fio vivo tocar a carcaça.' },
];

export const TEST_INTRO = { t: 'Teste do painel (RE-33)', b: 'Agora você vai seguir o procedimento RE-33, o mesmo checklist usado na fábrica. Para cada item:\n\n1. Leia o que precisa ser verificado\n2. Faça a verificação (olhar, medir, acionar)\n3. Marque OK, NOK (não conforme) ou NA (não se aplica)\n\nSe marcar NOK, encontre a causa, corrija e verifique de novo. Se aprovar algo com defeito, o problema vai aparecer mais à frente, como acontece na vida real.' };

// Itens do checklist. need = verificações obrigatórias antes de marcar.
// meas: pares de pontos (conjuntos de aliases) que precisam ser medidos no modo indicado.
const L1 = ['X0:L1.2a', 'X0:L1.2b', 'QM:1'], L2 = ['X0:L2.2a', 'X0:L2.2b', 'QM:3'], L3 = ['X0:L3.2a', 'X0:L3.2b', 'QM:5'];
const PE = ['PE:1', 'PE:2', 'PE:3', 'PE:4', 'XP:40a', 'XP:40b', 'ENC'];
const SP = ['X24:S+a', 'X24:S+b'], ZV = ['X24:0Va', 'X24:0Vb'];
export const ALIASES = { L1, L2, L3, PE, SP, ZV };
export const CHECKLIST = [
  { id: '1.3', sec: '1.0 Inspeção inicial', text: 'Conferir se todos os componentes estão dispostos conforme o layout do projeto e se todos estão presentes', how: 'Abra o layout (folha 1) no quadro de projeto e compare com a placa. Cada peça está no lugar certo?', check: 'layout' },
  { id: '1.4', sec: '1.0 Inspeção inicial', text: 'Conferir se os códigos dos componentes são iguais aos do projeto elétrico', how: 'Leia o código impresso em cada peça (passe o cursor ou o laser sobre ela) e compare com a lista de materiais.', check: 'codes' },
  { id: '1.5', sec: '1.0 Inspeção inicial', text: 'Verificar a presença de barra de aterramento e neutro', how: 'Localize a barra de terra (PE) na parte de baixo da placa. Este painel não usa neutro.', check: 'always' },
  { id: '1.6', sec: '1.0 Inspeção inicial', text: 'Certificar a inexistência de componentes mal fixados', how: 'Confira se os trilhos estão aparafusados e as peças travadas.', check: 'fixed' },
  { id: '1.7', sec: '1.0 Inspeção inicial', text: 'Conferir se todas as redes de comunicação (ethernet ou serial) estão devidamente montadas', how: 'Existe alguma rede de comunicação nesta placa de treino?', check: 'na' },
  { id: '1.9', sec: '1.0 Inspeção inicial', text: 'Conferir se os cabos e bornes são da mesma bitola e cor que o projeto elétrico', how: 'Compare cada fio com a lista de fios: espessura e cor.', check: 'gauge' },
  { id: '1.13', sec: '1.0 Inspeção inicial', text: 'Realizar o teste de tração e aperto nos cabos e conexões', how: 'Toque em "Fazer teste de tração" abaixo: cada fio é puxado com firmeza. Fio que solta é NOK.', check: 'traction', action: 'traction' },
  { id: '1.14', sec: '1.0 Inspeção inicial', text: 'Conferir se foi fixado o parafuso lateral da placa com o quadro', how: 'Olhe as 4 porcas da placa de montagem dentro do quadro.', check: 'plateScrews' },
  { id: '1.15', sec: '1.0 Inspeção inicial', text: 'Verificar se as conexões parafusadas não estão frouxas (ex.: link e barras). Garantir TODAS bem apertadas', how: 'Confira o link GV2AF3 e os parafusos dos bornes.', check: 'linkTight' },
  { id: '2.1', sec: '2.0 Testes de potencial', text: 'Armar todos os disjuntores para realizar os testes desta seção', how: 'Com a Mão, toque no botão verde (I) do -QM151.', check: 'qmOn', need: ['qmOn'] },
  { id: '2.3', sec: '2.0 Testes de potencial', text: 'Conferir aterramento das portas, placa de montagem e demais componentes que possuam terra', how: 'Multímetro em continuidade (Ω): meça da barra PE até a porta (parafuso da cordoalha) e da barra PE até o borne 40 da XP3.0.', check: 'ground', meas: [['ohm', 'PE', ['DOOR']], ['ohm', 'PE', ['XP:40a', 'XP:40b']]] },
  { id: '2.4', sec: '2.0 Testes de potencial', text: 'Conferir ausência de curto-circuito entre fases e entre fase e terra', how: 'Multímetro em Ω, painel desligado e QM151 armado: meça L1×L2, L2×L3, L1×L3 e L1×PE nos bornes -X0. O certo é "OL" (circuito aberto). Dica de quem tem experiência: acione o contator manualmente (Mão no visor do -KM151) e meça também os bornes 37, 38, 39 e 40 da -XP3.0, para pegar erros depois do contator.', check: 'noShortAC', meas: [['ohm', 'L1', 'L2'], ['ohm', 'L2', 'L3'], ['ohm', 'L1', 'L3'], ['ohm', 'L1', 'PE']] },
  { id: '2.5', sec: '2.0 Testes de potencial', text: 'Conferir ausência de curto-circuito entre 24Vcc e 0Vcc, e entre fases e 24Vcc / 0Vcc', how: 'Multímetro em Ω: meça S+×0V nos bornes -X24 e L1×S+.', check: 'noShortDC', meas: [['ohm', 'SP', 'ZV'], ['ohm', 'L1', 'SP']] },
  { id: '2.7', sec: '2.0 Testes de potencial', text: 'Desarmar todos os disjuntores', how: 'Toque no botão vermelho (O) do -QM151.', check: 'qmOff', need: ['qmOff'] },
  { id: '2.10', sec: '2.0 Testes de potencial', text: 'Isolar a área em volta do painel elétrico', how: 'No console de testes, toque nos cones para isolar a área.', check: 'cones', need: ['cones'] },
  { id: '2.11', sec: '2.0 Testes de potencial', text: 'Energizar o painel e assegurar que a tensão de entrada está de acordo com o projeto elétrico (380 Vca)', how: 'Ligue a "Alimentação 380 V" no console. Multímetro em V~: meça L1×L2, L2×L3 e L1×L3 nos bornes -X0.', check: 'supply', need: ['power'], meas: [['vac', 'L1', 'L2'], ['vac', 'L2', 'L3'], ['vac', 'L1', 'L3']] },
  { id: '3.7', sec: '3.0 Energizando a potência', text: 'Armar disjuntor do calefator', how: 'Este painel de treino tem calefator?', check: 'na' },
  { id: '3.13', sec: '3.0 Energizando a potência', text: 'Armar disjuntor das partidas diretas e verificar a tensão na saída', how: 'Arme o -QM151 e meça em V~ as saídas 2, 4 e 6 dele, duas a duas.', check: 'qmOut', need: ['qmOn'], meas: [['vac', ['QM:2', 'KM:1'], ['QM:4', 'KM:3']], ['vac', ['QM:4', 'KM:3'], ['QM:6', 'KM:5']]] },
  { id: '4.4', sec: '4.0 Energizando o comando', text: 'Medir na distribuição a presença de 24 Vcc', how: 'Multímetro em V⎓: meça S+×0V nos bornes -X24 e no borne 11 do -RA26 em relação ao 0V.', check: 'dc24', meas: [['vdc', 'SP', 'ZV'], ['vdc', ['RA:11'], 'ZV']] },
  { id: '6.7', sec: '6.0 Parametrização', text: 'Regular os disjuntores-motores conforme o motor do projeto', how: 'Leia a placa do motor de teste no console (corrente nominal). Pegue a chave de fenda e toque no dial do -QM151 para ajustar.', check: 'setting' },
  { id: '8.7', sec: '8.0 Entradas e saídas', text: 'Verificar se as saídas digitais estão acionando as contatoras', how: 'Com o painel energizado e o QM151 armado, toque em "Saída OUT10" no console. O -RA26 e o -KM151 devem atracar.', check: 'kmPull', need: ['out10'] },
  { id: '9.1', sec: '9.0 Acionamentos', text: 'Inserir um motor nos bornes do acionamento e simular a partida (atentar para a sequência de fase)', how: 'Ligue o motor de teste na -XP3.0 (console) e acione OUT10. O motor deve girar no sentido da seta, sem desarmar.', check: 'motor', need: ['motorRun'] },
  { id: '10.2', sec: '10.0 Inspeção final', text: 'Averiguar acabamentos livres de imperfeições', how: 'Olhe os fios: cobre exposto fora da ponteira? Sobras exageradas de cabo?', check: 'finish' },
];

export const CHECK_EXPLAIN = {
  layout: 'Existe componente fora da posição do layout ou faltando. Retire com a Mão e recoloque no slot indicado na folha 1.',
  codes: 'Há peça com código diferente da lista de materiais. Troque pela peça correta da bandeja.',
  fixed: 'Algum parafuso de trilho não foi apertado. Componente mal fixado vibra, solta e pode encostar em partes vivas.',
  gauge: 'Algum fio está com bitola ou cor diferente da lista de fios. Bitola menor aquece; cor errada confunde a manutenção.',
  traction: 'Algum fio soltou no teste de tração: decapagem curta, ponteira errada, crimpagem incompleta ou parafuso sem aperto. Refaça o fio.',
  plateScrews: 'Falta apertar alguma porca da placa de montagem no quadro.',
  linkTight: 'Os parafusos do link GV2AF3 não foram apertados. Conexão frouxa de potência aquece e pode carbonizar.',
  ground: 'Não há continuidade até o terra. Verifique a cordoalha da porta e o fio PE do borne 40.',
  noShortAC: 'Existe curto entre fases ou entre fase e terra. Energizar assim faria o disjuntor geral desarmar com arco elétrico.',
  noShortDC: 'Existe curto no 24 Vcc ou entre força e comando. Procure fio ligado no borne errado.',
  supply: 'A tensão de entrada não está correta.',
  qmOut: 'Sem tensão na saída do disjuntor-motor. Ele está armado? Os fios de entrada estão nos bornes certos?',
  dc24: 'Não há 24 Vcc onde deveria. Confira os fios S+ e 0V.',
  setting: 'A regulagem não corresponde à corrente nominal do motor (1,9 A), ou o disjuntor-motor nem alcança esse valor.',
  kmPull: 'O contator não atracou. Confira o caminho do comando: S+ → RA26 11-14 → 462 → QM151 13-14 → 463 → A1, e A2 → 0V. A bobina é de 24 Vcc?',
  motor: 'O motor não partiu corretamente: falta de fase, sentido invertido (fases trocadas) ou disjuntor desarmando.',
  finish: 'Há cobre exposto fora da ponteira ou sobra exagerada de cabo.',
};
