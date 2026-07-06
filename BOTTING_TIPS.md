# Botting Tips

Guide for Claude Code instances to write bot scripts for the Lost City client.

## Architecture Overview

This is a modified [LostCityRS/Client-TS](https://github.com/LostCityRS/Client-TS) (branch `254`) with a **Bot API** injected. The client runs in Chrome, connects to a game server via WebSocket, and exposes game internals through `window.bot`. Claude Code controls it via the **Chrome DevTools MCP server** using `evaluate_script`.

```
Chrome (game client) <--WebSocket--> Game Server (play.rn04.rs)
       ^
       | evaluate_script
       v
Claude Code (via Chrome DevTools MCP)
```

## Connecting to a Server

**Currently pointed at `w1.rs2b2t.com` (revision 274).** The client connects in these places:

1. **WebSocket (game connection):** `src/client/Client.ts`
   ```typescript
   this.stream = new ClientStream(await ClientStream.openSocket('w1.rs2b2t.com', true));
   ```
   Stock upstream uses `window.location.host`; we hardcode the host because we self-host the page (localhost / GitHub Pages) but the game socket must go to the real server.

2. **On-demand/asset streaming (274 Web Worker):** `src/io/OnDemand.ts` — the worker init `postMessage` carries the host:
   ```typescript
   host: 'w1.rs2b2t.com',
   secured: true,
   ```
   (254 opened a socket directly here; 274 moved streaming into `OnDemandWorker.ts`, which does `openSocket(this.host, this.secured)` with the values passed in.)

3. **HTTP cache archives** (`/crc`, `/title`, `/config`, …) — the local proxy (`serve.cjs`) forwards them to the game server. Set `UPSTREAM`:
   ```javascript
   const UPSTREAM = 'w1.rs2b2t.com';
   ```
   The client requests `<archive><crc>` where crc is a **signed** int, so the suffix starts with `-`, `?`, **or a digit** — `serve.cjs`'s cache-file match handles all three (a digit-suffix bug would 404 positive-CRC archives). It proxies cache names BEFORE local lookup so stale `out/` files never mask fresh data.

4. **RSA keys** (`bundle.ts`): rs2b2t uses **custom** keys — `LOGIN_RSAE`=`65537`, `LOGIN_RSAN`=the 309-digit modulus. See RESEARCH_TIPS "How We Found the RSA Keys".

5. **SECURE_ORIGIN** defaults to `'false'` in `bundle.ts`, so its host check in `Client.ts` is already a no-op (no need to disable it).

### rev 254 vs 274

rn04.rs was 254 (config swap sufficed, needed only a `UPDATE_INV_FULL` 2-byte tweak). rs2b2t is **274** — a different opcode table + custom RSA, so we re-based `src/` onto the LostCityRS `274` branch rather than patching packets. See RESEARCH_TIPS "Switching to a Different-Revision Server". Do NOT reintroduce the rn04 `g2()` inventory hack — 274 has its own (correct) handlers.

### GitHub Pages (static, no proxy) deploy

The `gh-pages` branch serves the flattened `out/` at `dginovker.github.io/LostCityClientBot/`. With no proxy, cache archives are committed with **clean names** (`crc`, `title`, `config`, …) and the client adapts:
- `util/JsUtil.ts` `downloadUrl`/`downloadText` strip a leading `/` so fetches are **relative** to the page (works in the repo subdirectory), and `downloadUrl` throws on non-ok.
- `Client.getJagFile` requests `<archive><crc>` first (proxy path / cache-buster) and **falls back** to the un-suffixed `<archive>` (the committed static file) on 404.
- The game/on-demand WebSockets go straight to `wss://w1.rs2b2t.com` (works cross-origin; rs2b2t does NOT send CORS headers for HTTP caches, which is why caches must be committed rather than fetched cross-origin).

To re-deploy: rebuild, fetch fresh clean-named caches into `out/` (`for f in crc title config interface media textures wordenc sounds versionlist; do curl -s "https://w1.rs2b2t.com/$f" -o out/$f; done`), then mirror `out/` to the `gh-pages` branch root. Re-fetch caches whenever rs2b2t updates (stale CRCs fail the login handshake). 274 uses the WebSocket worker, so **no `ondemand.zip`** is needed.

After changes, rebuild: `bun bundle.ts dev`

## Building and Running

```bash
# Install dependencies
bun install

# Build (dev mode, no minification - easier to debug)
bun bundle.ts dev

# Start the proxy server
node serve.cjs

# Open http://localhost:8080 in Chrome
```

## Bot API Reference (`window.bot`)

### Read State
| Method | Returns | Description |
|--------|---------|-------------|
| `isLoggedIn()` | `boolean` | Whether the player is in-game |
| `getPlayer()` | `{name, x, z, level}` | Local player info |
| `getNpcs()` | `NpcInfo[]` | All nearby NPCs with slot, typeId, name, x, z, health |
| `findNpc(name)` | `NpcInfo[]` | Filter NPCs by name (case-insensitive partial match) |
| `getMessages(n)` | `Message[]` | Last n chat/game messages |
| `getStats()` | `{StatName: {level, xp}}` | All skill stats |
| `getAbsolutePosition()` | `{x, z, level}` | Get player's absolute world coordinates (not local scene coords) |
| `dismissDialog()` | `boolean` | Dismiss "Click here to continue" dialogs. Returns true if a dialog was dismissed |

### Actions
| Method | Returns | Description |
|--------|---------|-------------|
| `login(user, pass)` | `void` | Auto-login with credentials |
| `pickpocket(npcSlot)` | `boolean` | Pickpocket NPC by slot index (sends OPNPC3) |
| `pickpocketByName(name)` | `boolean` | Pickpocket first NPC matching name |
| `interactNpc(npcSlot, option)` | `boolean` | Interact with NPC using any option (e.g. 'attack', 'talk', 'pickpocket'). Uses the game's own menu system for correct opcodes and priority flags. |
| `attackNpc(npcSlot)` | `boolean` | Shorthand for `interactNpc(slot, 'attack')` |
| `clickButton(comId)` | `boolean` | Click a normal interface button (buttontype=normal) |
| `selectButton(comId)` | `boolean` | Click a select/toggle button (buttontype=select) - used for combat styles, autocast toggle |
| `setTab(n)` | `void` | Switch sidebar tab (0=combat, 1=skills, 2=quests, 3=inventory, 4=equipment, 5=prayer, 6=magic) |
| `walk(x, z)` | `boolean` | Walk to a tile coordinate |
| `castSpellOnItem(spellComId, objId, slot)` | `boolean` | Cast a targeted spell on an inventory item (e.g. alchemy) |

### Advanced
| Property | Description |
|----------|-------------|
| `_client` | Direct reference to the Client instance. Use `(client as any).propertyName` to access any internal state |

### Reading Inventory
```javascript
const c = bot._client;
const IfType = c.chatInterface.constructor; // Access IfType class
const inv = IfType.list[3214]; // Inventory interface component
for (let i = 0; i < inv.linkObjType.length; i++) {
    if (inv.linkObjType[i] > 0) {
        console.log('Slot', i, 'ItemID:', inv.linkObjType[i], 'Count:', inv.linkObjNumber[i]);
    }
}
// Note: item IDs may be offset by 1 from obj.pack IDs
```

## Local Server Testing

The following features require a local Lost City server (Engine-TS) where your account has admin privileges. They do NOT work on rsleague.com or other public servers.

### Admin Commands

`bot.sendCommand(cmd)` sends a `::` admin command (without the `::` prefix). `bot.tele(absX, absZ)` is a shorthand for `::tele` with automatic coordinate conversion.

```javascript
bot.sendCommand('spawnevent genie');  // spawn a random event NPC
bot.sendCommand('setvar tutorial 1000');  // complete tutorial
bot.tele(3222, 3218);  // teleport to Lumbridge
```

### Skipping Tutorial Island

New accounts on a local server start on Tutorial Island. To skip:
```javascript
bot.tele(3222, 3218);  // teleport to Lumbridge
bot.sendCommand('setvar tutorial 1000');  // mark tutorial complete
```

## Writing a New Script

### Basic Pattern
```javascript
// In Chrome DevTools MCP evaluate_script:
() => {
    if (window._botInterval) clearInterval(window._botInterval);

    window._botInterval = setInterval(() => {
        if (!window.bot.isLoggedIn()) return;
        if (window.bot.dismissDialog()) return; // always handle dialogs first

        // Your bot logic here
        window.bot.pickpocketByName('paladin');
    }, 2000);

    return 'Script started';
}
```

### Key Patterns

**Always dismiss dialogs first** - level ups, quest dialogs, etc. block all actions:
```javascript
if (window.bot.dismissDialog()) return;
```

**Finding NPCs by type ID** - more reliable than name matching:
```javascript
const npcs = window.bot.getNpcs().filter(n => n.typeId === 20); // 20 = Paladin
```

**Sending custom packets** - access the client directly:
```javascript
const c = window.bot._client;
c.out.pIsaac(69);  // OPNPC3 opcode
c.out.p2(npcSlot);  // NPC slot
```

**WARNING:** Raw `pIsaac()` calls desync the ISAAC cipher if you send packets the server doesn't expect. This causes disconnects. Prefer `interactNpc()`, `clickButton()`, and `selectButton()` which use the game's own `doAction()` system and keep ISAAC in sync.

**Interacting with NPCs** - use `interactNpc` instead of raw opcodes:
```javascript
// This handles correct opcodes, priority flags, and pathfinding automatically
bot.interactNpc(npcSlot, 'attack');
bot.interactNpc(npcSlot, 'pickpocket');
bot.interactNpc(npcSlot, 'talk');
```

**Setting up autocast spells** - requires a multi-step interface flow:
```javascript
bot.setTab(0);              // Combat tab
bot.clickButton(353);       // "Choose Spell" button
// wait 1 tick
bot.clickButton(1834);      // Wind Bolt (ssb4 in staff_spells interface)
// wait 1 tick
bot.selectButton(349);      // Autocast toggle (auto_toggle in combat_staff_2)
```
Interface component IDs can be found in the Content repo: https://github.com/LostCityRS/Content (branch 254), file `pack/interface.pack`.

**NPC Attack option position varies** - "Attack" can be on op[0] (OPNPC1) or op[1] (OPNPC2) depending on the NPC. Lesser demons have Attack on op[1]. `interactNpc('attack')` handles this automatically.

**Priority flag** - when NPC level > player level, the game adds +2000 to the menu action value. `interactNpc()` handles this automatically via `addNpcOptions()`.

**Checking if stunned/delayed** - look for the stun message:
```javascript
const msgs = window.bot.getMessages(3);
const stunned = msgs.some(m => m.text?.includes('stunned'));
```

## Adding New Bot API Methods

Edit `src/bot/BotApi.ts`. The `client` variable is the Client instance, accessed via `(client as any).propertyName` to bypass TypeScript private access.

Key internal properties:
- `npc[slot]` - NPC array (ClientNpc objects)
- `npcCount`, `npcIds` - active NPC tracking
- `localPlayer` - the player entity
- `out` - outgoing Packet buffer (use `.pIsaac(opcode)`, `.p1()`, `.p2()`, `.p4()`)
- `stream` - WebSocket connection
- `chatComId` - current chat dialog interface ID (-1 = none)
- `chatText[]`, `chatType[]` - chat history
- `ingame` - logged in flag
- `loginUser`, `loginPass`, `loginscreen` - login state

After editing, rebuild with `bun run build:dev`. The proxy server auto-serves the new build.

## Client Packet Opcodes (Common)

| Opcode | Name | Payload | Description |
|--------|------|---------|-------------|
| 69 | OPNPC3 | p2(npcSlot) | 3rd NPC option (usually Pickpocket) |
| 143 | OPNPC1 | p2(npcSlot) | 1st NPC option (usually Attack) |
| 195 | OPNPC2 | p2(npcSlot) | 2nd NPC option |
| 146 | RESUME_PAUSEBUTTON | p2(comId) | Dismiss dialog |
| 6 | MOVE_GAMECLICK | variable | Walk to tile |
| 239 | NO_TIMEOUT | (none) | Keep-alive |

## Banking

The bank interface uses these component IDs:
- **Bank modal ID:** 5292 (check `c.mainModalId === 5292`)
- **Bank contents:** 5382 (`bank:inv`, 240 slots) - iop: Withdraw 1/5/10/All/X
- **Player inventory in bank:** 2006 (`bank_side:inv`, 28 slots) - iop: Deposit 1/5/10/All/X
- **Bank booth locId:** 2213 (usable booths, interact with `'use-quickly'`)

### Banking API
```javascript
bot.isBankOpen()                    // Check if bank modal is open
bot.getBankItems()                  // Get {slot, objId, count}[] of all bank items
bot.depositAll(objId, slot)         // Deposit all of item (uses component 2006)
bot.withdrawOne(objId, slot)        // Withdraw 1 item (uses component 5382)
bot.withdrawAll(objId, slot)        // Withdraw all of item (uses component 5382)
```

### Banking Pattern (fast)
The old state-machine approach (deposit one item per 2s tick) is very slow. Instead, use fast polling + batch operations:

**Key optimizations:**
1. **Don't deposit tools** — skip items you'll need next (e.g., knife). Saves a withdraw step entirely.
2. **Batch deposits** — send all `depositAll` calls in a single loop with no `return` between them. All packets are sent at once.
3. **Fast-poll for bank open** — use a 100ms setInterval to detect when the bank modal opens, instead of waiting for the next 2s script tick.
4. **Delay between deposit and withdraw** — after depositing, wait 600ms (1 server tick) before calling `getBankItems()` + `withdrawAll()`. Otherwise the bank contents are stale and you'll miss items.

```javascript
// Fast-poll for bank to open, then batch deposit + delayed withdraw
const pollId = setInterval(() => {
  if (c.mainModalId !== 5292) return;
  clearInterval(pollId);
  // Deposit everything except the knife
  const bankInv = IfType.list[2006];
  for (let i = 0; i < bankInv.linkObjType.length; i++) {
    if (bankInv.linkObjType[i] > 0 && bankInv.linkObjType[i] !== KNIFE)
      bot.depositAll(bankInv.linkObjType[i], i);
  }
  // Wait for server to update, then withdraw
  setTimeout(() => {
    const logs = bot.getBankItems().find(i => i.objId === YEW_LOG);
    if (logs) bot.withdrawAll(logs.objId, logs.slot);
    setTimeout(() => bot.closeModal(), 600);
  }, 600);
}, 100);
```

## Fletching / Crafting Interfaces

When using an item on another (e.g. knife on willow log), the game opens a chat-based dialog (chatComId) with options. For fletching:
- **Fletching interface chatComId:** 139
- **Willow Short Bow button:** 144
- **Willow Long Bow button:** 145

### Protecting chat dialogs from auto-dismiss
`startScript()` auto-calls `dismissDialog()` each tick, which will dismiss crafting interfaces. To protect a specific dialog:
```javascript
window._botProtectChatComId = 139; // Protect fletching interface
// Level-up dialogs (different chatComId) will still be auto-dismissed
// Set to 0 when leaving the fletching state
```

### Efficiency: burst fletching (zero server delay)
Fletching has **zero `p_delay`** on the server. You can send ALL fletch commands at once:
```javascript
// Burst: fletch entire inventory in ~7 seconds instead of 54
for (const logSlot of logSlots) {
  bot.useItemOnItem(KNIFE, knifeSlot, YEW_LOG, logSlot);
  bot.clickButton(145);  // Longbow option
}
```
The server processes 5 USER_EVENTs/tick (2 per fletch = ~2.5 fletches/tick). 27 logs completes in ~7s.

**Important:** Use a 15-second timeout to re-send remaining commands in case a level-up dialog interrupts the burst mid-way. See the `fletch_longbow` script for the complete implementation.

### Legacy: pipeline actions (slower, pre-burst approach)
After clicking the crafting option, immediately queue the next use-item-on-item to save a tick:
```javascript
if (c.chatComId === 139) {
  bot.clickButton(145);  // Select longbow
  bot.useItemOnItem(KNIFE, knifeSlot, WILLOW_LOG, logSlot);  // Queue next
  return;
}
```

## Casting Spells on Items

Use `bot.castSpellOnItem(spellComId, objId, slot)` to cast any targeted spell on an inventory item.

### Alchemy Example
```javascript
const LOW_ALCH = 1162;
const HIGH_ALCH = 1178;
const FIRE_RUNE = 555; // runtime ID from linkObjType
const magicLvl = bot._client.statBaseLevel[6]; // index 6 = Magic
const spell = magicLvl >= 55 ? HIGH_ALCH : LOW_ALCH;
bot.setTab(6); // open magic tab
bot.castSpellOnItem(spell, FIRE_RUNE, fireSlot);
```

### Spell Component IDs (Normal Spellbook)

Found by iterating `IfType.list[1150..1200]` checking for `targetBase`:

| Spell | Component ID | targetMask | Notes |
|-------|-------------|------------|-------|
| Low Level Alchemy | 1162 | 16 (inventory) | Requires 21 Magic, 1 nature + 3 fire |
| High Level Alchemy | 1178 | 16 (inventory) | Requires 55 Magic, 1 nature + 5 fire |
| Superheat Item | 1173 | 16 (inventory) | |
| Enchant Lvl-1 Jewelry | 1155 | 16 (inventory) | |
| Enchant Lvl-2 Jewelry | 1165 | 16 (inventory) | |
| Enchant Lvl-3 Jewelry | 1176 | 16 (inventory) | |
| Telekinetic Grab | 1168 | 1 (ground items) | |

### How It Works Under the Hood

`castSpellOnItem` dispatches two actions in sequence:
1. **TGT_BUTTON (274)** with `paramC = spellComId` — selects the spell (client-side only, no packet)
2. **TGT_HELD (563)** with `paramA = objId - 1` (pack ID), `paramB = slot`, `paramC = 3214` — sends OPHELDT packet

Both steps must go through `doAction()`. Setting `targetMode`/`targetComId` directly doesn't work — the TGT_BUTTON action sets additional state the game loop needs.

### Reading Magic Level
```javascript
const magicLvl = bot._client.statBaseLevel[6]; // base level
const magicXP = bot._client.statXP[6];         // current XP
// Skill indices: 0=Atk 1=Def 2=Str 3=HP 4=Ranged 5=Prayer 6=Magic ...
```

## Common Item IDs (Runtime / linkObjType)

| Item | Runtime ID | obj.pack ID |
|------|-----------|-------------|
| Knife | 947 | 946 |
| Willow logs | 1520 | 1519 |
| Willow longbow (u) | 59 | 58 |
| Bones | 527 | 526 |
| Flax | 1780 | 1779 |
| Bowstring | 1778 | 1777 |
| Feather | 315 | 314 |
| Arrow shaft | 53 | 52 |
| Mysterious box | 3063 | 3062 |
| Yew logs | 1516 | 1515 |
| Yew longbow (u) | 67 | 66 |
| Fire rune | 555 | 554 |
| Nature rune | 562 | 561 |
| Coins | 996 | 995 |

## Shop Mechanics

### Key discovery: shops never drop below base stock
On this server, `buy10` from a shop with base stock of 10 will give you 10 items **and the stock stays at 10**. The stock never decreases below its base level. This means:
- If base stock is 1 (e.g., Herquin's uncut sapphires), `buy10` only gives 1
- If you **sell items to boost stock above 10**, then `buy10` gives 10 every time

### Strategy: seed the shop
For shops with low base stock, first sell items to the shop to boost stock, then use `buy10` for fast bulk buying. Example for Herquin's gems:
1. First cycle: buy 1 at a time (slow) until you have a full inventory
2. Cut them all, sell the cut gems back
3. Also sell ~10 uncut gems to boost the uncut stock from 1 to ~11
4. Now `buy10` works: 3x `buy10` fills 26 free slots instantly (3 commands vs 26)

### Selling to shops
Sell uses component 3823 (shop_side:inv). `sell10` (INV_BUTTON4 = 331) sells by **item type**, not just the clicked slot — one command sells up to 10 of that item from anywhere in your inventory.
```javascript
c.menuAction[0] = 331; // INV_BUTTON4 = Sell 10
c.menuParamA[0] = objId - 1; // pack ID
c.menuParamB[0] = anySlotWithItem;
c.menuParamC[0] = 3823; // shop_side:inv
c.doAction(0);
```

### Gem cutting
Gem cutting (chisel on uncut gem) has **zero p_delay and zero dialog** but DOES play an `anim()`. Unlike fletching burst, sending all OPHELDUs at once stalls after ~10. **Batch 10 per tick targeting bottom-up slots** works reliably. Sapphires have 100% success rate.

## Random Events: Mysterious Box

The Mysterious Box random event is handled automatically by `startScript()`. When boxes appear in inventory, the bot:
1. Opens each box (`bot.openBox()`)
2. Reads the question and shape models from the interface (modal 6554)
3. Determines shape colors from `ObjType.recol_d` data:
   - `recol_d[0] = 1703` → Red
   - `recol_d[0] = 43429` → Blue
   - `recol_d[0] = 8749` → Yellow
4. Matches the answer to the question and clicks the correct button
5. Repeats until all boxes are cleared

### Interface Component IDs
- Modal: 6554
- Question text: 6561
- Shape models: 6555, 6557, 6559 (type 6, model1Type=4, model1Id = obj pack ID)
- Answer buttons: 6562, 6563, 6564
- Answer labels: 6565, 6566, 6567

### Manual Usage
```javascript
bot.solveBox();   // Solve the currently open box
bot.hasBoxes();   // Check if inventory has boxes
bot.openBox();    // Click first box in inventory
```

## Bear Killer + Looter + Banker Script

A combat loop script that kills bears, loots all drops, banks when inventory is full, and repeats. Includes HP safety (AFKs when below threshold).

### Key Coordinates
- **Bear area:** (2700, 3332) — East Ardougne, north of the south bank
- **Bank:** Ardy south bank booths at (2656, 3286), locId 2213, option `'use-quickly'`

### Combat Detection
Use `localPlayer.faceEntity` to detect if the player is already in combat:
- `faceEntity === -1` → idle, can attack a new target
- `faceEntity !== -1` → already fighting, skip attack

**Do NOT use `targetEntity`** — that property doesn't exist. Early versions of the script used it and silently re-attacked every tick.

### State Machine Pattern
The script uses a state machine with states: `killing` → `walking_to_bank` → `banking` → `walking_to_bears` → `killing`.

```javascript
// State transitions:
// killing: attack bears, loot ground items. If invCount >= 28 → walking_to_bank
// walking_to_bank: walkTo(BANK_POS). If isNear(bank) → banking (interact with booth)
// banking: fast-poll for bank modal (mainModalId === 5292), batch depositAll, closeModal → walking_to_bears
// walking_to_bears: walkTo(BEAR_AREA). If isNear(bears) → killing
```

### HP Safety
```javascript
const currentHP = c.statEffectiveLevel[3]; // index 3 = Hitpoints
if (currentHP < HP_THRESHOLD) return; // AFK, HP regens naturally
```
Note: `statEffectiveLevel[3]` is current HP, `statBaseLevel[3]` is max HP.

### Looting Priority
Loot ground items **before** attacking new bears, but only when not mid-combat (`faceEntity === -1`). This prevents interrupting fights to pick up items.

### Bear Details
- **TypeId:** 105
- **Drop table:** Diverse — herbs, ores, bars, bones, weapons, food, gems, armor. Many drops are stackable, so inventory fills slowly by unique types.
- **Combat level:** Low enough that a level ~40 character can AFK them safely.
