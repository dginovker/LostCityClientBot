import Pix2D from '#/graphics/Pix2D.js';

import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

// jag::oldscape::graphics::Pix8
export default class Pix8 extends Pix2D {
    pixels: Int8Array;
    wi: number; // jag::oldscape::graphics::pixloader::m_wi
    hi: number; // jag::oldscape::graphics::pixloader::m_hi
    xof: number; // jag::oldscape::graphics::pixloader::m_xof
    yof: number; // jag::oldscape::graphics::pixloader::m_yof
    owi: number; // jag::oldscape::graphics::pixloader::m_owi
    ohi: number; // jag::oldscape::graphics::pixloader::m_ohi
    readonly bpal: Int32Array; // jag::oldscape::graphics::pixloader::m_bpal

    constructor(width: number, height: number, palette: Int32Array) {
        super();

        this.pixels = new Int8Array(width * height);
        this.wi = this.owi = width;
        this.hi = this.ohi = height;
        this.xof = this.yof = 0;
        this.bpal = palette;
    }

    static load(jag: Jagfile, name: string, sprite: number = 0): Pix8 {
        const dat: Packet = new Packet(jag.read(name + '.dat'));
        const index: Packet = new Packet(jag.read('index.dat'));

        // cropW/cropH are shared across all sprites in a single image
        index.pos = dat.g2();
        const owi: number = index.g2();
        const ohi: number = index.g2();

        // palette is shared across all images in a single archive
        const bpalCount: number = index.g1();
        const bpal: Int32Array = new Int32Array(bpalCount);
        // the first color (0) is reserved for transparency
        for (let i: number = 1; i < bpalCount; i++) {
            bpal[i] = index.g3();
            // black (0) will become transparent, make it black (1) so it's visible
            if (bpal[i] === 0) {
                bpal[i] = 1;
            }
        }

        // advance to sprite
        for (let i: number = 0; i < sprite; i++) {
            index.pos += 2;
            dat.pos += index.g2() * index.g2();
            index.pos += 1;
        }

        if (dat.pos > dat.length || index.pos > index.length) {
            throw new Error();
        }

        // read sprite
        const xof: number = index.g1();
        const yof: number = index.g1();
        const wi: number = index.g2();
        const hi: number = index.g2();

        const image: Pix8 = new Pix8(wi, hi, bpal);
        image.xof = xof;
        image.yof = yof;
        image.owi = owi;
        image.ohi = ohi;

        const encoding: number = index.g1();
        if (encoding === 0) {
            const length: number = image.wi * image.hi;
            for (let i: number = 0; i < length; i++) {
                image.pixels[i] = dat.g1b();
            }
        } else if (encoding === 1) {
            const width: number = image.wi;
            const height: number = image.hi;
            for (let x: number = 0; x < width; x++) {
                for (let y: number = 0; y < height; y++) {
                    image.pixels[x + y * width] = dat.g1b();
                }
            }
        }

        return image;
    }

    // jag::oldscape::graphics::Pix8::HalveSize
    halveSize(): void {
        this.owi |= 0;
        this.ohi |= 0;
        this.owi /= 2;
        this.ohi /= 2;
        this.owi |= 0;
        this.ohi |= 0;

        const pixels: Int8Array = new Int8Array(this.owi * this.ohi);
        let off: number = 0;
        for (let y: number = 0; y < this.hi; y++) {
            for (let x: number = 0; x < this.wi; x++) {
                pixels[((x + this.xof) >> 1) + ((y + this.yof) >> 1) * this.owi] = this.pixels[off++];
            }
        }
        this.pixels = pixels;
        this.wi = this.owi;
        this.hi = this.ohi;
        this.xof = 0;
        this.yof = 0;
    }

    // jag::oldscape::graphics::Pix32::Trim
    trim(): void {
        if (this.wi === this.owi && this.hi === this.ohi) {
            return;
        }

        const pixels: Int8Array = new Int8Array(this.owi * this.ohi);
        let off: number = 0;
        for (let y: number = 0; y < this.hi; y++) {
            for (let x: number = 0; x < this.wi; x++) {
                pixels[x + this.xof + (y + this.yof) * this.owi] = this.pixels[off++];
            }
        }
        this.pixels = pixels;
        this.wi = this.owi;
        this.hi = this.ohi;
        this.xof = 0;
        this.yof = 0;
    }

    // jag::oldscape::graphics::Pix8::HFlip
    hflip(): void {
        const pixels: Int8Array = this.pixels;
        const width: number = this.wi;
        const height: number = this.hi;

        for (let y: number = 0; y < height; y++) {
            const div: number = (width / 2) | 0;
            for (let x: number = 0; x < div; x++) {
                const off1: number = x + y * width;
                const off2: number = width - x - 1 + y * width;

                const tmp: number = pixels[off1];
                pixels[off1] = pixels[off2];
                pixels[off2] = tmp;
            }
        }
    }

    // jag::oldscape::graphics::Pix8::VFlip
    vflip(): void {
        const pixels: Int8Array = this.pixels;
        const width: number = this.wi;
        const height: number = this.hi;

        for (let y: number = 0; y < ((height / 2) | 0); y++) {
            for (let x: number = 0; x < width; x++) {
                const off1: number = x + y * width;
                const off2: number = x + (height - y - 1) * width;

                const tmp: number = pixels[off1];
                pixels[off1] = pixels[off2];
                pixels[off2] = tmp;
            }
        }
    }

    // jag::oldscape::graphics::Pix8::RgbAdjust
    rgbAdjust(r: number, g: number, b: number): void {
        for (let i: number = 0; i < this.bpal.length; i++) {
            let red: number = (this.bpal[i] >> 16) & 0xff;
            red += r;
            if (red < 0) {
                red = 0;
            } else if (red > 255) {
                red = 255;
            }

            let green: number = (this.bpal[i] >> 8) & 0xff;
            green += g;
            if (green < 0) {
                green = 0;
            } else if (green > 255) {
                green = 255;
            }

            let blue: number = this.bpal[i] & 0xff;
            blue += b;
            if (blue < 0) {
                blue = 0;
            } else if (blue > 255) {
                blue = 255;
            }

            this.bpal[i] = (red << 16) + (green << 8) + blue;
        }
    }

    // jag::oldscape::graphics::NXTPix2D::PlotSprite
    plotSprite(x: number, y: number): void {
        x |= 0;
        y |= 0;

        x += this.xof;
        y += this.yof;

        let dstOff: number = x + y * Pix2D.width;
        let srcOff: number = 0;
        let h: number = this.hi;
        let w: number = this.wi;
        let dstStep: number = Pix2D.width - w;
        let srcStep: number = 0;

        if (y < Pix2D.boundTop) {
            const cutoff: number = Pix2D.boundTop - y;
            h -= cutoff;
            y = Pix2D.boundTop;
            srcOff += cutoff * w;
            dstOff += cutoff * Pix2D.width;
        }

        if (y + h > Pix2D.boundBottom) {
            h -= y + h - Pix2D.boundBottom;
        }

        if (x < Pix2D.boundLeft) {
            const cutoff: number = Pix2D.boundLeft - x;
            w -= cutoff;
            x = Pix2D.boundLeft;
            srcOff += cutoff;
            dstOff += cutoff;
            srcStep += cutoff;
            dstStep += cutoff;
        }

        if (x + w > Pix2D.boundRight) {
            const cutoff: number = x + w - Pix2D.boundRight;
            w -= cutoff;
            srcStep += cutoff;
            dstStep += cutoff;
        }

        if (w > 0 && h > 0) {
            this.plot(w, h, this.pixels, srcOff, srcStep, Pix2D.pixels, dstOff, dstStep);
        }
    }

    // jag::oldscape::graphics::NXTPix2D::PlotSprite
    private plot(w: number, h: number, src: Int8Array, srcOff: number, srcStep: number, dst: Int32Array, dstOff: number, dstStep: number): void {
        const qw: number = -(w >> 2);
        w = -(w & 0x3);

        for (let y: number = -h; y < 0; y++) {
            for (let x: number = qw; x < 0; x++) {
                let palIndex: number = src[srcOff++];
                if (palIndex === 0) {
                    dstOff++;
                } else {
                    dst[dstOff++] = this.bpal[palIndex & 0xff];
                }

                palIndex = src[srcOff++];
                if (palIndex === 0) {
                    dstOff++;
                } else {
                    dst[dstOff++] = this.bpal[palIndex & 0xff];
                }

                palIndex = src[srcOff++];
                if (palIndex === 0) {
                    dstOff++;
                } else {
                    dst[dstOff++] = this.bpal[palIndex & 0xff];
                }

                palIndex = src[srcOff++];
                if (palIndex === 0) {
                    dstOff++;
                } else {
                    dst[dstOff++] = this.bpal[palIndex & 0xff];
                }
            }

            for (let x: number = w; x < 0; x++) {
                const palIndex: number = src[srcOff++];
                if (palIndex === 0) {
                    dstOff++;
                } else {
                    dst[dstOff++] = this.bpal[palIndex & 0xff];
                }
            }

            dstOff += dstStep;
            srcOff += srcStep;
        }
    }

    /// mapview applet:

    // jag::oldscape::graphics::NXTPix2D::ScalePlotSprite
    scalePlotSprite(arg0: number, arg1: number, arg2: number, arg3: number): void {
        try {
            const local2: number = this.wi;
            const local5: number = this.hi;
            let local7: number = 0;
            let local9: number = 0;
            const local15: number = ((local2 << 16) / arg2) | 0;
            const local21: number = ((local5 << 16) / arg3) | 0;
            const local24: number = this.owi;
            const local27: number = this.ohi;
            const local33: number = ((local24 << 16) / arg2) | 0;
            const local39: number = ((local27 << 16) / arg3) | 0;
            arg0 = (arg0 + (this.xof * arg2 + local24 - 1) / local24) | 0;
            arg1 = (arg1 + (this.yof * arg3 + local27 - 1) / local27) | 0;
            if ((this.xof * arg2) % local24 != 0) {
                local7 = (((local24 - ((this.xof * arg2) % local24)) << 16) / arg2) | 0;
            }
            if ((this.yof * arg3) % local27 != 0) {
                local9 = (((local27 - ((this.yof * arg3) % local27)) << 16) / arg3) | 0;
            }
            arg2 = ((arg2 * (this.wi - (local7 >> 16))) / local24) | 0;
            arg3 = ((arg3 * (this.hi - (local9 >> 16))) / local27) | 0;
            let local133: number = arg0 + arg1 * Pix2D.width;
            let local137: number = Pix2D.width - arg2;
            let local144: number;
            if (arg1 < Pix2D.boundTop) {
                local144 = Pix2D.boundTop - arg1;
                arg3 -= local144;
                arg1 = 0;
                local133 += local144 * Pix2D.width;
                local9 += local39 * local144;
            }
            if (arg1 + arg3 > Pix2D.boundBottom) {
                arg3 -= arg1 + arg3 - Pix2D.boundBottom;
            }
            if (arg0 < Pix2D.boundLeft) {
                local144 = Pix2D.boundLeft - arg0;
                arg2 -= local144;
                arg0 = 0;
                local133 += local144;
                local7 += local33 * local144;
                local137 += local144;
            }
            if (arg0 + arg2 > Pix2D.boundRight) {
                local144 = arg0 + arg2 - Pix2D.boundRight;
                arg2 -= local144;
                local137 += local144;
            }
            this.plotScale(Pix2D.pixels, this.pixels, this.bpal, local7, local9, local133, local137, arg2, arg3, local33, local39, local2);
        } catch (ignore) {
            console.log('error in sprite clipping routine');
        }
    }

    // jag::oldscape::graphics::NXTPix2D::PlotScale
    private plotScale(dst: Int32Array, src: Int8Array, bpal: Int32Array, offW: number, offH: number, dstOff: number, dstStep: number, w: number, h: number, scaleCropWidth: number, scaleCropHeight: number, arg11: number): void {
        try {
            const lastOffW: number = offW;
            for (let y: number = -h; y < 0; y++) {
                const offY: number = (offH >> 16) * arg11;
                for (let x: number = -w; x < 0; x++) {
                    const rgb: number = src[(offW >> 16) + offY];
                    if (rgb == 0) {
                        dstOff++;
                    } else {
                        dst[dstOff++] = bpal[rgb & 0xff];
                    }
                    offW += scaleCropWidth;
                }
                offH += scaleCropHeight;
                offW = lastOffW;
                dstOff += dstStep;
            }
        } catch (e) {
            console.log('error in plot_scale');
        }
    }
}
