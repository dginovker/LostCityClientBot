// Headless bot worker. Runs a full game client with NO DOM and NO rendering, so many can run
// at once (each Worker has its own isolated globals — no Client.loopCycle / Pix3D collisions).
//
// The DOM shim below MUST be installed before the client module is imported, because
// graphics/Canvas.ts grabs `document.getElementById('canvas')` at import time.

/* eslint-disable @typescript-eslint/no-explicit-any */
const g: any = globalThis;
g.__IN_WORKER = true; // always: skips things that hang/aren't needed in a Worker (JPEG title, prefetch)
g.__HEADLESS = true;  // per-bot (overridden by start.render): gates rendering (mainredraw/drawProgress)

const noop = (): void => {};

// A fake <canvas>: real OffscreenCanvas 2d context (so the loader's drawProgress works, invisibly),
// but a Proxy so the dozens of oncanvas*/onkey* handler assignments and DOM-only calls just no-op.
const off = new OffscreenCanvas(765, 503);
const fakeCanvas: any = new Proxy(
    {
        width: 765,
        height: 503,
        tabIndex: 0,
        style: {},
        getContext: (type: string, opts?: any) => (off as any).getContext(type, opts),
        addEventListener: noop,
        removeEventListener: noop,
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 765, bottom: 503, width: 765, height: 503, x: 0, y: 0 }),
        focus: noop,
        requestFullscreen: noop,
    },
    { set: (t: any, p: any, v: any) => { t[p] = v; return true; } }
);

// A generic fake DOM element: any method call is a no-op, any property read/write is absorbed,
// and .style is a real object. Robust enough for the bits of DOM the loader touches (e.g. the
// mobile virtual-keyboard input element).
const fakeEl = (): any => new Proxy({ style: {}, value: '', tagName: 'DIV' } as any, {
    get: (t, p) => (p in t ? t[p] : noop),
    set: (t, p, v) => { t[p as any] = v; return true; },
});

if (typeof g.document === 'undefined') {
    g.document = {
        getElementById: () => fakeCanvas,
        createElement: () => fakeEl(),
        createElementNS: () => fakeEl(),
        body: fakeEl(),
        head: fakeEl(),
        documentElement: fakeEl(),
        addEventListener: noop,
        removeEventListener: noop,
        fullscreenElement: null,
    };
}
if (typeof g.window === 'undefined') {
    g.window = g;            // window === self
    g.innerWidth = 765;
    g.innerHeight = 600;
}
if (typeof g.localStorage === 'undefined') {
    const store: Record<string, string> = {};
    g.localStorage = {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: any) => { store[k] = String(v); },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { for (const k of Object.keys(store)) delete store[k]; },
        key: (i: number) => Object.keys(store)[i] ?? null,
        get length() { return Object.keys(store).length; },
    };
}

// Surface anything that would otherwise die silently inside the worker.
self.addEventListener('error', (ev: any) => {
    try { self.postMessage({ type: 'error', stage: 'global', err: String(ev.message || ev), file: ev.filename, line: ev.lineno }); } catch { /* noop */ }
});
self.addEventListener('unhandledrejection', (ev: any) => {
    try { self.postMessage({ type: 'error', stage: 'rejection', err: String((ev.reason && (ev.reason.stack || ev.reason.message)) || ev.reason) }); } catch { /* noop */ }
});

interface StartMsg {
    type: 'start';
    id: number;
    host: string;
    secure: boolean;
    user: string;
    pass: string;
    script: string;
    intervalMs?: number;
    render?: boolean; // true → render from boot (watched); false → headless until watched
}

let started = false;

// ~15fps frame stream from the offscreen canvas to the main thread — only while this bot is watched.
const startFrames = (): void => {
    if ((self as any)._frameIv) return;
    (self as any)._frameIv = setInterval(async () => {
        try { const bmp = await createImageBitmap(off); self.postMessage({ type: 'frame', bmp }, [bmp]); } catch { /* noop */ }
    }, 66);
};
const stopFrames = (): void => {
    if ((self as any)._frameIv) { clearInterval((self as any)._frameIv); (self as any)._frameIv = null; }
};

self.onmessage = async (e: MessageEvent): Promise<void> => {
    const msg = e.data;
    if (msg.type === 'stop') {
        self.close();
        return;
    }
    // Watch this bot: enable rendering + on-demand streaming and push frames to the main thread.
    if (msg.type === 'foreground') {
        const wasHeadless = g.__HEADLESS;
        g.__HEADLESS = false;
        // A bot that booted headless never drew the interface frame (its margins hold stale pixels)
        // and never loaded its scene — clear the canvas and force a redraw; on-demand then catches up.
        if (wasHeadless) {
            try {
                const ctx = off.getContext('2d');
                if (ctx) { ctx.fillStyle = 'black'; ctx.fillRect(0, 0, off.width, off.height); }
                const cl = g.bot?._client;
                if (cl) { cl.redrawFrame = true; if (cl.refresh) cl.refresh(); }
            } catch { /* noop */ }
        }
        startFrames();
        return;
    }
    if (msg.type === 'background') {
        g.__HEADLESS = true; // back to headless / lightweight
        stopFrames();
        return;
    }
    // Swap the running script on the fly (the active-bot editor uses this).
    if (msg.type === 'setScript') {
        try { (self as any)._action = msg.script ? (new Function('bot', msg.script) as (bot: any) => void) : null; }
        catch (err) { self.postMessage({ type: 'error', err: 'script parse: ' + String(err) }); }
        return;
    }
    // Forward a real mouse event into the client so the watched view is the ACTUAL game (right-click
    // shows the RuneScape menu, not the browser's "save image"). The client assigns its onmouse*/
    // onpointer* handlers as properties on the fake canvas, so we just call them with a synthetic event.
    if (msg.type === 'mouse') {
        const ev: any = { clientX: msg.x, clientY: msg.y, button: msg.button || 0, buttons: msg.buttons || 0,
            preventDefault: noop, stopPropagation: noop, pointerType: 'mouse', pointerId: 1, movementX: 0, movementY: 0 };
        const c: any = fakeCanvas;
        if (msg.kind === 'down') { c.onpointerdown?.(ev); c.onmousedown?.(ev); }
        else if (msg.kind === 'up') { c.onpointerup?.(ev); c.onmouseup?.(ev); g.onmouseup?.(ev); }
        else if (msg.kind === 'move') { c.onpointermove?.(ev); g.onmousemove?.(ev); }
        else if (msg.kind === 'leave') { c.onpointerleave?.(ev); }
        return;
    }
    if (msg.type !== 'start' || started) {
        return;
    }
    started = true;
    const m = msg as StartMsg;
    // render:true → full client from boot (visible loading/login screens + streamed frames);
    // render:false → headless & lightweight until the bot is watched.
    g.__HEADLESS = !(m as any).render;
    g.__BOT_HOST = m.host;
    g.__BOT_SECURE = m.secure;
    if ((m as any).rsan) g.__BOT_RSAN = (m as any).rsan;
    if ((m as any).rsae) g.__BOT_RSAE = (m as any).rsae;
    try {

    try {
        (self as any)._action = m.script ? (new Function('bot', m.script) as (bot: any) => void) : null;
    } catch (err) {
        self.postMessage({ type: 'error', id: m.id, err: 'script parse: ' + String(err) });
    }

    // Import AFTER the shim is in place; the bundler inlines the whole client here.
    const bootStart = performance.now();
    const { Client } = await import('#/client/Client.js');
    new Client(10, false, true);
    if (!g.__HEADLESS) startFrames(); // watched-from-boot: stream the loading screen right away

    let booted = false;
    const tick = m.intervalMs ?? 2000;
    setInterval(() => {
        const bot: any = g.bot;
        if (!bot || !bot._client) return;
        const c = bot._client;
        try {
            if (!booted) {
                booted = true;
                self.postMessage({ type: 'booted', id: m.id, ms: Math.round(performance.now() - bootStart) });
            }
            if (!c.ingame) {
                if (c.loginscreen === 0) bot.login(m.user, m.pass);
                self.postMessage({
                    type: 'state', id: m.id, ingame: false, loginscreen: c.loginscreen,
                    msg: (c.loginMes1 + ' | ' + c.loginMes2).trim(),
                    loopCycle: (Client as any).loopCycle,          // is the game loop advancing?
                    hasStream: !!c.stream,
                    pending: g._botLoginPending,
                    errLoad: c.errorLoading, errStart: c.errorStarted, errHost: c.errorHost,
                    hasTitle: !!c.title, hasOnDemand: !!c.onDemand, started: c.alreadyStarted,
                });
                return;
            }
            c.idleTimer = performance.now(); // anti-AFK
            const action = (self as any)._action;
            if (action) action(bot);
            self.postMessage({
                type: 'state', id: m.id, ingame: true,
                name: c.localPlayer?.name ?? null,
                pos: bot.getWorldPos ? bot.getWorldPos() : null,
                npcs: (bot.getNpcs?.() || []).length,
                headless: (g as any).__HEADLESS,
                titleFlames: !!c.titleFlames, titlebox: !!c.imageTitlebox, title0: !!c.imageTitle0,
                sceneState: c.sceneState,
                odRemaining: c.onDemand?.remaining?.(),
                odWorker: !!c.onDemand?.worker,
                odMsg: c.onDemand?.message,
            });
        } catch (err) {
            self.postMessage({ type: 'error', id: m.id, err: String(err) });
        }
    }, tick);

    self.postMessage({ type: 'ready', id: m.id });
    } catch (err: any) {
        self.postMessage({ type: 'error', id: m.id, stage: 'boot', err: String(err && (err.stack || err.message || err)) });
    }
};
