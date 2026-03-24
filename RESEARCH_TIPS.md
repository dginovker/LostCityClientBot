# Research Tips

How we figured out the hard parts of building this bot. Guide for future Claude Code instances.

## Finding the Source Code

The game at rsleague.com is a **Lost City** RuneScape private server. The code is open source:

- **Server (engine):** https://github.com/LostCityRS/Engine-TS (branch `254`)
- **Client (TypeScript):** https://github.com/LostCityRS/Client-TS (branch `254`)
- **Game content (scripts/configs):** https://github.com/LostCityRS/Content (branch `254`)
- **Legacy org:** https://github.com/2004Scape/Server (redirects to LostCityRS)

The `254` branch corresponds to the 2004-era RuneScape 2 engine revision.

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
