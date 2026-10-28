# chat-verticali

Una mod di Claude Code (plugin con hooks module TypeScript) per lavorare a "chat verticali": una chat per ogni task PACA, argomento o funzione di un repo. Quando il lavoro cambia verticale, o il contesto si riempie, la chat corrente passa il testimone a una nuova chat in una finestra tmux, con un brief scritto per bastare da solo; a lavoro finito la nuova chat riporta il risultato alla chat madre. Versione 0.2.2.

Nasce da un'abitudine pratica: una chat lunga e che salta tra più cose si degrada. Meglio chat corte e mirate, e un passaggio di consegne esplicito.

## Funzioni

- **Handoff con brief.** Il tool `handoff` salva un brief in `~/.claude/handoffs/<slug>.md` (obiettivo, scope, decisioni, stato, file, task PACA, cosa non fare), registra la chat verticale e apre una nuova chat in una finestra tmux (`tmux new-window -n <slug>`), con il modello scelto (`sonnet` di default; `haiku`, `opus`, `fable` a richiesta). Il prompt iniziale le dice di leggere il brief e di confermare in tre righe obiettivo, stato e prossimo passo prima di procedere. Prima di aprire, il tool chiede conferma all'utente.
- **Fuori da tmux.** Se non si è in tmux, o `tmux new-window` fallisce, la chat parte in background (`claude --bg`) e il risultato indica `claude attach <sessione>` per aprirla.
- **Registro.** Ogni verticale è un record nello store del plugin (chiave `v:<sessionId>`): slug, titolo, scope, sessione e sessione madre, cartella, modello, percorso del brief, task PACA, stato (`active`, `paused`, `done`), data di creazione e percentuale di contesto.
- **Riuso.** Se esiste già una verticale non chiusa con lo stesso slug, il tool chiede se riusarla. In caso affermativo manda il nuovo brief come messaggio alla chat in esecuzione; se non è raggiungibile, lo aggiunge in coda al file del brief (sezione `Aggiornamento`) e la riprende con `claude --resume`.
- **Ritorno alla madre.** Con il tool `vertical_done` la verticale scrive l'esito in coda al proprio brief (`## Esito`), si segna `done` o `paused` e manda il riepilogo alla chat madre. Se la madre non è raggiungibile il riepilogo resta nel brief. Se c'è un task PACA, la chat viene istruita a commentarlo e ad aggiornarne lo stato.
- **Regole nel system prompt.** A ogni composizione del prompt la mod aggiunge una sezione "Regole chat verticali": una chat un verticale; subagent per lavoro a risultato singolo, chat verticale per lavoro continuativo con decisioni dell'utente; proporre (mai imporre) un handoff quando la richiesta esce dal verticale, quando si passa a un task PACA diverso o quando il contesto supera il 60%; il brief deve bastare da solo. In una chat verticale la sezione aggiunge titolo, scope, task PACA, percorso del brief e l'obbligo di chiamare `vertical_done` a lavoro concluso.
- **Avvisi di contesto.** A fine turno, se il contesto supera il 60%, il 75% o il 90% (una volta per soglia e per sessione) compare un toast e viene aggiunto alla conversazione un messaggio che invita a proporre un handoff invece di `/compact`.
- **Avviso su task PACA diverso.** Se la chat cambia lo stato di un task PACA diverso da quello su cui sta lavorando (con `update_task` di qualsiasi server PACA: `paca`, `paca-homelab`, ...), il risultato del tool porta una nota che suggerisce un handoff. Il "task di riferimento" è quello della verticale o, per una chat normale, il primo task aggiornato.
- **Status line.** In una chat verticale la barra di stato mostra `⟂ <slug>`.

## Comandi e tool

| Cosa | Tipo | Che cosa fa |
|---|---|---|
| `/handoff <tema>` | comando | Fa preparare al modello (con un fork della conversazione) slug, titolo, scope e brief sul tema dato, poi avvia l'handoff come il tool. Senza tema stampa l'uso. |
| `/verticali [tutte]` | comando | Apre il pannello Verticali e stampa l'elenco testuale delle verticali di questo progetto (con `tutte`, di ogni progetto): stato, slug, titolo, modello, data, task PACA, percorso del brief e comando di ripresa. |
| `handoff` | tool MCP (`mcp__chat-verticali__handoff`) | Apre una nuova chat verticale. Parametri: `slug`, `title`, `scope`, `brief` (obbligatori); `paca_task_id`, `paca_ref`, `model`, `cwd` (opzionali). Va chiamato solo dopo averlo proposto all'utente. |
| `vertical_done` | tool MCP (`mcp__chat-verticali__vertical_done`) | Chiude o mette in pausa la verticale corrente. Parametri: `summary` (obbligatorio), `status` (`done` o `paused`, default `done`). |

## Come appare

I disegni sono ricavati dal codice di rendering (`hooks/register.tsx`, `hooks/panel.ts`), con dati inventati. I colori non si vedono in ASCII e sono annotati sotto.

### Pannello "Verticali"

Un pannello a sezioni con bordo arrotondato, mostrato solo se ci sono verticali. Si apre da solo all'avvio in una chat che ha verticali attive (come madre o come verticale) e con `/verticali`; si ridisegna quando il registro cambia (controllo ogni 4 secondi, perché il registro è scritto anche dalle altre sessioni). Qui è una chat madre, in un pannello largo 56 colonne:

```
╭──────────────────────────────────────────────────────╮
│ Attive (2)                                           │
│ ● home-16-pannello  HOME-16 Vai                      │
│   Pannello verticali · sonnet  ▰▰▰▱▱▱▱▱ 34%          │
│ ● acme-backup  Vai                                   │
│   Revisione dei backup notturni · opus  ▰▰▰▰▰▰▱▱ 72% │
╰──────────────────────────────────────────────────────╯
╭──────────────────────────────────────────────────────╮
│ In pausa (1)                                         │
│ ◐ acme-dns  HOME-9 Vai                               │
│   Failover del DNS secondario · sonnet  ▰▰▱▱▱▱▱▱ 21% │
╰──────────────────────────────────────────────────────╯
╭──────────────────────────────────────────────────────╮
│ Chiuse (ultime 5 di 7)                               │
│ ✓ home-12-scheda  HOME-12                            │
│   Scheda cluster nel pannello · sonnet               │
│ ✓ acme-traefik                                       │
│   Access log JSON · haiku                            │
╰──────────────────────────────────────────────────────╯
```

Nel disegno la sezione Chiuse mostra solo 2 righe per brevità; nel pannello reale sono fino a 5, dalla più recente.

Come si legge una riga:

- Prima riga: glifo di stato, slug in grassetto, badge del task PACA (se c'è), indicazione `(questa)` o `(madre)` quando la riga è la chat corrente o la sua madre, pulsante **Vai**.
- Seconda riga: titolo (tagliato in base alla larghezza), `·`, modello, poi la barra di contesto con la percentuale.
- Il pulsante **Vai** manca nelle righe chiuse e nella riga della chat corrente. Salta alla finestra tmux con `tmux select-window -t <slug>`. Se la finestra non c'è più, o non si è in tmux, copia `claude --resume <sessione>` negli appunti e lo segnala con un toast.
- La barra di contesto non c'è per le verticali chiuse, né finché la verticale non ha misurato il suo contesto.

Il pannello mostra solo le verticali del progetto della sessione: stessa repo git (le worktree contano come la repo principale) o, fuori da git, stessa cartella. Fanno eccezione le verticali legate alla sessione corrente (figlie o madre), mostrate ovunque siano. Senza verticali nel progetto il pannello dice `Nessuna chat verticale in questo progetto.`

Colori e glifi:

| Elemento | Resa |
|---|---|
| `●` | verticale attiva, verde |
| `◐` | in pausa, giallo |
| `✓` | chiusa, attenuata (anche slug e titolo) |
| Bordo e titolo di Attive / In pausa | verde / giallo; Chiuse e pannello vuoto in grigio |
| Badge del task (` HOME-16 `) | inverse, colore del terminale |
| `(questa)` e `(madre)` | attenuati |
| Barra di contesto `▰▱` | verde sotto 60%, gialla da 60%, rossa da 80% |
| Titolo, modello | attenuati |

Il contesto mostrato è quello che ogni verticale scrive sul proprio record (a ogni misura del contesto). Per le righe in sezione "Chiuse" il titolo dice `Chiuse (N)` se sono tutte visibili, `Chiuse (ultime 5 di N)` altrimenti.

### Barra di stato e finestre tmux

In una chat verticale la status line mostra lo slug:

```
⟂ home-16-pannello
```

Con tmux, la finestra della verticale si chiama come lo slug, per esempio:

```
 0:Mod UI multi-agent  1:home-16-pannello  2:acme-backup
```

(Se è installata anche la mod `multi-view`, questa non rinomina le finestre con un nome scelto a mano: lo slug resta.)

## Flusso: madre, verticale, ritorno

```
  CHAT MADRE                                   CHAT VERTICALE
  ----------                                   --------------
  il lavoro esce dal verticale,
  oppure contesto > 60%
        |
        v
  Claude PROPONE l'handoff
        |  l'utente accetta
        v
  tool handoff (brief, scope, modello)
        |
        |-- chiede conferma ("Apro una nuova chat?")
        |-- scrive ~/.claude/handoffs/<slug>.md
        |-- registra v:<sessione> = active
        |-- tmux new-window -n <slug>  ------------>  claude --session-id ...
        |                                                    |
        |                                              legge il brief,
        |                                              conferma in 3 righe
        |                                                    |
        |                                              lavora nello scope
        |                                              (utente decide)
        |                                                    |
        |                                              tool vertical_done
        |                                              (summary, done|paused)
        |                                                    |
        |   riepilogo via $.session.send               scrive "## Esito"
        |<---------------------------------------------- nel brief, registro
        v                                              aggiornato
  la madre riceve "[chat verticale ... done]"
  e il PACA del task viene commentato
```

Il riepilogo arriva alla madre come messaggio di un'altra sessione (se la madre è chiusa, resta nel brief). Il commento sul task PACA lo fa il modello, non la mod: la mod gli ricorda di farlo nel risultato del tool.

## Installazione

Da GitHub, al prompt di una sessione Claude Code nel terminale:

```
/plugin install chat-verticali --marketplace gorlix/claude-chat-verticali
```

Poi `y` per aggiungere il marketplace e la scope.

Da una copia locale, per svilupparla (il repo è anche un marketplace: `.claude-plugin/marketplace.json`, nome `gorlix-chat-verticali`, sorgente `./`):

```
claude plugin marketplace add ~/Documents/Git/claude-chat-verticali
claude plugin install chat-verticali@gorlix-chat-verticali
```

Poi, nella sessione già aperta, `/reload-plugins`. Il plugin è letto dalla cartella: dopo ogni modifica al codice basta di nuovo `/reload-plugins`, ma alza la versione in `plugin.json` a ogni rilascio, altrimenti resta in uso la copia in cache.

Requisiti: `tmux` (consigliato; senza si ripiega su `claude --bg`) e `claude` nel PATH. PACA è facoltativo: senza, `paca_task_id` e `paca_ref` restano vuoti.

## Sviluppo

```
claude-chat-verticali/
├── .claude-plugin/
│   ├── plugin.json        # nome, versione, descrizione, percorso dei tipi
│   └── marketplace.json   # marketplace gorlix-chat-verticali, sorgente ./
├── hooks/
│   ├── hooks.json         # dichiara il modulo: ./register.tsx
│   ├── register.tsx       # tool, comandi, regole nel prompt, pannello, soglie
│   └── panel.ts           # helper grafici puri: barra, glifi, raggruppamento
├── types/index.d.ts       # tipi condivisi
├── tests/register.test.ts
└── tsconfig.json
```

Comandi:

```
claude plugin validate ~/Documents/Git/claude-chat-verticali
claude plugin test ~/Documents/Git/claude-chat-verticali
```

Il type-check si fa con `tsc -p .`. Le funzioni che ricevono `$` stanno a livello top del file, e `panel.ts` non tocca mai `$`: restano pure e testabili.

## Limiti noti

- **Registro senza atomicità.** Il registro è uno store JSON del plugin (una chiave per verticale), condiviso tra tutte le sessioni; non c'è una transazione tra processi. Due sessioni che scrivono lo stesso record insieme possono sovrascriversi: in pratica ogni record lo scrive quasi solo la sua verticale, ma non è garantito.
- **Contesto delle altre chat.** Ogni verticale scrive la propria percentuale di contesto solo quando cambia; il pannello della madre mostra quindi l'ultimo valore noto, aggiornato al giro di controllo successivo (4 secondi), non una lettura in tempo reale. La madre non mostra il proprio contesto nel pannello, perché non ha un record: lo mostra la banda di `multi-view`, se installata.
- **`select-window` per prefisso.** Il pulsante **Vai** usa `tmux select-window -t <slug>`, e tmux risolve il nome anche per prefisso: slug che iniziano allo stesso modo (`home-1` e `home-16`) possono portare alla finestra sbagliata se quella esatta è sparita. Se nessuna finestra corrisponde, ripiega sul comando di ripresa copiato.
- **Il brief è fatto dal modello.** La qualità del passaggio dipende da quanto bene la chat madre riassume. `/handoff` chiede il JSON a un fork della conversazione e può fallire con un JSON non valido: in quel caso lo dice e conviene chiederlo a parole.
- **Il ritorno è best effort.** Se la madre è chiusa o non raggiungibile, il riepilogo resta solo nel brief; nessuna notifica successiva. Anche il commento su PACA dipende dal fatto che il modello esegua l'istruzione.
- **Fuori da tmux.** La modalità `--bg` è un ripiego: niente finestra da raggiungere con **Vai**, solo il comando `claude attach`.
- **Nessun pannello senza verticali.** Con zero verticali registrate il pannello si apre solo con `/verticali`.
