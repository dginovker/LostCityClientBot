import Pix2D from '#/graphics/Pix2D.js';

// Simplified WorldMapFont
export default class WorldMapFontWeb extends Pix2D {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private font: string;
    private textHeight: number;
    private textOffsetY: number;

    constructor(size: number, bold: boolean) {
        super();

        const fontStyle = bold ? 'bold' : 'normal';
        this.font = `${fontStyle} ${size}px Arial, Helvetica, sans-serif`;

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

        this.ctx.font = this.font;
        this.ctx.fillStyle = 'white';

        const metrics = this.ctx.measureText('Hg'); // has ascent + descent
        const ascent = Math.ceil(metrics.actualBoundingBoxAscent);
        const descent = Math.ceil(metrics.actualBoundingBoxDescent);

        this.textHeight = ascent + descent;
        this.textOffsetY = ascent;

        this.canvas.height = this.textHeight;
    }

    centreString(str: string, x: number, y: number, rgb: number, shadowed: boolean) {
        this.drawString(str, x - Math.floor(this.stringWid(str) / 2), y, rgb, shadowed);
    }

    stringWid(str: string): number {
        this.ctx.font = this.font;
        return Math.ceil(this.ctx.measureText(str).width);
    }

    drawString(str: string, x: number, y: number, rgb: number, shadowed: boolean) {
        if (shadowed) {
            this.drawString(str, x + 1, y + 1, 0x000000, false);
        }

        const width = this.stringWid(str);
        this.canvas.width = width;
        this.ctx.clearRect(0, 0, width, this.canvas.height);

        this.ctx.font = this.font;
        this.ctx.fillStyle = 'white';

        this.ctx.fillText(str, 0, this.textOffsetY);

        const imageData = this.ctx.getImageData(0, 0, width, this.canvas.height);
        const data = imageData.data;

        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = rgb & 0xff;

        for (let iy = 0; iy < this.textHeight; iy++) {
            const dstY = y + iy;
            if (dstY < Pix2D.clipMinY || dstY >= Pix2D.clipMaxY) continue;

            for (let ix = 0; ix < width; ix++) {
                const dstX = x + ix;
                if (dstX < Pix2D.clipMinX || dstX >= Pix2D.clipMaxX) continue;

                const srcIndex = (iy * width + ix) * 4;
                const alpha = data[srcIndex + 3] / 255;
                if (alpha === 0) continue;

                const dstIndex = dstX + dstY * Pix2D.width;
                const dstRgb = Pix2D.pixels[dstIndex];
                const dstR = (dstRgb >> 16) & 0xff;
                const dstG = (dstRgb >> 8) & 0xff;
                const dstB = dstRgb & 0xff;

                const outR = Math.round(r * alpha + dstR * (1 - alpha));
                const outG = Math.round(g * alpha + dstG * (1 - alpha));
                const outB = Math.round(b * alpha + dstB * (1 - alpha));

                Pix2D.pixels[dstIndex] = (255 << 24) | (outR << 16) | (outG << 8) | outB;
            }
        }
    }

    getHeight(): number {
        return this.textHeight;
    }

    getYOffset(): number {
        return this.textOffsetY;
    }
}
