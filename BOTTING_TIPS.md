# Botting Tips

Guide for Claude Code instances to write bot scripts for the Lost City client.

## Architecture Overview

This is a modified [LostCityRS/Client-TS](https://github.com/LostCityRS/Client-TS) (branch `254`) with a **Bot API** injected. The client runs in Chrome, connects to a game server via WebSocket, and exposes game internals through `window.bot`. Claude Code controls it via the **Chrome DevTools MCP server** using `evaluate_script`.

```
Chrome (game client) <--WebSocket--> Game Server (rsleague.com)
       ^
       | evaluate_script
       v
Claude Code (via Chrome DevTools MCP)
```

## Connecting to a Server

The client connects to the game server in two places that need to be changed:

1. **WebSocket (game connection):** `src/client/Client.ts` line ~1962
   ```typescript
   this.stream = new ClientStream(await ClientStream.openSocket('rsleague.com', true));
   ```

2. **WebSocket (on-demand/asset streaming):** `src/io/OnDemand.ts` line ~663
   ```typescript
   this.stream = new ClientStream(await ClientStream.openSocket('rsleague.com', true));
   ```

3. **HTTP resources** (CRC checksums, game caches) are fetched via relative URLs like `/crc`, `/title`, etc. The local proxy server (`serve.cjs`) forwards these to the game server. Change the `UPSTREAM` constant in `serve.cjs`:
   ```javascript
   const UPSTREAM = 'rsleague.com';
   ```

4. **RSA keys** are set in `bundle.ts` lines 11-12. The default keys match the original 2004scape/Lost City server. If a server uses custom keys, extract them from its client (search the minified JS for `BigInt("...numbers...")` near the login code).

5. **SECURE_ORIGIN check** is disabled in `Client.ts` to allow running from localhost.

After changes, rebuild: `bun run build:dev`

## Building and Running

```bash
# Install dependencies
bun install

# Build (dev mode, no minification - easier to debug)
bun run build:dev

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
