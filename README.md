# Xadrez de Caderno

Jogo de xadrez para o navegador do computador, com cara de rabisco a lápis de cor numa folha de papel: tabuleiro riscado a caneta marrom, casas escuras pintadas de verde como capim, e **cada peça é um bichinho**. Em volta, o papel tem sol, varal de estrelas, lua de touca, arco-íris, baleia e recadinhos escritos em letra cursiva.

| | Peão | Torre | Cavalo | Bispo | Dama | Rei |
|---|---|---|---|---|---|---|
| **Brancas** (time laranja) | cogumelo | castelinho de areia | cervinho | broto de capuz pontudo | abelha de coroa | coruja de coroa com cruz |
| **Pretas** (time roxo) | fantasminha | peludo com ameias | unicórnio | mago de chapéu-mitra | cacatua de coroa | pinguim de coroa com cruz |

Cada bicho carrega a pista da peça: ameias na torre, cabeça de cavalo, ponta com fenda no bispo, coroa de bolinhas na dama e cruz no rei. Passando o mouse sobre um bicho aparece o nome da peça.

Não precisa de login, internet (depois de instalado) nem servidor externo.

---

## Como iniciar

### Jeito fácil (Windows)

1. Instale o **Node.js 18 ou mais recente** (versão LTS em <https://nodejs.org>), se ainda não tiver.
2. Dê dois cliques em **`INICIAR.bat`**.
   - Na primeira vez ele instala as dependências (precisa de internet só nesse momento).
   - Depois abre o jogo no navegador em `http://127.0.0.1:5173` (apenas local).
3. Para encerrar, feche a janela do terminal (ou `Ctrl+C`).

Se algo der errado, a janela fica aberta mostrando a mensagem de erro.

### Pelo terminal

```bash
npm install        # ou: npm ci
npm run dev        # servidor local em http://127.0.0.1:5173
npm run build      # gera a versão final em dist/
npm run preview    # serve a pasta dist/ em http://127.0.0.1:4173
npm test           # testes de regras, salvamento e motor (requer Node 22.6+)
```

---

## Como jogar

- **Clique** num bicho seu: ele dá um pulinho, ganha colchetes laranja e os destinos aparecem como bolinhas laranja com folhinha (um círculo vermelho marca quem pode ser capturado). Clique no destino. Também dá para **arrastar e soltar**.
- O último lance deixa uma **trilha pontilhada** na cor de quem jogou.
- Bichos do lado que vai jogar que estão **ameaçados ficam suando** (gotinhas azuis). O rei em **xeque** ganha um círculo vermelho.
- **Capturar é pessoal**: quem captura fecha a cara (olhos bravos), o alvo se assusta (olhos arregalados, gota de suor), leva o golpe, fica tonto (olhos de espiral, estrelinhas, acessório voando) e sai de cena; o atacante termina na casa de destino com um anel de pouso e poeirinha.
- **Modo demonstração** (botão "demonstração" ou tecla `D`): uma partida curta roteirizada, com câmera que se aproxima dos lances e legendas à mão. É separado do jogo: usa a própria partida, o tabuleiro fica sem clique/arraste e, ao sair (botão ou `Esc`), a sua partida volta exatamente como estava.
- Na **promoção**, aparece um bilhete "vira o quê?" para escolher Dama, Torre, Bispo ou Cavalo (ou cancelar).
- Um bilhete à esquerda comenta a partida ("a baleia tá bem?", "foi mal, fantasminha"...).
- Ao abrir o jogo pela primeira vez na sessão, o título é "escrito" na tela (clique para pular).
- Botões: **Nova partida**, **Desfazer**, **Girar** (o tabuleiro) e **Som**.
- Atalhos: `N` nova partida · `Ctrl+Z` desfazer · `G` girar · `S` som · `Esc` cancela a seleção/promoção.

### Modos

- **2 jogadores** no mesmo computador.
- **Contra o computador**, jogando de brancas ou pretas, com três níveis:
  - **Fácil** — olha só um lance à frente, com bastante "ruído" e alguns lances ao acaso. Comete erros.
  - **Médio** — busca de 3 lances (meio-lances) + análise de capturas, com um pouco de variação.
  - **Difícil** — aprofundamento iterativo com até ~2,2 s por lance (normalmente 5–7 meio-lances), tabela de transposição e sem aleatoriedade.

Os ajustes valem na hora: trocar de modo, nível ou cor no meio da partida cancela o que o computador estava pensando e continua da posição atual. Escolher "pretas" gira o tabuleiro automaticamente.

**Desfazer contra o computador** sempre devolve a vez a você: se o computador já respondeu, desfaz o lance dele e o seu; se ele ainda estava pensando, cancela e desfaz só o seu lance.

### Salvamento

A partida (lances, modo, nível, cor, orientação e som) é salva automaticamente no `localStorage` do navegador a cada lance e restaurada ao abrir o jogo de novo. Os lances são revalidados pelo chess.js ao restaurar; um salvamento corrompido é ignorado.

---

## Regras e empates

Todas as regras são validadas pelo **chess.js 1.4.0**: lances legais, roque, en passant, promoção com escolha, xeque, xeque-mate e afogamento.

O chess.js trata como "empate" (`isDraw()`) também a tripla repetição e a regra dos 50 lances. O jogo segue as Leis do Xadrez da FIDE e separa os casos:

| Situação | Tratamento |
|---|---|
| Afogamento | Fim automático (`isStalemate`) |
| Material insuficiente | Fim automático (`isInsufficientMaterial` do chess.js: R×R, R+B×R, R+C×R, bispos da mesma cor) |
| Quíntupla repetição | Fim automático (contagem feita pelo jogo) |
| Regra dos 75 lances | Fim automático (relógio de meios-lances ≥ 150) |
| Tripla repetição | **Pode ser reivindicada** (`isThreefoldRepetition`) — aparece o botão "Reivindicar empate" |
| Regra dos 50 lances | **Pode ser reivindicada** (`isDrawByFiftyMoves`) |

Contra o computador, o botão de reivindicar aparece na sua vez; o computador não reivindica empates.

---

## Organização do código

```
src/
  regras/partida.ts      regras (envolve o chess.js), situação da partida, empates, desfazer
  regras/salvamento.ts   salvar/restaurar no localStorage
  ia/motor.ts            motor próprio: geração de lances (perft verificado), avaliação e busca alfa-beta
  ia/worker.ts           Web Worker que roda o motor sem travar a interface
  ia/cliente.ts          pedidos ao worker e cancelamento (encerra o worker e descarta respostas antigas)
  arte/traco.ts          traços "à mão" com semente fixa (sem tremulação entre renderizações)
  arte/lapis.ts          pintura a lápis de cor (hachuras recortadas, contorno trêmulo, carinhas)
  arte/pecas.ts          os 12 bichinhos em SVG próprio
  arte/tabuleiro.ts      grade a caneta, capim verde e coordenadas escritas à mão
  arte/rabiscos.ts       sol, varal, lua, nuvens, arco-íris, baleia e outros enfeites
  ui/vista-tabuleiro.ts  desenho/animação das peças, marcas, clique e arraste
  ui/coreografia.ts      sequência de cada lance (antecipação, deslocamento, assentamento, capturas)
  ui/bichos.ts           expressões, olhar e piscadas dos bichos
  ui/efeitos.ts          efeitos de tinta (anel, poeira, tremidinhas, estrelas, notas)
  ui/demo.ts             modo demonstração (câmera por viewBox + legendas)
  ui/app.ts              liga tudo: turnos, computador, painel, bilhetes
  ui/som.ts              sons sintetizados com Web Audio (sem arquivos de áudio)
  estilo.css             folha de caderno, painel, botões desenhados, animações
tests/regras.test.ts     testes (regras especiais, finais, salvamento, perft e motor)
```

### Proteção contra lances "atrasados" do computador

Cada pedido ao worker tem um número; nova partida, desfazer, troca de modo/nível/cor ou reivindicação de empate **encerram o worker** e invalidam o pedido. Antes de aplicar uma resposta, o jogo ainda confere se a posição (FEN) e a vez continuam as mesmas. Assim, nenhum lance calculado para uma posição antiga é jogado.

### Arte

Nada de emojis, caracteres Unicode de xadrez ou ícones prontos: tabuleiro, bichos e enfeites são SVG gerados no código, com o visual inspirado no vídeo de referência (xadrez de bichinhos rabiscados no papel). A irregularidade dos traços e das hachuras vem de um gerador pseudoaleatório com **semente fixa**, então o desenho é sempre o mesmo. Se o sistema pedir **movimento reduzido**, a abertura e as animações (desenho do tabuleiro, lances, capturas, câmera da demonstração) são desligadas e as peças só mudam de lugar.

---

## Animação dos bichos

Cada bicho é um SVG próprio dividido em **partes animáveis** (cabeça, orelhas/chapéu/coroa, braços/asas, rabo, crina, pernas, pés). Os olhos têm pupila com brilho que acompanha o olhar, pálpebra que pisca e variações (feliz, bravo, xis, espiral, alerta). Cada lance é uma sequência (Web Animations API): agachar, esticar, voo em arco, pouso com amassadinho e assentamento, com as partes seguindo por inércia. O estado lógico é aplicado antes; desfazer, nova partida ou novo lance terminam qualquer sequência na hora, no estado certo. O computador só responde depois da animação.

**Observado no vídeo de referência** (quadros próximos durante os lances): olhos grandes com pupila, olhos de seta/espiral ao ser capturado, olhos bravos, gota de suor, boné/acessório voando, estrelas em órbita, anel e rastro no pouso, poeira, "(( ))" de impacto, notas musicais, câmera em perspectiva e zooms.
**Criado por mim** (não afirmado como cópia): os desenhos e proporções dos 12 bichos, os tempos de cada tipo de peça, o "pof" de tinta, as piscadas e olhares ao acaso, a chance de cantarolar após lances calmos e o modo demonstração separado.

## O que foi testado

- `npm test`: 20 testes — roque (incluindo roque proibido por casa atacada), en passant, promoção para cavalo, mate, afogamento, material insuficiente, tripla repetição reivindicável, quíntupla automática, 50 lances reivindicável, 75 lances automático, desfazer contra o computador (inclusive após mate), notação em português, salvar/restaurar, rejeição de salvamento corrompido, perft do motor em 5 posições de referência, mate em 1, captura de dama pendurada e concordância do motor com o chess.js lance a lance numa partida aleatória.
- No navegador (Chromium automatizado): clique e arraste, resposta do computador, desfazer (com e sem o computador pensando), nova partida e troca de modo com o computador pensando (nenhum lance atrasado aplicado), jogar de pretas, promoção com escolha, xeque-mate, roque, aviso e reivindicação de tripla repetição, restauração após recarregar, build de produção sem nenhuma requisição externa e modo de movimento reduzido. Capturas de tela conferidas em 1366×768, 1920×1080, 1280×720 e 390×844 (abertura, seleção, captura, xeque, promoção, mate).

## Limitações

- Não é cópia pixel a pixel do vídeo: os bichos e os tempos são interpretação minha. A câmera/perspectiva só existe no modo demonstração (o tabuleiro normal é de frente e estável).
- As gravações e verificações de animação foram feitas em Chromium automatizado no Linux (~47 fps de captura); não foi rodado numa máquina Windows real.

- O nível difícil é um motor simples em JavaScript (sem livro de aberturas nem tabelas de finais); joga bem para um adversário casual, mas não no nível de engines como o Stockfish.
- Não há relógio de xadrez nem oferta de empate/abandono.
- Material insuficiente segue a definição do chess.js; outras posições "mortas" raras não são detectadas.
- O salvamento fica no navegador usado: outro navegador (ou limpar os dados do site) começa do zero.
- Em telas de celular o jogo funciona, mas foi pensado para o computador (os enfeites somem em telas estreitas).
- O tabuleiro é desenhado de frente e quadrado; o vídeo de referência usa movimentos de câmera em perspectiva, que não foram reproduzidos.
- `npm test` usa o suporte nativo do Node a TypeScript (Node 22.6 ou mais novo). O jogo em si roda com Node 18+.

## Créditos e licenças

- [chess.js](https://github.com/jhlywa/chess.js) 1.4.0 — BSD-2-Clause (`licencas/chess.js-LICENSE.txt`).
- Fonte **Playwrite BR** (Copyright Google Inc.) e **Patrick Hand** (Patrick Wagesreiter), via Fontsource — SIL Open Font License 1.1 (`licencas/`). As fontes são empacotadas localmente; nada é baixado durante o jogo.
- Tabelas de posição do motor baseadas na "Simplified Evaluation Function" de Tomasz Michniewski (Chess Programming Wiki).
- Peças, tabuleiro, motor e interface: feitos para este projeto.
