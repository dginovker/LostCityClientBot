// Bot API - exposes game internals to window.bot for Chrome DevTools MCP control

import { Client } from '#/client/Client.js';
import { ClientProt } from '#/io/ClientProt.js';

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

        /** Set sidebar tab (0=combat, 3=inventory, 6=magic, etc.) */
        setTab(tab: number): void {
            c.sideTab = tab;
            c.redrawSidebar = true;
            c.redrawSideicons = true;
        },

        /** Walk to a tile */
        walk(x: number, z: number): boolean {
            const lp = c.localPlayer;
            if (!lp || !c.ingame) return false;
            c.tryMove(lp.routeX[0], lp.routeZ[0], x, z, false, 0, 0, 0, 0, 0, 0);
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

                // Handle blocking UI (close modals, dismiss dialogs) but don't skip the action
                bot.handleBlockingUI();

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
