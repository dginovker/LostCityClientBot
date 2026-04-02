# Research Tips

How we figured out the hard parts of building this bot. Guide for future Claude Code instances.

## Finding the Source Code

The game you are botting is a fork of a **Lost City** RuneScape private server. The code is open source:

- **Server (engine):** https://github.com/LostCityRS/Engine-TS (branch `254`)
- **Client (TypeScript):** https://github.com/LostCityRS/Client-TS (branch `254`)
- **Game content (scripts/configs):** https://github.com/LostCityRS/Content (branch `254`)
- **Legacy org:** https://github.com/2004Scape/Server (redirects to LostCityRS)
- **Bot API reference (third-party):** https://gitlab.com/project-undercut/moldy-swiss-cheese/-/tree/254-bot/api — Another bot implementation for the same 254 server. Useful for understanding how to interact with the game protocol, send packets, and handle interfaces. Clone with `git clone --branch 254-bot https://gitlab.com/project-undercut/moldy-swiss-cheese.git`

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

When serving the modified client from localhost, `fetch('/crc')` etc. work fine (same-origin to localhost). But the **WebSocket** connects directly to the game server (cross-origin), which works because WebSocket isn't subject to CORS.

The trick: a **local proxy server** (`serve.cjs`) that:
1. Checks if the request is for a cache file (`crc`, `title`, `config`, `interface`, `media`, `versionlist`, `textures`, `wordenc`, `sounds`, `build`, `ondemand.zip`) — if so, proxies to the upstream game server (currently `play.rn04.rs`)
2. Falls back to serving static files (the built client JS, HTML, wasm) from `out/`

**Critical:** Cache files must be proxied BEFORE checking local files. The `out/` directory may contain stale cache files from a previous server. If the local file takes priority, you'll get CRC/data mismatches. The cache file matching also needs to handle both exact names (`/crc`) and CRC-suffixed names (`/config-3555567`). Note: some servers omit the hyphen separator (e.g. `versionlist1866360969` instead of `versionlist-1866360969`), so the matcher should handle `basename.startsWith(known)` broadly.

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

## How to Add Server Admin Commands (::commands)

Admin/debug commands like `::npc`, `::tele`, `::give` are handled in the Engine-TS server code at:
- **File:** `src/network/game/client/handler/ClientCheatHandler.ts`

The command handler is organized by staff mod level:
- `staffModLevel >= 4` + `!NODE_PRODUCTION` — Developer commands (destructive, testing)
- `staffModLevel >= 3` — Admin commands (item spawning, teleporting, NPC spawning)
- `staffModLevel >= 2` — Super-moderator commands (coords, visibility)

In non-production mode, all users get `staffModLevel = 4` (set in `src/server/login/LoginThread.ts`).

**Key existing commands:**
- `::npcadd <internal_name>` — Spawns an NPC by its `npc.pack` internal name (e.g., `::npcadd macro_geni`)
- `::give <obj_name>` — Gives an item by `obj.pack` name
- `::tele <level>,<mx>,<mz>,<lx>,<lz>` — Teleports to coordinates
- `::random` — Triggers random event readiness (`player.afkEventReady = true`)

**NPC spawning pattern** (from `::npcadd`):
```typescript
const type: NpcType | null = NpcType.getByName(name);
World.addNpc(new Npc(player.level, player.x, player.z, type.size, type.size,
  EntityLifeCycle.DESPAWN, World.getNextNid(), type.id, type.moverestrict, type.blockwalk), 500);
```

**Random event NPC names** (from `content/pack/npc.pack`):
| Friendly Name | Internal Name | NPC ID |
|--------------|---------------|--------|
| genie | macro_geni | 409 |
| dwarf | macro_dwarf | 956 |
| oldman | macro_mysterious_old_man | 410 |
| swarm | macro_swarm | 411 |
| rivertroll | macro_rivertrollguardian_1 | 391 |
| rockgolem | macro_golemguardian_1 | 413 |
| zombie | macro_zombie1 | 419 |
| shade | macro_shade1 | 425 |
| watchman | macro_watchman1 | 431 |
| treespirit | macro_dryhadguardian_1 | 438 |

Note: Combat-type random events (rivertroll, rockgolem, zombie, shade, watchman, treespirit) have 6 level variants each (e.g., `macro_zombie1` through `macro_zombie6`). The `_1` variants are the lowest level.

**Sending commands from the bot client:**
```javascript
const c = bot._client;
const cmd = 'spawnevent genie'; // without the :: prefix
c.out.pIsaac(86); // ClientProt.CLIENT_CHEAT = 86
c.out.p1(cmd.length + 1);
c.out.pjstr(cmd);
```

**Important:** Random event NPCs have AI scripts that auto-despawn them within a few game ticks because they expect a `%npc_macro_event_target` variable (set by the normal random event system). When spawned manually, they'll appear briefly then despawn. This is expected behavior.

## How to Skip Tutorial Island

New accounts spawn on Tutorial Island. The `::tele` command (staffModLevel >= 2) can teleport the player to the mainland.

**The `::tele` command format** is `tele <level>,<mx>,<mz>,<lx>,<lz>` where:
- `level` = plane (0-3)
- `mx` = map square X (`absX >> 6`)
- `mz` = map square Z (`absZ >> 6`)
- `lx` = local tile X (`absX & 63`)
- `lz` = local tile Z (`absZ & 63`)

For Lumbridge (abs 3222, 3218): `tele 0,50,50,22,18`

**CLIENT_CHEAT packet format** (found in `src/client/Client.ts` around line 3359):
```typescript
this.out.pIsaac(ClientProt.CLIENT_CHEAT);  // opcode 86
this.out.p1(this.chatInput.length - 2 + 1); // length = cmd.length + 1 (null terminator)
this.out.pjstr(this.chatInput.substring(2)); // command without :: prefix
```

The `p1` value is `cmd.length + 1` because `pjstr` writes the string followed by a null terminator byte, and `p1` encodes the total length of what `pjstr` writes.

**Bot API method added:** `bot.tele(absX, absZ, level)` and `bot.sendCommand(cmd)` handle the packet format automatically.

**Local dev server advantage:** In non-production mode, all accounts get staffModLevel 4, giving full access to all cheat commands including `::tele`, `::give`, `::setstat`, etc. This is set in `src/server/login/LoginThread.ts`.

## How to Read Obj Properties (Recolour, Model, etc.)

We added `ObjType` access to the BotApi. Use `bot.getObjInfo(packId)` to get recolour data, model info, etc. This was essential for solving the Mysterious Box random event where shape colors are encoded in `recol_d`.

```javascript
bot.getObjName(3062)  // "Strange box"
bot.getObjInfo(3063)  // { recol_s: [115], recol_d: [1703], ... }
```

## How We Solved the Mysterious Box Random Event

The Mysterious Box (modal 6554) shows 3 coloured shapes and asks either "What colour is the [shape]?" or "Which shape is [colour]?".

**Key discovery:** The shape models are displayed via type-6 interface components (6555, 6557, 6559) with `model1Type=4` (obj model). The `model1Id` is the obj pack ID. We determine colors from `ObjType.list(packId).recol_d[0]`:
- 1703 = Red
- 43429 = Blue
- 8749 = Yellow

The three models correspond positionally to the three answer labels (6565, 6566, 6567). Each model's shape name comes from its corresponding answer text. We match the queried attribute (color or shape) against the model data to find the correct button (6562/6563/6564).

**Integration:** Box solving is automatically triggered in `startScript()` before the user's action function runs. It detects boxes in inventory, opens them, and solves the quiz — all transparently.

## Login Rate-Limit Throttle

The bot's `startScript()` auto-re-login was firing every 10 seconds, which quickly triggered the server's "Login limit exceeded" (response 9) or "Login attempts exceeded" (response 16) rate limit. The fix:

1. **30-second base delay** between re-login attempts (down from 10s — only 2 attempts/min instead of 6)
2. **Rate-limit detection** by checking `c.loginMes1` for "Login limit", "Login attempts exceeded", or "Too many connections"
3. **Exponential backoff** starting at 65s (respecting server's "wait 1 minute" message), doubling up to 120s max
4. **Reset on success** — backoff resets to 30s when login succeeds

The detection reads `loginMes1` (field name `loginMes1` on Client, accessible via `c.loginMes1` since `c = client as any`). Server response codes: 9 = "Login limit exceeded", 16 = "Login attempts exceeded".

## How We Got Spell Casting (Alchemy) Working

### The Problem

Casting targeted spells (like Low/High Alchemy) on inventory items requires a **two-step action flow** that mirrors how the game's own menu system works. Simply setting `targetMode` and firing TGT_HELD doesn't work.

### The Two-Step Flow

The game's spell casting works via:
1. **TGT_BUTTON (action 274):** Selects the spell. This is a client-side-only action — no packet is sent. It sets `targetMode=1`, `targetComId=spellComId`, and `targetMask` (which determines valid target types). For alchemy, `targetMask=16` (inventory items), which also switches to the inventory tab.
2. **TGT_HELD (action 563):** Casts the selected spell on an inventory item. Sends `OPHELDT` packet with `(packId, slot, inventoryComId, spellComId)`.

### Why Setting targetMode Directly Didn't Work

Our first approach set `c.targetMode = 1` and `c.targetComId` manually, then fired TGT_HELD. The packet was sent but the server silently rejected it. The TGT_BUTTON action (274) must be dispatched via `doAction()` first — it does more than just set flags (it also sets `targetOp`, `targetMask`, clears `useMode`, and triggers UI state changes that the game loop relies on).

### Key Gotcha: paramA is Pack ID, Not Runtime ID

The menu system uses `ObjType.list(linkObjType[slot] - 1)` to get the item, and sets `paramA = obj.id` (the pack/server ID). The `linkObjType` array stores **runtime IDs** (server ID + 1). So `paramA` must be `linkObjType[slot] - 1`.

### Finding Spell Component IDs

Spell component IDs can be discovered at runtime by iterating `IfType.list` and checking for `targetVerb`/`targetBase`:
```javascript
const IfType = c.chatInterface.constructor;
for (let id = 1150; id < 1200; id++) {
    const com = IfType.list[id];
    if (com && com.targetBase) {
        console.log(id, com.targetBase, com.targetMask);
    }
}
```

Key alchemy IDs:
- **Low Level Alchemy:** component 1162, targetMask 16
- **High Level Alchemy:** component 1178, targetMask 16

### Final Working Implementation

```javascript
castSpellOnItem(spellComId, objId, slot, comId = 3214) {
    // Step 1: Select the spell (client-side only)
    c.menuAction[0] = 274; // TGT_BUTTON
    c.menuParamA[0] = 0;
    c.menuParamB[0] = 0;
    c.menuParamC[0] = spellComId;
    c.doAction(0);
    // Step 2: Cast on inventory item (sends OPHELDT packet)
    c.menuAction[0] = 563; // TGT_HELD
    c.menuParamA[0] = objId - 1; // pack ID
    c.menuParamB[0] = slot;
    c.menuParamC[0] = comId;
    c.doAction(0);
}
```

Both steps execute in the same tick — no delay needed between them.

## How We Fixed Invisible Inventory on rn04.rs

### The Problem

After switching the bot client from rsleague.com to play.rn04.rs, the client connected and loaded fine, but **inventory items were completely invisible**. The inventory panel showed nothing, even though the character was logged in and could interact with NPCs.

### How We Found It

We downloaded rn04's minified client from `https://play.rn04.rs/client/client.js` and compared the `UPDATE_INV_FULL` (opcode 28) packet handler against our source code.

**Technique:** Search for the opcode dispatch pattern. In the rn04 minified client, the server packet handler is a series of `if/else` blocks keyed on the opcode number. Find opcode 28, then trace the packet reads.

To identify minified method names, we mapped them by behavior:
| rn04 minified | Our Client | Operation |
|---|---|---|
| `qa()` | `g2()` | Read uint16 (2 bytes) |
| `oa()` | `g1()` | Read uint8 (1 byte) |
| `ta()` | `g4()` | Read int32 (4 bytes) |
| `ra()` | `g2b()` | Read int16 (2 bytes, signed) |
| `xa()` | `gjstr()` | Read null-terminated string |

### The Root Cause

In the `UPDATE_INV_FULL` handler (opcode 28), rn04's server sends the inventory item count as a **2-byte uint16**, but our client read it as a **1-byte uint8**:

```typescript
// Our client (WRONG for rn04):
const size: number = this.in.g1();  // reads 1 byte

// rn04 client (CORRECT):
const size = this.in.g2();  // reads 2 bytes
```

This 1-byte misalignment corrupted ALL subsequent item data. Every `objType` and `count` value was garbage, causing the inventory to appear empty.

### The Fix

`src/client/Client.ts` line ~6509: change `this.in.g1()` to `this.in.g2()`.

### Verification Method

Everything else in the protocol is identical between the two clients:
- ServerProtSizes array: byte-for-byte identical (255 entries)
- All 70 opcode numbers: identical
- `UPDATE_INV_PARTIAL` (opcode 170), `UPDATE_INV_STOP_TRANSMIT` (opcode 168), `IF_SETOBJECT` (opcode 222): identical structure
- ISAAC cipher pattern: identical
- Login sequence: identical (CLIENT_VERSION 254, same handshake)
- RSA keys: identical (same modulus and exponent)

### Lesson

When connecting to a different server that uses a custom client, always compare the packet handlers for any reads that might differ in size (g1 vs g2, g2 vs g4). A single byte difference causes cascading corruption of all subsequent fields in the packet, which manifests as "missing" data rather than obvious errors.

## How We Discovered Zero-Delay Fletching (Burst Fletch)

### The Discovery

By reading the server-side content scripts at `~/Projects/content/scripts/skill_fletching/`, we found that **fletching has zero `p_delay` calls**. Every other crafting skill uses `p_delay` (cooking: 1 tick, smithing: 5 ticks, spinning: 4 ticks), but fletching completes instantly.

The key file is `scripts/skill_fletching/scripts/cut_logs.rs2`. The flow is:
1. `[opheldu,knife]` trigger → opens `~multiobj2()` dialog → `p_pausebutton` (suspends script, but does NOT set `player.delayed`)
2. Player clicks longbow button → `IF_BUTTON` resumes the suspended script
3. Script runs: `inv_del(inv, $log, 1)` + `stat_advance(fletching, $xp)` + `inv_add(inv, $product, 1)` → **done, no delay**

### Server Rate Limits

The server processes up to **5 USER_EVENTs per tick** (defined in `ClientGameProtCategory.ts`). Each fletch cycle requires 2 USER_EVENTs (OPHELDU + IF_BUTTON), so the max is **~2.5 fletches per 600ms tick**.

### The Burst Approach

Since `player.delayed` is never set, we can send ALL fletch commands at once:
```javascript
for (const logSlot of logSlots) {
    bot.useItemOnItem(KNIFE, knifeSlot, YEW_LOG, logSlot);
    bot.clickButton(LONGBOW_BTN);
}
```

The server processes them in order: OPHELDU→IF_BUTTON→OPHELDU→IF_BUTTON→... across multiple ticks, 5 events per tick.

**Result:** 27 yew logs fletched in **~7.2 seconds** (vs 54 seconds with the old 1-per-2s-tick method).

### Critical Gotcha: Idle Timer

When sending raw commands outside of `startScript()`, the client's idle timer (`c.idleTimer`) is not reset, causing auto-disconnect after a few seconds. Always either:
- Use `startScript()` (which resets idle timer each iteration), or
- Manually reset: `c.idleTimer = performance.now()` in a keepalive interval

We initially thought the disconnects were from ISAAC cipher desync (too many packets). They were actually from idle timeout. The burst of 54 packets (27 × 2) is fine — the server buffers and processes them across ticks without any cipher issues.

### Theoretical Max Speed

| Approach | Time for 27 logs | Notes |
|----------|-----------------|-------|
| Old script (1 per 2s tick) | ~54s | Pipeline: clickButton + queue next useItemOnItem |
| Burst (all at once) | ~7.2s | Limited by 5 USER_EVENTs/tick server cap |
| Theoretical min | ~6.6s | 27 logs ÷ 2.5/tick × 0.6s/tick |

## How We Detect Combat State (faceEntity)

### The Problem

When writing a combat bot, we need to know if the player is already fighting something so we don't spam attack commands every tick. The initial script used `localPlayer.targetEntity` — but **that property doesn't exist** on ClientPlayer. It silently returned `undefined`, which is falsy, so the "already in combat" check never triggered and the bot re-attacked every 2 seconds (interrupting itself).

### How We Found the Right Field

We enumerated all properties on `localPlayer` that contained "target", "combat", "interact", or "anim":
```javascript
Object.keys(lp).filter(k => k.toLowerCase().includes('target') || k.toLowerCase().includes('combat'))
```
This returned `combatCycle` and `combatLevel` — no `targetEntity`. We then looked for numeric fields with non-zero values during combat and found `faceEntity`.

### The Solution

`localPlayer.faceEntity` tracks what the player is facing/interacting with:
- `-1` → idle (not in combat)
- `>= 0` → the NPC slot the player is engaged with

```javascript
if (lp.faceEntity !== -1) return; // Already fighting, skip
```

### Also Useful
- `lp.combatCycle` — the game cycle when combat last occurred. Compare with `c.loopCycle` to check recency.
- `lp.primaryAnim` — the current animation ID. Attack animations are positive numbers; idle is `-1`.

### Current HP
- `c.statEffectiveLevel[3]` — current (boosted/drained) Hitpoints level
- `c.statBaseLevel[3]` — base Hitpoints level (max HP)
- Index 3 = Hitpoints in the stat arrays (0=Atk 1=Def 2=Str 3=HP ...)
