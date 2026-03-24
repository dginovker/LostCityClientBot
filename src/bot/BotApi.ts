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
    const bot = {
        // Internal reference for advanced use
        _client: client as any,

        // ===== Read State =====

        /** Dismiss any open dialog (level up, etc.) */
        dismissDialog(): boolean {
            const c = client as any;
            if (c.chatComId !== -1) {
                c.out.pIsaac(ClientProt.RESUME_PAUSEBUTTON);
                c.out.p2(c.chatComId);
                c.resumedPauseButton = true;
                return true;
            }
            return false;
        },

        /** Get all nearby NPCs */
        getNpcs(): NpcInfo[] {
            const npcs: NpcInfo[] = [];
            for (let i = 0; i < (client as any).npcCount; i++) {
                const idx = (client as any).npcIds[i];
                const npc = (client as any).npc[idx];
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
            const lp = (client as any).localPlayer;
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
                const text = (client as any).chatText[i];
                if (text !== null) {
                    msgs.push({
                        type: (client as any).chatType[i],
                        text,
                        sender: (client as any).chatUsername[i],
                    });
                }
            }
            return msgs;
        },

        /** Check if logged in */
        isLoggedIn(): boolean {
            return (client as any).ingame === true;
        },

        /** Get thieving stat */
        getStats(): { [name: string]: { level: number; xp: number } } {
            const stats: { [name: string]: { level: number; xp: number } } = {};
            const names = [
                'Attack', 'Defence', 'Strength', 'Hitpoints', 'Ranged', 'Prayer',
                'Magic', 'Cooking', 'Woodcutting', 'Fletching', 'Fishing', 'Firemaking',
                'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility', 'Thieving',
                'Slayer', 'Farming', 'Runecraft'
            ];
            const levels = (client as any).realLevel;
            const xps = (client as any).experience;
            if (levels && xps) {
                for (let i = 0; i < names.length; i++) {
                    stats[names[i]] = { level: levels[i] ?? 0, xp: xps[i] ?? 0 };
                }
            }
            return stats;
        },

        // ===== Actions =====

        /** Pickpocket an NPC (sends OPNPC3) */
        pickpocket(npcSlot: number): boolean {
            const npc = (client as any).npc[npcSlot];
            const lp = (client as any).localPlayer;
            if (!npc || !lp || !(client as any).ingame) return false;

            // Walk toward the NPC
            (client as any).tryMove(
                lp.routeX[0], lp.routeZ[0],
                npc.routeX[0], npc.routeZ[0],
                false, 1, 1, 0, 0, 0, 2
            );

            // Send OPNPC3 packet
            (client as any).out.pIsaac(ClientProt.OPNPC3);
            (client as any).out.p2(npcSlot);
            return true;
        },

        /** Walk to a tile */
        walk(x: number, z: number): boolean {
            const lp = (client as any).localPlayer;
            if (!lp || !(client as any).ingame) return false;
            (client as any).tryMove(lp.routeX[0], lp.routeZ[0], x, z, false, 0, 0, 0, 0, 0, 0);
            return true;
        },

        /** Auto-login with credentials */
        login(username: string, password: string): void {
            (client as any).loginUser = username;
            (client as any).loginPass = password;
            (client as any).loginscreen = 2;
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
    };

    (window as any).bot = bot;
    console.log('[BOT] Bot API initialized. Use window.bot to control the game.');
}
