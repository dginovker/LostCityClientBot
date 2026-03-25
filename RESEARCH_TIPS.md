# Research Tips

How we figured out the hard parts of building this bot. Guide for future Claude Code instances.

## Finding the Source Code

The game you are botting is a fork of a **Lost City** RuneScape private server. The code is open source:

- **Server (engine):** https://github.com/LostCityRS/Engine-TS (branch `254`)
- **Client (TypeScript):** https://github.com/LostCityRS/Client-TS (branch `254`)
- **Game content (scripts/configs):** https://github.com/LostCityRS/Content (branch `254`)
- **Legacy org:** https://github.com/2004Scape/Server (redirects to LostCityRS)

The `254` branch corresponds to the version you are probably playing on. For fast analysis, you should clone the server repo locally (although note that you are not connected to it, this is just useful for understanding the code)

## Understanding the Protocol

The protocol details were found by reading the Engine-TS server code. Key files:

| What | Server File | Client File |
|------|-------------|-------------|
| Client opcodes & lengths | `src/network/game/client/ClientGameProt.ts` | `src/io/ClientProt.ts` |
| Server opcodes & lengths | `src/network/game/server/ServerGameProt.ts` | `src/io/ServerProt.ts` |
| Login handshake | `src/engine/World.ts` (onClientData) | `src/client/Client.ts` (login method) |
| NPC interaction handler | `src/network/game/client/handler/OpNpcHandler.ts` | `src/client/Client.ts` (MiniMenuAction.OP_NPC*) |
| NPC info packets | `src/network/game/server/codec/NpcInfoEncoder.ts` | `src/client/Client.ts` (getNpcPos methods) |
| Packet I/O | `src/io/Packet.ts` | `src/io/Packet.ts` |
| ISAAC cipher | `src/io/Isaac.ts` | `src/io/Isaac.ts` |

## How We Found the RSA Keys

The repo's `data/config/public.pem` contains a 512-bit RSA key, but the **production server uses different keys**. We extracted the live keys from the minified client JS served at rsleague.com:

```javascript
// Search the minified client.js for BigInt literals near the login code:
const re = /BigInt\("(\d+)"\)/g;
// Found near ".p1(254)" (the engine revision write)
```

The keys turned out to match the defaults in `bundle.ts` (the "original key, used 2003-2010"). But if a server uses custom keys, this extraction technique works.

## How We Found the WebSocket URL

Used Chrome DevTools MCP `evaluate_script` to search the minified client code:

```javascript
// Found: new WebSocket(`${X?"wss":"ws"}://${d}`, "binary")
// And: SX.Ip(window.location.host, "https:" === window.location.protocol)
```

Key finding: the WebSocket uses subprotocol `"binary"` and connects to `window.location.host`. This means the client connects to whatever host serves the page.

## How We Found NPC Type IDs

Searched the Content repo for pickpocket configs:

- **File:** `scripts/skill_thieving/configs/pickpocking/pickpocket.dbrow`
- **NPC ID mapping:** `pack/npc.pack` (maps internal names like `knight_of_ardougne` to numeric IDs)

Can also be found by logging in and calling `window.bot.getNpcs()` - each NPC has a `typeId` and `name` field.

## CORS Problem and Solution

When serving the modified client from localhost, `fetch('/crc')` etc. work fine (same-origin to localhost). But the **WebSocket** connects directly to rsleague.com (cross-origin), which works because WebSocket isn't subject to CORS.

The trick: a **local proxy server** (`serve.cjs`) that:
1. Serves static files (the built client) from `out/`
2. Proxies all other HTTP requests to rsleague.com (for `/crc`, `/title`, `/config`, `/interface`, `/media`, etc.)

This way HTTP fetches stay same-origin (no CORS) while WebSocket goes direct.

## Login Packet Format (Hardest Part)

The login packet format was the trickiest to get right when we first tried a raw protocol bot. Key discoveries:

1. **The RSA block includes a 1-byte length prefix inside the encrypted buffer.** The client's `Ja` (rsaenc) method writes `[length_byte][ciphertext]` into the buffer, and `this.La.la` (buffer position) includes this prefix.

2. **The payload length formula is:** `rsaBlockLen + 36 + 1 + 1` where rsaBlockLen = 1 (length prefix) + ciphertext length.

3. **RSA ciphertext needs a sign byte.** The client prepends a `0x00` byte if the high bit of the first byte is set (treating the result as a signed BigInteger). Missing this causes the server to decrypt garbage.

4. **The jstring terminator is `\n` (byte 10)**, not `\0` (byte 0). This is unusual and easy to get wrong.

5. **ISAAC cipher setup:** Client encrypts with `Isaac(seed)`, decrypts with `Isaac(seed.map(s => s + 50))`. Server does the reverse.

## Figuring Out the Minified Client Code

The live client at rsleague.com is minified with Terser. Property names are mangled. To understand it:

1. **Search for known strings** like `"Connecting to server"`, `".p1(254)"`, `"Welcome to RuneScape"` to find code regions
2. **Search for known patterns** like `new WebSocket(`, `BigInt("` to find specific functionality
3. **Method identification:** Find method definitions by searching for `methodName(params){body}` patterns
4. **Cross-reference with the unminified source** in the Client-TS repo to understand what the minified code does

Key minified names we identified:
- `la` = `pos` (Packet position)
- `ta` = `g4s()` (read int32)
- `ua` = `g8()` (read BigInt64)
- `Ea` = `pjstr()` (write string)
- `Fa` = `pdata()` (write byte array)
- `Ja` = `rsaenc()` (RSA encrypt)
- `Ip` = `openSocket()` (WebSocket connect)
- `La` = RSA packet buffer
- `It` = login packet buffer

## Why the Modified Client Approach Won

We tried three approaches:

1. **Raw protocol bot (Node.js)** - Implemented ISAAC, RSA, packet parsing from scratch. Got login working but couldn't watch it, and handling the full game protocol (NPC_INFO bit-packed parsing, PLAYER_INFO, zone updates) was extremely complex.

2. **Browser automation (clicking canvas)** - Tried using Chrome DevTools MCP to click on the canvas-rendered game. The game renders everything in a `<canvas>` element so DOM-based clicking doesn't work. Simulated mouse events with `dispatchEvent` were unreliable.

3. **Modified client with Bot API (winner)** - Cloned the real client source, added `window.bot` API, built it, served locally with a proxy. Full access to game internals, visible in Chrome, and only ~50 lines of bot code needed.

The key insight: **don't fight the client, extend it.** The game client already handles all the protocol complexity. We just needed to expose its internals.

## How We Built Combat (Lesser Demon Script)

This was the hardest script to get working. Key learnings:

### Don't Send Raw Packets — Use `doAction()`

Our first approach was writing raw packets with `c.out.pIsaac(opcode)`. This works for simple things but has a fatal flaw: **every `pIsaac()` call advances the ISAAC cipher state.** If you send a packet the server doesn't expect (wrong opcode, extra packet, malformed data), the ISAAC counters desync and every subsequent packet becomes garbage. The server disconnects you.

The fix: use the game's own `doAction()` method, which handles packet construction correctly:
```javascript
c.menuAction[0] = 242; // MiniMenuAction.OP_NPC1
c.menuParamA[0] = npcSlot;
c.menuParamB[0] = 0;
c.menuParamC[0] = 0;
c.doAction(0);
```

Even better: use `addNpcOptions()` to build the menu from the NPC's actual data, then `doAction()` on it. This gets correct opcodes and priority flags automatically. This is what `bot.interactNpc()` does.

### NPC Attack Opcodes Vary Per NPC

We assumed "Attack" was always OPNPC1 (opcode 143). **Wrong.** The lesser demon has Attack on `op[1]`, which maps to OPNPC2 (opcode 195). Other NPCs might have it on `op[0]`, `op[2]`, etc. depending on their config.

We discovered this by calling `addNpcOptions()` and inspecting the generated menu:
```javascript
c.menuNumEntries = 0;
c.addNpcOptions(npc.type, slot, 0, 0);
// menu[0] was action=2209 (2000 + 209 = priority + OP_NPC2), NOT 242 (OP_NPC1)
```

### Priority Flag for Higher-Level NPCs

When an NPC's combat level exceeds the player's, the game adds `_PRIORITY (2000)` to the menu action value. So attacking a level-82 lesser demon as a level-19 player gives action `2000 + 209 = 2209`, not `209`. The `interactNpc()` method handles this automatically.

### Caged NPCs and `tryMove()`

For caged NPCs (like the lesser demon in Wizards' Tower), `tryMove()` returns `false` because pathfinding can't reach through cage bars. This means **no MOVE_OPCLICK packet is sent** before the OPNPC packet. The server still processes the attack if the player is in spell range, but only if autocast is set up. Without autocast, it tries melee, which fails with "I can't reach that!"

### Autocast Setup Requires Multi-Step Interface Flow

Setting up autocast Wind Bolt requires clicking through multiple interface buttons with waits between them:
1. `setTab(0)` — open combat tab
2. `clickButton(353)` — click "Choose Spell" (opens staff_spells overlay)
3. **Wait 1 tick** — server needs to send the overlay
4. `clickButton(1834)` — select Wind Bolt
5. **Wait 1 tick** — server processes spell selection
6. `selectButton(349)` — enable autocast toggle

Key distinction: `clickButton()` uses `IF_BUTTON` (action 231) for `buttontype=normal`. `selectButton()` uses `SELECT_BUTTON` (action 225) for `buttontype=select`. Using the wrong one silently fails.

### `handleBlockingUI()` Can Interfere With Setup

The `startScript()` runner calls `handleBlockingUI()` every tick, which dismisses dialogs and closes modals. If the autocast spell selection overlay is open, `handleBlockingUI()` might close it before the spell can be selected. The fix: `handleBlockingUI()` no longer skips the action function — it runs but the action always executes too.

### Stuck Detection After Level-Ups

After a level-up or relog, autocast resets and the bot gets stuck saying "I can't reach that!" (trying melee on caged demon). Detection: count attack ticks where demon HP stays at 0. After 5 ticks with no damage, walk one tile in a random direction and redo the autocast setup.

Don't use message-based stuck detection (`getMessages` checking for "I can't reach") — old messages stay in the queue and cause infinite reset loops.

## How to Find Interface Component IDs

Interface component IDs are needed for `clickButton()` and `selectButton()`. Find them in the Content repo:

1. **Clone/browse:** https://github.com/LostCityRS/Content (branch `254`)
2. **Pack file:** `pack/interface.pack` maps numeric IDs to named components
   ```
   353=combat_staff_2:auto_choose    ← "Choose Spell" button
   349=combat_staff_2:auto_toggle    ← Autocast on/off toggle
   1834=staff_spells:ssb4            ← Wind Bolt spell button
   ```
3. **Interface definitions:** `scripts/skill_combat/interfaces/magic/combat_staff_2.if` shows button types, positions, and script conditions
4. **Button types matter:** `buttontype=normal` → use `clickButton()`. `buttontype=select` → use `selectButton()`.

## How to Read Inventory Programmatically

The inventory is stored in IfType interface components:
```javascript
const IfType = bot._client.chatInterface.constructor;
const inv = IfType.list[3214]; // inventory component
inv.linkObjType[slot]   // item type ID (may be offset by 1 from obj.pack)
inv.linkObjNumber[slot] // item count
```

Note: `IfType` is not a global — access it via any existing interface component's constructor. The `chatInterface` property on the client works.

Item IDs can be looked up in the Content repo at `pack/obj.pack`.
