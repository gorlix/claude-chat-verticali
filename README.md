# chat-verticali

Una mod di Claude Code (plugin con hooks module TypeScript) per lavorare a "chat verticali": una chat per ogni task PACA, argomento o funzione di un repo. Quando il lavoro cambia verticale, o il contesto si riempie, la chat corrente passa il testimone a una nuova chat con un brief scritto per bastare da solo; a lavoro finito la nuova chat riporta il risultato alla chat madre. Versione 1.0.0.

Nasce da un'abitudine pratica: una chat lunga e che salta tra più cose si degrada. Meglio chat corte e mirate, e un passaggio di consegne esplicito.

Dalla 1.0 ogni verticale è una **sessione in background** (`claude --bg`): in tmux la sua finestra è solo un `claude attach <id>`. Chiudere la finestra (Nascondi) non ferma la chat: resta "parcheggiata" e si riapre dall'**hub**, il pannello della chat madre nella finestra 0.

## Funzioni

- **Handoff con brief.** Il tool `handoff` salva un brief in `~/.claude/handoffs/<slug>.md` (obiettivo, scope, decisioni, stato, file, task PACA, cosa non fare), avvia la verticale con `claude --bg -n <nome> --model <modello> "<prompt>"` (`sonnet` di default; `haiku`, `opus`, `fable` a richiesta) e la registra. Il prompt iniziale le dice di leggere il brief e di confermare in tre righe obiettivo, stato e prossimo passo. Prima di aprire, il tool chiede conferma all'utente.
- **Finestra tmux.** In tmux la mod apre `tmux new-window -n <nome breve> -c <cwd> claude attach <id>` e marca la finestra con l'opzione `@cv_id <sessionId>`, che serve a ritrovarla. Si apre sempre per id, mai per nome (`claude attach` accetta anche una parte del nome). Fuori da tmux il risultato indica `claude attach <id>`.
- **Nomi.** Con un task PACA la sessione si chiama `<REF>: <Titolo>` (per esempio `HOME-16: Pannello verticali`) e la finestra `<REF>: <titolo breve>`, con il titolo tagliato a fine parola entro 20 caratteri. Senza PACA, sessione e finestra prendono il titolo (breve). Lo slug resta l'identificativo tecnico: nome del brief, registro, univocità.
- **Hub.** La chat madre del progetto è l'hub: la chiave `hub:<progetto>` dello store punta alla sua sessione. Al primo handoff, o con `/verticali`, una chat normale diventa hub. Se non si chiama già `hub-*`, la mod la rinomina `hub-<repo>` con `/rename` e rinomina la sua finestra tmux in `hub`. Se c'è già un altro hub vivo nel progetto, la chat resta una madre delle sole sue figlie.
- **Registro.** Ogni verticale è un record nello store del plugin (chiave `v:<sessionId>`): slug, titolo, scope, sessione e id corto (`agentId`), sessione madre, cartella e progetto, modello, brief, task PACA, stato (`active`, `paused`, `done`), data di creazione, percentuale di contesto e ultima attività. `claude --bg` sceglie da sé il session id: la mod lo legge da `claude agents --json` dopo l'avvio.
- **Riuso.** Se esiste già una verticale non chiusa con lo stesso slug, il tool chiede se riusarla. In caso affermativo manda il nuovo brief come messaggio alla chat; se non è raggiungibile, lo aggiunge in coda al brief (sezione `Aggiornamento`) e riapre la finestra con `claude attach`.
- **Ritorno alla madre.** Con il tool `vertical_done` la verticale scrive l'esito in coda al proprio brief (`## Esito`), si segna `done` o `paused` e manda il riepilogo alla chat madre. Se la madre non è raggiungibile il riepilogo va nella sua casella (`inbox:<sessionId>`) e le viene consegnato, con un toast, appena si riapre. Se la madre fa `/clear`, figlie, casella e ruolo di hub passano al nuovo id. Se c'è un task PACA, la chat viene istruita a commentarlo e ad aggiornarne lo stato.
- **Gate di pulizia prima di `done`.** Una verticale non si chiude `done` senza aver pulito ciò che ha creato. La mod lo impone in quattro passi:
  1. Il primo `vertical_done` con `done` non chiude. Restituisce un inventario deterministico in due liste. **Mie** sono le voci create da questa verticale: file lasciati modificati, repo principale lasciato su un altro branch, worktree, rami, stash, sessioni `--bg` avviate, figlie aperte e le loro finestre. **Non mie** sono le altre novità del progetto dall'avvio: vanno solo segnalate («non mio, non toccato») e non si toccano.
  2. Il modello risponde con `cleanup_plan`: ogni voce sua da tenere o rimuovere, con il motivo, più i file temporanei e i processi che ha avviato. Un piano che salta una voce sua, o che rimuove una voce non sua, viene rifiutato. Il record passa a `cleanupStatus: pending`.
  3. Chi approva è l'hub del progetto, se è vivo, altrimenti la madre, anche se è a sua volta una verticale. Nell'hub la riga mostra `⌫` e compare la domanda all'utente: **Approva**, **Rifiuta**, oppure modifiche scritte in "Other". La risposta va nel record e arriva alla verticale come messaggio. Il pulsante **Pulizia** sulla riga ripropone la domanda, ma mai due domande aperte insieme per la stessa verticale. Una risposta a un piano nel frattempo cambiato viene scartata. Una verticale senza madre chiede direttamente all'utente.
  4. La verticale pulisce e richiama `vertical_done` con `cleanup_report`. La mod rifà l'inventario: se resta una voce sua che il piano non tiene, rifiuta e la elenca; altrimenti chiude.

  L'attribuzione viene dal record. All'avvio la mod salva branch, rami, worktree e file già modificati. Un file già modificato all'avvio non è mai della verticale: si segnala soltanto. Un record senza baseline, cioè una verticale nata prima del gate, la prende al primo inventario. Durante il lavoro, a ogni chiamata `EnterWorktree` e a ogni `Bash` che nomina `git`, `gh`, `claude` o `worktree`, confronta lo stato del repo prima e dopo (rami, worktree, stash per hash, file da `git status -z` rispetto alla radice), e legge l'id delle sessioni da `backgrounded · <id>`. A ogni `Edit`/`Write` annota il file. Una voce nuova creata dopo l'approvazione annulla il piano approvato. `paused` non passa dal gate e azzera un piano in sospeso, ma il riepilogo riporta l'inventario. La pulizia non si traccia su PACA.
- **Chiusura.** A fine del turno che ha chiamato `vertical_done` (non se interrotto), dopo 5 secondi per lasciar leggere l'ultima risposta: con `done` la finestra si chiude e la sessione si ferma (`claude stop <id>`, la cronologia resta); con `paused` si chiude solo la finestra, come Nascondi. Lo fa una shell staccata (`setsid`), così lo stop sopravvive alla sessione che lo lancia.
- **Vecchie madri.** Una madre di prima della 1.0 non viene rinominata. Se è viva tiene le sue figlie, che nell'hub stanno sotto `madre: <nome>`. Se è spenta (assente da `claude agents --json`), l'hub adotta le sue verticali non chiuse e la sua casella.
- **Regole nel system prompt.** A ogni composizione del prompt la mod aggiunge una sezione "Regole chat verticali": una chat un verticale; subagent per lavoro a risultato singolo, chat verticale per lavoro continuativo con decisioni dell'utente; proporre (mai imporre) un handoff quando la richiesta esce dal verticale, quando si passa a un task PACA diverso o quando il contesto supera il 60%; il brief deve bastare da solo. In una chat verticale la sezione aggiunge titolo, scope, task PACA, percorso del brief e l'obbligo di chiamare `vertical_done` a lavoro concluso.
- **Avvisi di contesto.** A fine turno, se il contesto supera il 60%, il 75% o il 90% (una volta per soglia e per sessione) compare un toast e viene aggiunto alla conversazione un messaggio che invita a proporre un handoff invece di `/compact`.
- **Avviso su task PACA diverso.** Se la chat cambia lo stato di un task PACA diverso da quello su cui sta lavorando (con `update_task` di qualsiasi server PACA: `paca`, `paca-homelab`, ...), il risultato del tool porta una nota che suggerisce un handoff.
- **Status line.** In una chat verticale la barra di stato mostra `⟂ <slug>`.

## Comandi e tool

| Cosa | Tipo | Che cosa fa |
|---|---|---|
| `/handoff <tema>` | comando | Fa preparare al modello (con un fork della conversazione) slug, titolo, scope e brief sul tema dato, poi avvia l'handoff come il tool. Senza tema stampa l'uso. |
| `/verticali [tutte]` | comando | Apre l'hub, rende hub la chat (se non è una verticale e non c'è un altro hub vivo) e stampa l'elenco testuale delle verticali del progetto (con `tutte`, di ogni progetto), con il comando per riaprirle. |
| `handoff` | tool MCP (`mcp__chat-verticali__handoff`) | Apre una nuova chat verticale. Parametri: `slug`, `title`, `scope`, `brief` (obbligatori); `paca_task_id`, `paca_ref`, `model`, `cwd` (opzionali). Va chiamato solo dopo averlo proposto all'utente. |
| `vertical_done` | tool MCP (`mcp__chat-verticali__vertical_done`) | Chiude o mette in pausa la verticale corrente. Parametri: `summary` (obbligatorio), `status` (`done` o `paused`, default `done`), `cleanup_plan` (`[{item, action: keep\|remove, reason}]`) e `cleanup_report` per il gate di pulizia. |

## Come appare

I disegni sono ricavati dal codice di rendering (`hooks/register.tsx`, `hooks/panel.ts`), con dati inventati. I colori non si vedono in ASCII e sono annotati sotto.

### Hub

Un pannello agganciato di lato (in fullscreen da 110 colonne; chiede 72 colonne, al massimo il 45% del terminale) o sopra il prompt. Si apre da solo all'avvio in una chat che non è una verticale e che è l'hub del progetto o ha verticali aperte, e con `/verticali`. Nelle verticali non si apre da solo. Ogni 3 secondi legge `claude agents --json` e le finestre tmux marcate (`tmux list-windows -a`) e si ridisegna se qualcosa cambia.

```
╭────────────────────────────────────────────────────────────────────╮
│ Verticali (4)                                                      │
│ Revisione dei backup: Apri Nascondi Stop Chiudi                    │
│ ? Revisione dei backup notturni  ▰▰▰▰▰▰▱▱ 72% 4m  [ Nascondi ]     │
│ └ ● Script di restore  ▰▱▱▱▱▱▱▱ 9% 1m  [ Nascondi ]                │
│ ◆ Pannello verticali  HOME-16  ▰▰▰▱▱▱▱▱ 34% 12m  [ Nascondi ]      │
│ ▫ Failover del DNS secondario  HOME-9  ▰▰▱▱▱▱▱▱ 21% 2h            │
╰────────────────────────────────────────────────────────────────────╯
╭────────────────────────────────────────────────────────────────────╮
│ madre: portfolio-main-3                                            │
│ ● Access log JSON  ▰▰▱▱▱▱▱▱ 18% 3m                                 │
╰────────────────────────────────────────────────────────────────────╯
╭────────────────────────────────────────────────────────────────────╮
│ Chiuse (ultime 5 di 7)                                             │
│ ✓ Scheda cluster nel pannello  HOME-12                             │
╰────────────────────────────────────────────────────────────────────╯
```

Le righe sono un albero: le verticali di primo livello in ordine di attenzione (a parità, la più recente prima), ciascuna seguita dalle sue sotto-verticali rientrate con `└`. Una riga: glifo, titolo (è un pulsante: Invio o clic = **Vai**), badge PACA, `(questa)`/`(madre)`, barra e percentuale di contesto, ultima attività (`4m`, `2h`, `5g`), pulsante **Nascondi** se la finestra è aperta.

Glifi, in ordine di attenzione:

| Glifo | Significato | Da `claude agents --json` |
|---|---|---|
| `?` rosso | permesso o domanda | `waitingFor` = permission prompt / dialog |
| `⌫` magenta | pulizia da approvare | registro `cleanupStatus: pending` |
| `◆` giallo | input richiesto | `status` waiting, altro `waitingFor`, o `state` blocked |
| `●` verde | al lavoro | `status` busy o `state` working |
| `○` | aperta, ferma | viva e con la finestra aperta |
| `▫` attenuato | nascosta | nessuna finestra (sessione viva o spenta: `attach` la riavvia) |
| `◐` giallo | in pausa | registro `paused` |
| `✓` attenuato | chiusa | registro `done` (ultime 5, sezione a parte) |

Barra di contesto `▰▱`: verde sotto 60%, gialla da 60%, rossa da 80%. Il badge PACA è inverse.

**Tasti** (con il pannello a fuoco: ctrl+x tab o clic). Tab e frecce scelgono la riga; i tasti agiscono sulla riga a fuoco, altrimenti sulla prima:

| Tasto | Azione |
|---|---|
| Invio sulla riga, `a` | **Vai/Apri**: seleziona la finestra con `@cv_id`; se non c'è la apre con `claude attach <id>` (una verticale in pausa torna attiva). Fuori da tmux copia il comando negli appunti. |
| `h` | **Nascondi**: `tmux kill-window`, la sessione resta viva. Nessuna conferma. |
| `s` | **Stop**: chiude la finestra e fa `claude stop <id>`, con conferma. La cronologia resta. |
| `x` | **Chiudi**: con conferma, chiede alla verticale di chiamare `vertical_done` (che poi la ferma). Se non è raggiungibile la segna chiusa senza riepilogo e la ferma. |

**Pannello stretto.** Sotto 60 colonne di corpo il pannello passa al layout compatto: glifo, titolo tagliato e barra corta con percentuale, senza badge PACA né ultima attività; la riga dei tasti mostra solo i tasti.

**Verticali v0.3** (interattive, senza `agentId`): restano visibili e raggiungibili con **Vai** (`tmux select-window -t <slug>`, ripiego su `claude --resume` copiato), ma non si possono nascondere né fermare dall'hub.

### Barra di stato e finestre tmux

In una chat verticale la status line mostra `⟂ <slug>`. Le finestre tmux, con l'hub in finestra 0:

```
 0:hub  1:HOME-16: Pannello verticali  2:Revisione dei backup
```

La sessione tmux per progetto la apre l'utente: la mod non crea sessioni tmux e non tocca le opzioni globali.

## Flusso: madre, verticale, ritorno

```
  HUB (chat madre, finestra 0)                 CHAT VERTICALE (claude --bg)
  ----------------------------                 ----------------------------
  il lavoro esce dal verticale,
  oppure contesto > 60%
        |
        v
  Claude PROPONE l'handoff, l'utente accetta
        |
  tool handoff
        |-- chiede conferma
        |-- scrive ~/.claude/handoffs/<slug>.md
        |-- claude --bg -n "<REF>: <Titolo>"  ---->  parte in background,
        |-- legge l'id da claude agents --json        legge il brief,
        |-- registra v:<sessione> = active            conferma in 3 righe
        |-- tmux new-window claude attach <id>
        |   + @cv_id; madre -> hub                    lavora nello scope
        |                                                    |
        |   (h nasconde la finestra, a la riapre:            |
        |    la sessione resta viva)                         |
        |                                              tool vertical_done
        |   riepilogo via $.session.send               scrive "## Esito",
        |<---------------------------------------------- registro aggiornato
        v                                                    |
  la madre riceve "[chat verticale ... done]"          a fine turno:
  e il PACA del task viene commentato                  kill-window + claude stop
```

Il commento sul task PACA lo fa il modello, non la mod: la mod gli ricorda di farlo nel risultato del tool.

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

Requisiti: Claude Code 2.1.318 o successivo (`claude --bg`, `claude agents --json`, `claude attach`, `claude stop`), `claude` e `setsid` nel PATH, `tmux` consigliato (senza, le verticali partono comunque in background e si aprono con `claude attach <id>`). PACA è facoltativo: senza, `paca_task_id` e `paca_ref` restano vuoti.

## Sviluppo

```
claude-chat-verticali/
├── .claude-plugin/
│   ├── plugin.json        # nome, versione, descrizione, percorso dei tipi
│   └── marketplace.json   # marketplace gorlix-chat-verticali, sorgente ./
├── hooks/
│   ├── hooks.json         # dichiara il modulo: ./register.tsx
│   ├── register.tsx       # tool, comandi, avvio in background, hub, tasti, chiusura, soglie
│   └── panel.ts           # helper puri: nomi, attenzione, glifi, albero, barra
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
- **Registro dopo l'avvio.** `claude --bg` sceglie il session id, quindi il record nasce un attimo dopo l'avvio: il primo turno della verticale può non avere ancora la sezione di scope nel system prompt (il prompt iniziale le fa comunque leggere il brief) e la status line `⟂ slug` compare al primo giro di controllo.
- **Sessioni spente.** Una sessione in background ferma e non collegata da circa un'ora viene spenta da Claude Code: nell'hub appare come nascosta (`▫`) e riparte al successivo **Vai**. Non è verificato se un messaggio (riuso, Chiudi) la risvegli: se non arriva, il riuso aggiunge l'aggiornamento al brief e Chiudi la segna chiusa senza riepilogo.
- **Attribuzione per differenza.** Una verticale si attribuisce ciò che compare nel repo durante una sua chiamata `Bash`: se un'altra chat crea un ramo nello stesso istante, finisce tra le voci della verticale. Il controllo costa sei comandi git in parallelo prima e dopo i `Bash` che possono creare qualcosa. Un file scritto da un `Bash` senza git (per esempio `echo > f`) non viene attribuito: resta tra le voci non mie, e quindi non si tocca. I file temporanei fuori dal repo non sono tracciati: li dichiara il modello nel piano.
- **Gate di pulizia, casi minori.** Se l'utente chiude la domanda di approvazione senza rispondere, il poll non la ripropone: resta il pulsante **Pulizia** sulla riga. Se una domanda è già aperta, una seconda richiesta (pulsante o gate) risponde come per una domanda chiusa. La voce di stash mostra solo l'hash breve e il messaggio, non `stash@{N}`. Per le verticali nate prima del gate la baseline si prende al primo uso, quindi quanto creato prima risulta «non mio». I file creati da un `Bash` senza git non vengono attribuiti alla verticale.
- **Costo del controllo.** L'hub esegue `claude agents --json` e `tmux list-windows` ogni 3 secondi finché ha verticali aperte.
- **Socket tmux.** La chiusura a `done` parte dalla sessione in background, che non eredita `$TMUX`: usa il socket tmux di default.
- **Contesto delle altre chat.** Ogni verticale scrive la propria percentuale di contesto solo quando cambia; l'hub mostra l'ultimo valore noto. La madre non mostra il proprio contesto, perché non ha un record.
- **Il brief è fatto dal modello.** La qualità del passaggio dipende da quanto bene la chat madre riassume. `/handoff` chiede il JSON a un fork della conversazione e può fallire con un JSON non valido: in quel caso lo dice e conviene chiederlo a parole.
- **Il ritorno è best effort.** Anche il commento su PACA dipende dal fatto che il modello esegua l'istruzione.
