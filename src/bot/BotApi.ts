// Bot API - exposes game internals to window.bot for Chrome DevTools MCP control

import { Client } from '#/client/Client.js';
import { ClientProt } from '#/io/ClientProt.js';
import LocType from '#/config/LocType.js';

interface NpcInfo {
    slot: number;
    typeId: number;
    name: string | null;
    x: number;
    z: number;
    health: number;
    totalHealth: number;
}

interface PlayerInfo {
    name: string | null;
    x: number;
    z: number;
    level: number;
}

export function initBotApi(client: Client): void {
    const c = client as any;

    const bot = {
        // Internal reference for advanced use
        _client: c,

        // ===== Common Handlers (used by startScript) =====

        /** Dismiss any "Click here to continue" chat dialog (level ups, quest text, etc.) */
        dismissDialog(): boolean {
            if (c.chatComId !== -1) {
                c.out.pIsaac(ClientProt.RESUME_PAUSEBUTTON);
                c.out.p2(c.chatComId);
                c.resumedPauseButton = true;
                return true;
            }
            return false;
        },

        /** Close any main modal overlay (Welcome to RuneScape, quest journals, etc.) */
        closeModal(): boolean {
            if (c.mainModalId !== -1) {
                c.out.pIsaac(ClientProt.CLOSE_MODAL);
                if (c.sideModalId !== -1) {
                    c.sideModalId = -1;
                    c.redrawSidebar = true;
                    c.resumedPauseButton = false;
                    c.redrawSideicons = true;
                }
                if (c.chatComId !== -1) {
                    c.chatComId = -1;
                    c.redrawChatback = true;
                    c.resumedPauseButton = false;
                }
                c.mainModalId = -1;
                return true;
            }
            return false;
        },

        /** Handle all blocking UI: dialogs, modals. Returns true if something was blocking. */
        handleBlockingUI(): boolean {
            if (bot.dismissDialog()) return true;
            if (bot.closeModal()) return true;
            return false;
        },

        // ===== Read State =====

        /** Check if logged in */
        isLoggedIn(): boolean {
            return c.ingame === true;
        },

        /** Get all nearby NPCs */
        getNpcs(): NpcInfo[] {
            const npcs: NpcInfo[] = [];
            for (let i = 0; i < c.npcCount; i++) {
                const idx = c.npcIds[i];
                const npc = c.npc[idx];
                if (npc && npc.type) {
                    npcs.push({
                        slot: idx,
                        typeId: npc.type.id,
                        name: npc.type.name,
                        x: npc.routeX[0],
                        z: npc.routeZ[0],
                        health: npc.health,
                        totalHealth: npc.totalHealth,
                    });
                }
            }
            return npcs;
        },

        /** Get player position and state */
        getPlayer(): PlayerInfo | null {
            const lp = c.localPlayer;
            if (!lp) return null;
            return {
                name: lp.name,
                x: lp.routeX[0],
                z: lp.routeZ[0],
                level: lp.combatLevel ?? 0,
            };
        },

        /** Get recent chat/game messages */
        getMessages(count: number = 10): { type: number; text: string | null; sender: string | null }[] {
            const msgs = [];
            for (let i = 0; i < count; i++) {
                const text = c.chatText[i];
                if (text !== null) {
                    msgs.push({
                        type: c.chatType[i],
                        text,
                        sender: c.chatUsername[i],
                    });
                }
            }
            return msgs;
        },

        /** Get all skill stats */
        getStats(): { [name: string]: { level: number; xp: number } } {
            const stats: { [name: string]: { level: number; xp: number } } = {};
            const names = [
                'Attack', 'Defence', 'Strength', 'Hitpoints', 'Ranged', 'Prayer',
                'Magic', 'Cooking', 'Woodcutting', 'Fletching', 'Fishing', 'Firemaking',
                'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility', 'Thieving',
                'Slayer', 'Farming', 'Runecraft'
            ];
            const levels = c.realLevel;
            const xps = c.experience;
            if (levels && xps) {
                for (let i = 0; i < names.length; i++) {
                    stats[names[i]] = { level: levels[i] ?? 0, xp: xps[i] ?? 0 };
                }
            }
            return stats;
        },

        // ===== Actions =====

        /** Pickpocket an NPC by slot (sends OPNPC3) */
        pickpocket(npcSlot: number): boolean {
            const npc = c.npc[npcSlot];
            const lp = c.localPlayer;
            if (!npc || !lp || !c.ingame) return false;

            c.tryMove(lp.routeX[0], lp.routeZ[0], npc.routeX[0], npc.routeZ[0], false, 1, 1, 0, 0, 0, 2);
            c.out.pIsaac(ClientProt.OPNPC3);
            c.out.p2(npcSlot);
            return true;
        },

        /** Interact with an NPC by building the real game menu and clicking the specified option.
         *  optionName is case-insensitive partial match (e.g. 'attack', 'pickpocket', 'talk').
         *  Uses the game's own addNpcOptions to get correct opcodes and priority flags. */
        interactNpc(npcSlot: number, optionName: string): boolean {
            const npc = c.npc[npcSlot];
            if (!npc || !npc.type || !c.ingame) return false;

            // Build the menu using the game's own logic
            const prevEntries = c.menuNumEntries;
            c.menuNumEntries = 0;
            c.addNpcOptions(npc.type, npcSlot, 0, 0);

            // Find the matching option
            const lower = optionName.toLowerCase();
            for (let i = 0; i < c.menuNumEntries; i++) {
                const opt: string | null = c.menuOption[i];
                if (opt && opt.toLowerCase().includes(lower)) {
                    c.doAction(i);
                    return true;
                }
            }

            // Restore if not found
            c.menuNumEntries = prevEntries;
            return false;
        },

        /** Shorthand: attack NPC by slot */
        attackNpc(npcSlot: number): boolean {
            return bot.interactNpc(npcSlot, 'attack');
        },

        /** Find nearby locations (trees, rocks, etc.) by name within a given radius.
         *  Scans wall, scene (centrepiece), decor, and ground decoration layers.
         *  Returns array of {name, locId, typecode, x, z} */
        findLocs(name: string, radius: number = 10): {name: string; locId: number; typecode: number; x: number; z: number}[] {
            if (!c.ingame || !c.world || !c.localPlayer) return [];
            const results: {name: string; locId: number; typecode: number; x: number; z: number}[] = [];
            const lower = name.toLowerCase();
            const px = c.localPlayer.routeX[0];
            const pz = c.localPlayer.routeZ[0];
            const level = c.minusedlevel;

            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const x = px + dx;
                    const z = pz + dz;
                    if (x < 0 || z < 0 || x >= 104 || z >= 104) continue;

                    // Check all location layers: wall, scene (centrepiece/trees), decor, ground decor
                    const typecodes = [
                        c.world.wallType(level, x, z),
                        c.world.sceneType(level, x, z),
                        c.world.decorType(level, z, x),  // note: z, x param order
                        c.world.gdType(level, x, z)
                    ];

                    for (const typecode of typecodes) {
                        if (!typecode) continue;
                        const locId = (typecode >> 14) & 0x7fff;
                        const locType = LocType.list(locId);
                        if (locType && locType.name && locType.name.toLowerCase() === lower) {
                            results.push({name: locType.name, locId, typecode, x, z});
                        }
                    }
                }
            }
            return results;
        },

        /** Interact with a location (tree, rock, etc.) using the game's action system.
         *  optionName is case-insensitive partial match (e.g. 'chop', 'mine', 'open'). */
        interactLoc(typecode: number, x: number, z: number, optionName: string): boolean {
            if (!c.ingame) return false;

            const locId = (typecode >> 14) & 0x7fff;
            const locType = LocType.list(locId);
            if (!locType || !locType.op) return false;

            const lower = optionName.toLowerCase();
            const locActions = [625, 721, 743, 357, 1071]; // OP_LOC1 through OP_LOC5
            for (let i = 0; i < 5; i++) {
                if (locType.op[i] && locType.op[i]!.toLowerCase().includes(lower)) {
                    c.menuAction[0] = locActions[i];
                    c.menuParamA[0] = typecode;
                    c.menuParamB[0] = x;
                    c.menuParamC[0] = z;
                    c.doAction(0);
                    return true;
                }
            }
            return false;
        },

        /** Buy items from an open shop interface.
         *  quantity: 1, 5, 10 (maps to INV_BUTTON2, INV_BUTTON3, INV_BUTTON4)
         *  itemSlot: the slot index of the item in the shop (0-based)
         *  shopComId: shop inventory component ID (default 3900 = shop_template:inv) */
        buyShopItem(itemSlot: number, quantity: 1 | 5 | 10, shopComId: number = 3900): boolean {
            if (!c.ingame || c.mainModalId === -1) return false;

            const IfType = c.chatInterface.constructor as any;
            const shopCom = IfType.list[shopComId];
            if (!shopCom || !shopCom.linkObjType) return false;

            const objId = shopCom.linkObjType[itemSlot];
            if (objId <= 0) return false;

            // Map quantity to MiniMenuAction: Buy 1=INV_BUTTON2(113), Buy 5=INV_BUTTON3(555), Buy 10=INV_BUTTON4(331)
            const actionMap: Record<number, number> = {1: 113, 5: 555, 10: 331};
            const action = actionMap[quantity];
            if (!action) return false;

            c.menuAction[0] = action;
            c.menuParamA[0] = objId - 1; // linkObjType is +1 from the server's obj ID
            c.menuParamB[0] = itemSlot;
            c.menuParamC[0] = shopComId;
            c.doAction(0);
            return true;
        },

        /** Get all items currently in a shop. Returns array of {slot, objId, count}. */
        getShopItems(shopComId: number = 3900): {slot: number; objId: number; count: number}[] {
            if (!c.ingame) return [];

            const IfType = c.chatInterface.constructor as any;
            const shopCom = IfType.list[shopComId];
            if (!shopCom || !shopCom.linkObjType) return [];

            const items: {slot: number; objId: number; count: number}[] = [];
            for (let i = 0; i < shopCom.linkObjType.length; i++) {
                if (shopCom.linkObjType[i] > 0) {
                    items.push({slot: i, objId: shopCom.linkObjType[i], count: shopCom.linkObjNumber[i]});
                }
            }
            return items;
        },

        /** Click an interface button by component ID using the game's action system */
        clickButton(comId: number): boolean {
            if (!c.ingame) return false;
            c.menuAction[0] = 231; // MiniMenuAction.IF_BUTTON (buttontype=normal)
            c.menuParamA[0] = 0;
            c.menuParamB[0] = 0;
            c.menuParamC[0] = comId;
            c.doAction(0);
            return true;
        },

        /** Click a select/toggle button (buttontype=select) - used for combat styles, autocast toggle */
        selectButton(comId: number): boolean {
            if (!c.ingame) return false;
            c.menuAction[0] = 225; // MiniMenuAction.SELECT_BUTTON
            c.menuParamA[0] = 0;
            c.menuParamB[0] = 0;
            c.menuParamC[0] = comId;
            c.doAction(0);
            return true;
        },

        /** Get ground items near the player. Returns array of {objId, x, z} */
        getGroundItems(radius: number = 10): {objId: number; x: number; z: number}[] {
            if (!c.ingame || !c.localPlayer) return [];
            const results: {objId: number; x: number; z: number}[] = [];
            const px = c.localPlayer.routeX[0];
            const pz = c.localPlayer.routeZ[0];
            const level = c.minusedlevel;
            const groundObj = c.groundObj;
            if (!groundObj || !groundObj[level]) return results;

            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const x = px + dx;
                    const z = pz + dz;
                    if (x < 0 || z < 0 || x >= 104 || z >= 104) continue;
                    const objs = groundObj[level][x]?.[z];
                    if (!objs) continue;
                    for (let obj = objs.tail(); obj !== null; obj = objs.prev()) {
                        results.push({objId: obj.id, x, z});
                    }
                }
            }
            return results;
        },

        /** Pick up a ground item using the game's action system.
         *  objId is from getGroundItems() (obj.pack ID, no offset needed). */
        pickupGroundItem(objId: number, x: number, z: number): boolean {
            if (!c.ingame) return false;
            c.menuAction[0] = 617; // MiniMenuAction.OP_OBJ3 (Take - hardcoded for default pickup)
            c.menuParamA[0] = objId; // ground items already use obj.pack IDs
            c.menuParamB[0] = x;
            c.menuParamC[0] = z;
            c.doAction(0);
            return true;
        },

        /** Use a held item's first option (e.g. Bury bones, Eat food).
         *  objId is the runtime ID. slot is the inventory slot. comId defaults to 3214 (inventory). */
        useHeldItem(objId: number, slot: number, comId: number = 3214): boolean {
            if (!c.ingame) return false;
            c.menuAction[0] = 694; // MiniMenuAction.OP_HELD1
            c.menuParamA[0] = objId - 1; // server expects obj.pack ID
            c.menuParamB[0] = slot;
            c.menuParamC[0] = comId;
            c.doAction(0);
            return true;
        },

        /** Use one inventory item on another (e.g. feather on arrow shaft).
         *  Both objIds are runtime IDs (from linkObjType). Slots are inventory slot indices.
         *  comId defaults to 3214 (inventory). */
        useItemOnItem(srcObjId: number, srcSlot: number, destObjId: number, destSlot: number, comId: number = 3214): boolean {
            if (!c.ingame) return false;
            // Step 1: Select the source item (USEHELD_START)
            c.menuAction[0] = 102; // MiniMenuAction.USEHELD_START
            c.menuParamA[0] = srcObjId - 1; // server obj.pack ID
            c.menuParamB[0] = srcSlot;
            c.menuParamC[0] = comId;
            c.doAction(0);
            // Step 2: Use on the target item (USEHELD_ONHELD)
            c.menuAction[0] = 398; // MiniMenuAction.USEHELD_ONHELD
            c.menuParamA[0] = destObjId - 1; // server obj.pack ID
            c.menuParamB[0] = destSlot;
            c.menuParamC[0] = comId;
            c.doAction(0);
            return true;
        },

        /** Toggle debug mode - shows IDs in right-click menus (locId, npcId, objId, slot, coords) */
        setDebug(on: boolean): void {
            c.debugMode = on;
        },

        /** Set sidebar tab (0=combat, 3=inventory, 6=magic, etc.) */
        setTab(tab: number): void {
            c.sideTab = tab;
            c.redrawSidebar = true;
            c.redrawSideicons = true;
        },

        /** Walk to a local tile */
        walk(x: number, z: number): boolean {
            const lp = c.localPlayer;
            if (!lp || !c.ingame) return false;
            c.tryMove(lp.routeX[0], lp.routeZ[0], x, z, false, 0, 0, 0, 0, 0, 0);
            return true;
        },

        /** Walk toward a world coordinate. Breaks long distances into ~15 tile steps. */
        walkTo(worldX: number, worldZ: number): boolean {
            if (!c.ingame || !c.localPlayer) return false;
            const px = c.localPlayer.routeX[0] + c.mapBuildBaseX;
            const pz = c.localPlayer.routeZ[0] + c.mapBuildBaseZ;
            const dx = worldX - px;
            const dz = worldZ - pz;
            const dist = Math.max(Math.abs(dx), Math.abs(dz));
            if (dist === 0) return true;
            const step = Math.min(dist, 15);
            const sx = px + Math.round(dx / dist * step);
            const sz = pz + Math.round(dz / dist * step);
            return bot.walk(sx - c.mapBuildBaseX, sz - c.mapBuildBaseZ);
        },

        /** Get player world position */
        getWorldPos(): {x: number; z: number} | null {
            const lp = c.localPlayer;
            if (!lp || !c.ingame) return null;
            return {x: lp.routeX[0] + c.mapBuildBaseX, z: lp.routeZ[0] + c.mapBuildBaseZ};
        },

        /** Check if player is within distance of a world coordinate */
        isNear(worldX: number, worldZ: number, dist: number = 3): boolean {
            const pos = bot.getWorldPos();
            if (!pos) return false;
            return Math.abs(pos.x - worldX) <= dist && Math.abs(pos.z - worldZ) <= dist;
        },

        /** Use an inventory item on a nearby location (e.g. flax on spinning wheel).
         *  objId is runtime ID. Finds the loc by name and uses USEHELD_ONLOC (810). */
        useItemOnLoc(objId: number, objSlot: number, locName: string, comId: number = 3214): boolean {
            if (!c.ingame) return false;
            const locs = bot.findLocs(locName, 10);
            if (locs.length === 0) return false;
            const loc = locs[0];
            // Set held item state (same as USEHELD_START)
            c.objComId = objId - 1; // server obj.pack ID
            c.objSelectedSlot = objSlot;
            c.objSelectedComId = comId;
            // Use item on loc
            c.menuAction[0] = 810; // MiniMenuAction.USEHELD_ONLOC
            c.menuParamA[0] = loc.typecode;
            c.menuParamB[0] = loc.x;
            c.menuParamC[0] = loc.z;
            c.doAction(0);
            return true;
        },

        /** Deposit all of an item into the bank. Bank interface must be open.
         *  Uses INV_BUTTON4 (Deposit All) on bank_side:inv (2006). */
        depositAll(objId: number, slot: number): boolean {
            if (!c.ingame || c.mainModalId === -1) return false;
            c.menuAction[0] = 331; // MiniMenuAction.INV_BUTTON4 (Deposit All)
            c.menuParamA[0] = objId - 1; // server obj.pack ID
            c.menuParamB[0] = slot;
            c.menuParamC[0] = 2006; // bank_side:inv
            c.doAction(0);
            return true;
        },

        /** Auto-login with credentials */
        login(username: string, password: string): void {
            c.loginUser = username;
            c.loginPass = password;
            c.loginscreen = 2;
            (window as any)._botLoginPending = true;
        },

        /** Find NPCs by name (case-insensitive partial match) */
        findNpc(name: string): NpcInfo[] {
            const lower = name.toLowerCase();
            return bot.getNpcs().filter(n => n.name?.toLowerCase().includes(lower));
        },

        /** Pickpocket the first NPC matching a name */
        pickpocketByName(name: string): boolean {
            const npcs = bot.findNpc(name);
            if (npcs.length === 0) return false;
            return bot.pickpocket(npcs[0].slot);
        },

        // ===== Script Runner =====

        /**
         * Start a bot script with all common boilerplate handled automatically:
         * - Auto re-login if logged out
         * - Dismiss level-up / quest dialogs ("Click here to continue")
         * - Close modal overlays ("Welcome to RuneScape", etc.)
         *
         * Usage:
         *   window.bot.startScript('red bracket', 'jojolure', () => {
         *       window.bot.pickpocketByName('paladin');
         *   });
         */
        startScript(username: string, password: string, action: () => void, intervalMs: number = 2000): void {
            // Clear any previous script
            if ((window as any)._botInterval) clearInterval((window as any)._botInterval);
            (window as any)._botRelogging = false;

            (window as any)._botInterval = setInterval(() => {
                // Auto re-login
                if (!bot.isLoggedIn()) {
                    if (!(window as any)._botRelogging) {
                        (window as any)._botRelogging = true;
                        console.log('[BOT] Logged out, re-logging in...');
                        bot.login(username, password);
                        setTimeout(() => { (window as any)._botRelogging = false; }, 10000);
                    }
                    return;
                }

                // Reset idle timer so the client doesn't auto-logout
                c.idleTimer = performance.now();

                // Dismiss level-up dialogs. Don't close modals here — scripts
                // like the shop buyer need modals to stay open.
                bot.dismissDialog();

                // Run the user's script action
                try {
                    action();
                } catch (e) {
                    console.error('[BOT] Script error:', e);
                }
            }, intervalMs);

            console.log('[BOT] Script started.');
        },

        /** Stop the current script */
        stopScript(): void {
            if ((window as any)._botInterval) {
                clearInterval((window as any)._botInterval);
                (window as any)._botInterval = null;
            }
            console.log('[BOT] Script stopped.');
        },
    };

    (window as any).bot = bot;
    console.log('[BOT] Bot API initialized. Use window.bot to control the game.');
}
