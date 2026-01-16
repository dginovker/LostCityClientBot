import DoublyLinkable from '#/datastruct/DoublyLinkable.js';

import { Colour } from '#/graphics/Colour.js';
import Pix2D from '#/graphics/Pix2D.js';

import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

import JavaRandom from '#/util/JavaRandom.js';

export default class PixFont extends DoublyLinkable {
    static readonly CHARSET: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!"£$%^&*()-_=+[{]};:\'@#~,<.>/?\\| ';
    static readonly CHARCODESET: number[] = [];

    private readonly charMask: Int8Array[] = [];
    readonly charMaskWidth: Int32Array = new Int32Array(94);
    readonly charMaskHeight: Int32Array = new Int32Array(94);
    readonly charOffsetX: Int32Array = new Int32Array(94);
    readonly charOffsetY: Int32Array = new Int32Array(94);
    readonly charAdvance: Int32Array = new Int32Array(95);
    readonly drawWidth: Int32Array = new Int32Array(256);
    private readonly rand: JavaRandom = new JavaRandom(Date.now()); // jag::oldscape::jstring::PixfontGeneric::m_rand
    strikeout: boolean = false;
    height2d: number = 0;

    static {
        const isCapacitor: boolean = navigator.userAgent.includes('Capacitor');

        for (let i: number = 0; i < 256; i++) {
            let c: number = PixFont.CHARSET.indexOf(String.fromCharCode(i));

            // This fixes text mangling in Capacitor native builds (Android/IOS)
            if (isCapacitor) {
                if (c >= 63) {
                    // "
                    c--;
                }
            }

            if (c === -1) {
                c = 74; // space
            }

            PixFont.CHARCODESET[i] = c;
        }
    }

    static fromArchive(archive: Jagfile, name: string): PixFont {
        const dat: Packet = new Packet(archive.read(name + '.dat'));
        const idx: Packet = new Packet(archive.read('index.dat'));

        idx.pos = dat.g2() + 4; // skip cropW and cropH

        const off: number = idx.g1();
        if (off > 0) {
            // skip palette
            idx.pos += (off - 1) * 3;
        }

        const font: PixFont = new PixFont();

        for (let i: number = 0; i < 94; i++) {
            font.charOffsetX[i] = idx.g1();
            font.charOffsetY[i] = idx.g1();

            const w: number = (font.charMaskWidth[i] = idx.g2());
            const h: number = (font.charMaskHeight[i] = idx.g2());

            const type: number = idx.g1();
            const len: number = w * h;

            font.charMask[i] = new Int8Array(len);

            if (type === 0) {
                for (let j: number = 0; j < w * h; j++) {
                    font.charMask[i][j] = dat.g1b();
                }
            } else if (type === 1) {
                for (let x: number = 0; x < w; x++) {
                    for (let y: number = 0; y < h; y++) {
                        font.charMask[i][x + y * w] = dat.g1b();
                    }
                }
            }

            if (h > font.height2d) {
                font.height2d = h;
            }

            font.charOffsetX[i] = 1;
            font.charAdvance[i] = w + 2;

            {
                let space: number = 0;
                for (let y: number = (h / 7) | 0; y < h; y++) {
                    space += font.charMask[i][y * w];
                }

                if (space <= ((h / 7) | 0)) {
                    font.charAdvance[i]--;
                    font.charOffsetX[i] = 0;
                }
            }

            {
                let space: number = 0;
                for (let y: number = (h / 7) | 0; y < h; y++) {
                    space += font.charMask[i][w + y * w - 1];
                }

                if (space <= ((h / 7) | 0)) {
                    font.charAdvance[i]--;
                }
            }
        }

        font.charAdvance[94] = font.charAdvance[8];
        for (let i: number = 0; i < 256; i++) {
            font.drawWidth[i] = font.charAdvance[PixFont.CHARCODESET[i]];
        }

        return font;
    }

    centreString(x: number, y: number, str: string | null, rgb: number): void {
        if (!str) {
            return;
        }

        x |= 0;
        y |= 0;

        this.drawString(x - ((this.stringWid(str) / 2) | 0), y, str, rgb);
    }

    centreStringTag(x: number, y: number, str: string, rgb: number, shadowed: boolean): void {
        x |= 0;
        y |= 0;

        this.drawStringTag(x - ((this.stringWid(str) / 2) | 0), y, str, rgb, shadowed);
    }

    stringWid(str: string | null): number {
        if (!str) {
            return 0;
        }

        const length: number = str.length;
        let w: number = 0;
        for (let i: number = 0; i < length; i++) {
            if (str.charAt(i) === '@' && i + 4 < length && str.charAt(i + 4) === '@') {
                i += 4;
            } else {
                w += this.drawWidth[str.charCodeAt(i)];
            }
        }

        return w;
    }

    drawString(x: number, y: number, str: string | null, rgb: number): void {
        if (!str) {
            return;
        }

        x |= 0;
        y |= 0;

        y -= this.height2d;

        for (let i: number = 0; i < str.length; i++) {
            const c: number = PixFont.CHARCODESET[str.charCodeAt(i)];

            if (c !== 94) {
                this.plotLetter(this.charMask[c], x + this.charOffsetX[c], y + this.charOffsetY[c], this.charMaskWidth[c], this.charMaskHeight[c], rgb);
            }

            x += this.charAdvance[c];
        }
    }

    centerStringWave(x: number, y: number, str: string | null, rgb: number, phase: number): void {
        if (!str) {
            return;
        }

        x |= 0;
        y |= 0;

        x -= (this.stringWid(str) / 2) | 0;
        const offY: number = y - this.height2d;

        for (let i: number = 0; i < str.length; i++) {
            const c: number = PixFont.CHARCODESET[str.charCodeAt(i)];

            if (c != 94) {
                this.plotLetter(this.charMask[c], x + this.charOffsetX[c], offY + this.charOffsetY[c] + ((Math.sin(i / 2.0 + phase / 5.0) * 5.0) | 0), this.charMaskWidth[c], this.charMaskHeight[c], rgb);
            }

            x += this.charAdvance[c];
        }
    }

    drawStringTag(x: number, y: number, str: string, rgb: number, shadowed: boolean): void {
        x |= 0;
        y |= 0;

        this.strikeout = false;
        const startX = x;

        const length: number = str.length;
        y -= this.height2d;
        for (let i: number = 0; i < length; i++) {
            if (str.charAt(i) === '@' && i + 4 < length && str.charAt(i + 4) === '@') {
                const tag = this.evaluateTag(str.substring(i + 1, i + 4));
                if (tag !== -1) {
                    rgb = tag;
                }
                i += 4;
            } else {
                const c: number = PixFont.CHARCODESET[str.charCodeAt(i)];

                if (c !== 94) {
                    if (shadowed) {
                        this.plotLetter(this.charMask[c], x + this.charOffsetX[c] + 1, y + this.charOffsetY[c] + 1, this.charMaskWidth[c], this.charMaskHeight[c], Colour.BLACK);
                    }
                    this.plotLetter(this.charMask[c], x + this.charOffsetX[c], y + this.charOffsetY[c], this.charMaskWidth[c], this.charMaskHeight[c], rgb);
                }

                x += this.charAdvance[c];
            }
        }

        if (this.strikeout) {
            Pix2D.hline(startX, y + ((this.height2d * 0.7) | 0), Colour.DARKRED, x - startX);
        }
    }

    drawStringAntiMacro(x: number, y: number, str: string, rgb: number, shadowed: boolean, seed: number): void {
        x |= 0;
        y |= 0;

        this.rand.setSeed(seed);

        const rand: number = (this.rand.nextInt() & 0x1f) + 192;
        const offY: number = y - this.height2d;
        for (let i: number = 0; i < str.length; i++) {
            if (str.charAt(i) === '@' && i + 4 < str.length && str.charAt(i + 4) === '@') {
                const tag = this.evaluateTag(str.substring(i + 1, i + 4));
                if (tag !== -1) {
                    rgb = tag;
                }
                i += 4;
            } else {
                const c: number = PixFont.CHARCODESET[str.charCodeAt(i)];
                if (c !== 94) {
                    if (shadowed) {
                        this.plotLetterTrans(x + this.charOffsetX[c] + 1, offY + this.charOffsetY[c] + 1, this.charMaskWidth[c], this.charMaskHeight[c], Colour.BLACK, 192, this.charMask[c]);
                    }

                    this.plotLetterTrans(x + this.charOffsetX[c], offY + this.charOffsetY[c], this.charMaskWidth[c], this.charMaskHeight[c], rgb, rand, this.charMask[c]);
                }

                x += this.charAdvance[c];
                if ((this.rand.nextInt() & 0x3) === 0) {
                    x++;
                }
            }
        }
    }

    evaluateTag(tag: string): number {
        if (tag === 'red') {
            return Colour.RED;
        } else if (tag === 'gre') {
            return Colour.GREEN;
        } else if (tag === 'blu') {
            return Colour.BLUE;
        } else if (tag === 'yel') {
            return Colour.YELLOW;
        } else if (tag === 'cya') {
            return Colour.CYAN;
        } else if (tag === 'mag') {
            return Colour.MAGENTA;
        } else if (tag === 'whi') {
            return Colour.WHITE;
        } else if (tag === 'bla') {
            return Colour.BLACK;
        } else if (tag === 'lre') {
            return Colour.LIGHTRED;
        } else if (tag === 'dre') {
            return Colour.DARKRED;
        } else if (tag === 'dbl') {
            return Colour.DARKBLUE;
        } else if (tag === 'or1') {
            return Colour.ORANGE1;
        } else if (tag === 'or2') {
            return Colour.ORANGE2;
        } else if (tag === 'or3') {
            return Colour.ORANGE3;
        } else if (tag === 'gr1') {
            return Colour.GREEN1;
        } else if (tag === 'gr2') {
            return Colour.GREEN2;
        } else if (tag === 'gr3') {
            return Colour.GREEN3;
        } else {
            if (tag === 'str') {
                this.strikeout = true;
            }

            return -1;
        }
    }

    drawStringRight(x: number, y: number, str: string, rgb: number, shadowed: boolean = true): void {
        x |= 0;
        y |= 0;

        if (shadowed) {
            this.drawString(x - this.stringWid(str) + 1, y + 1, str, Colour.BLACK);
        }
        this.drawString(x - this.stringWid(str), y, str, rgb);
    }

    // jag::oldscape::jstring::PixfontGeneric::PlotLetter
    plotLetter(data: Int8Array, x: number, y: number, w: number, h: number, rgb: number): void {
        x |= 0;
        y |= 0;
        w |= 0;
        h |= 0;

        let dstOff: number = x + y * Pix2D.width;
        let dstStep: number = Pix2D.width - w;

        let srcStep: number = 0;
        let srcOff: number = 0;

        if (y < Pix2D.clipMinY) {
            const cutoff: number = Pix2D.clipMinY - y;
            h -= cutoff;
            y = Pix2D.clipMinY;
            srcOff += cutoff * w;
            dstOff += cutoff * Pix2D.width;
        }

        if (y + h >= Pix2D.clipMaxY) {
            h -= y + h + 1 - Pix2D.clipMaxY;
        }

        if (x < Pix2D.clipMinX) {
            const cutoff: number = Pix2D.clipMinX - x;
            w -= cutoff;
            x = Pix2D.clipMinX;
            srcOff += cutoff;
            dstOff += cutoff;
            srcStep += cutoff;
            dstStep += cutoff;
        }

        if (x + w >= Pix2D.clipMaxX) {
            const cutoff: number = x + w + 1 - Pix2D.clipMaxX;
            w -= cutoff;
            srcStep += cutoff;
            dstStep += cutoff;
        }

        if (w > 0 && h > 0) {
            this.plot(w, h, data, srcOff, srcStep, Pix2D.pixels, dstOff, dstStep, rgb);
        }
    }

    private plot(w: number, h: number, src: Int8Array, srcOff: number, srcStep: number, dst: Int32Array, dstOff: number, dstStep: number, rgb: number): void {
        w |= 0;
        h |= 0;

        const hw: number = -(w >> 2);
        w = -(w & 0x3);

        for (let y: number = -h; y < 0; y++) {
            for (let x: number = hw; x < 0; x++) {
                if (src[srcOff++] === 0) {
                    dstOff++;
                } else {
                    dst[dstOff++] = rgb;
                }

                if (src[srcOff++] === 0) {
                    dstOff++;
                } else {
                    dst[dstOff++] = rgb;
                }

                if (src[srcOff++] === 0) {
                    dstOff++;
                } else {
                    dst[dstOff++] = rgb;
                }

                if (src[srcOff++] === 0) {
                    dstOff++;
                } else {
                    dst[dstOff++] = rgb;
                }
            }

            for (let x: number = w; x < 0; x++) {
                if (src[srcOff++] === 0) {
                    dstOff++;
                } else {
                    dst[dstOff++] = rgb;
                }
            }

            dstOff += dstStep;
            srcOff += srcStep;
        }
    }

    plotLetterTrans(x: number, y: number, w: number, h: number, rgb: number, alpha: number, mask: Int8Array): void {
        x |= 0;
        y |= 0;
        w |= 0;
        h |= 0;

        let dstOff: number = x + y * Pix2D.width;
        let dstStep: number = Pix2D.width - w;

        let srcStep: number = 0;
        let srcOff: number = 0;

        if (y < Pix2D.clipMinY) {
            const cutoff: number = Pix2D.clipMinY - y;
            h -= cutoff;
            y = Pix2D.clipMinY;
            srcOff += cutoff * w;
            dstOff += cutoff * Pix2D.width;
        }

        if (y + h >= Pix2D.clipMaxY) {
            h -= y + h + 1 - Pix2D.clipMaxY;
        }

        if (x < Pix2D.clipMinX) {
            const cutoff: number = Pix2D.clipMinX - x;
            w -= cutoff;
            x = Pix2D.clipMinX;
            srcOff += cutoff;
            dstOff += cutoff;
            srcStep += cutoff;
            dstStep += cutoff;
        }

        if (x + w >= Pix2D.clipMaxX) {
            const cutoff: number = x + w + 1 - Pix2D.clipMaxX;
            w -= cutoff;
            srcStep += cutoff;
            dstStep += cutoff;
        }

        if (w > 0 && h > 0) {
            this.plotTrans(w, h, Pix2D.pixels, dstOff, dstStep, mask, srcOff, srcStep, rgb, alpha);
        }
    }

    private plotTrans(w: number, h: number, dst: Int32Array, dstOff: number, dstStep: number, mask: Int8Array, maskOff: number, maskStep: number, rgb: number, alpha: number): void {
        w |= 0;
        h |= 0;

        const mixed: number = ((((rgb & 0xff00ff) * alpha) & 0xff00ff00) + (((rgb & 0xff00) * alpha) & 0xff0000)) >> 8;
        const invAlpha: number = 256 - alpha;

        for (let y: number = -h; y < 0; y++) {
            for (let x: number = -w; x < 0; x++) {
                if (mask[maskOff++] === 0) {
                    dstOff++;
                } else {
                    const dstRgb: number = dst[dstOff];
                    dst[dstOff++] = (((((dstRgb & 0xff00ff) * invAlpha) & 0xff00ff00) + (((dstRgb & 0xff00) * invAlpha) & 0xff0000)) >> 8) + mixed;
                }
            }

            dstOff += dstStep;
            maskOff += maskStep;
        }
    }
}
