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
