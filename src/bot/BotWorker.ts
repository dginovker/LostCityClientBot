// Headless bot worker. Runs a full game client with NO DOM and NO rendering, so many can run
// at once (each Worker has its own isolated globals — no Client.loopCycle / Pix3D collisions).
//
// The DOM shim below MUST be installed before the client module is imported, because
// graphics/Canvas.ts grabs `document.getElementById('canvas')` at import time.

/* eslint-disable @typescript-eslint/no-explicit-any */
const g: any = globalThis;
g.__HEADLESS = true; // Client.mainredraw() and OnDemand.startWorker() early-return on this

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
// Workers can't output audio. Stub AudioContext with objects whose every method is a no-op and
// every property read returns a no-op-or-0, so no audio call ever throws and breaks the game loop.
if (typeof g.AudioContext === 'undefined' && typeof g.webkitAudioContext === 'undefined') {
    const audioNode = (): any => new Proxy({ value: 0, gain: null as any }, {
        get: (t: any, p) => {
            if (p === 'gain' || p === 'frequency' || p === 'detune') { return t[p] || (t[p] = audioNode()); }
            if (p === 'getChannelData') { return () => new Float32Array(0); } // OOB writes are silent no-ops
            if (p in t) return t[p];
            return noop; // connect, start, stop, setValueAtTime, cancelScheduledValues, ...
        },
        set: (t: any, p, v) => { t[p] = v; return true; },
    });
    g.AudioContext = g.webkitAudioContext = class {
        destination = audioNode();
        currentTime = 0;
        sampleRate = 22050;
        state = 'running';
        createBuffer() { return audioNode(); }
        createBufferSource() { return audioNode(); }
        createGain() { return audioNode(); }
        createOscillator() { return audioNode(); }
        createDynamicsCompressor() { return audioNode(); }
        decodeAudioData() { return Promise.resolve(audioNode()); }
        resume() { return Promise.resolve(); }
        suspend() { return Promise.resolve(); }
        close() { return Promise.resolve(); }
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
}

let started = false;

self.onmessage = async (e: MessageEvent): Promise<void> => {
    const msg = e.data;
    if (msg.type === 'stop') {
        self.close();
        return;
    }
    // Bring this bot to the foreground: resume rendering + on-demand model/map streaming, and push
    // ~15fps frames (as ImageBitmaps) to the main thread to blit onto the visible canvas.
    if (msg.type === 'foreground') {
        g.__HEADLESS = false;
        // The bot logged in headless (no rendering), so the static interface frame was never drawn —
        // its margins still hold title-screen pixels. Clear the canvas and force a full frame redraw.
        try {
            const ctx = off.getContext('2d');
            if (ctx) { ctx.fillStyle = 'black'; ctx.fillRect(0, 0, off.width, off.height); }
            const cl = g.bot?._client;
            if (cl) { cl.titleFlames?.close?.(); cl.redrawFrame = true; if (cl.refresh) cl.refresh(); }
        } catch { /* noop */ }
        if (!(self as any)._frameIv) {
            (self as any)._frameIv = setInterval(async () => {
                try { const bmp = await createImageBitmap(off); self.postMessage({ type: 'frame', bmp }, [bmp]); } catch { /* noop */ }
            }, 66);
        }
        return;
    }
    if (msg.type === 'background') {
        g.__HEADLESS = true; // back to headless / lightweight
        if ((self as any)._frameIv) { clearInterval((self as any)._frameIv); (self as any)._frameIv = null; }
        return;
    }
    if (msg.type !== 'start' || started) {
        return;
    }
    started = true;
    const m = msg as StartMsg;
    self.postMessage({ type: 'debug', id: m.id, stage: 'start-received' });
    g.__BOT_HOST = m.host;
    g.__BOT_SECURE = m.secure;
    if ((m as any).rsan) g.__BOT_RSAN = (m as any).rsan;
    if ((m as any).rsae) g.__BOT_RSAE = (m as any).rsae;
    try {

    let action: ((bot: any) => void) | null = null;
    try {
        action = m.script ? (new Function('bot', m.script) as (bot: any) => void) : null;
    } catch (err) {
        self.postMessage({ type: 'error', id: m.id, err: 'script parse: ' + String(err) });
    }

    // Does fetch (cache loading) work from inside the worker?
    try {
        const r = await fetch('crc');
        const buf = await r.arrayBuffer();
        self.postMessage({ type: 'fetchTest', status: r.status, len: buf.byteLength, url: r.url });
    } catch (err) {
        self.postMessage({ type: 'fetchTest', err: String(err) });
    }
    // Does IndexedDB open in the worker (the client uses it as a cache)?
    try {
        const req = (indexedDB as any).open('__probe', 1);
        req.onsuccess = () => self.postMessage({ type: 'idbTest', ok: true });
        req.onerror = () => self.postMessage({ type: 'idbTest', ok: false, err: 'error' });
        req.onblocked = () => self.postMessage({ type: 'idbTest', ok: false, err: 'blocked' });
        setTimeout(() => self.postMessage({ type: 'idbTest', ok: false, err: 'timeout(2s) — likely hangs the client' }), 2000);
    } catch (err) {
        self.postMessage({ type: 'idbTest', err: String(err) });
    }

    // Import AFTER the shim is in place; the bundler inlines the whole client here.
    const bootStart = performance.now();
    const { Client } = await import('#/client/Client.js');
    new Client(10, false, true); // boots headless (mainredraw is a no-op via __HEADLESS)

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
