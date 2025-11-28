import { canvas2d } from '#/graphics/Canvas.js';
import Pix2D from '#/graphics/Pix2D.js';

export default class PixMap {
    private readonly img: ImageData;
    private readonly width: number;
    private readonly height: number;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly paint: Uint32Array;
    readonly data: Int32Array;

    constructor(width: number, height: number, ctx: CanvasRenderingContext2D = canvas2d) {
        this.ctx = ctx;
        this.img = this.ctx.getImageData(0, 0, width, height);
        this.paint = new Uint32Array(this.img.data.buffer);
        this.data = new Int32Array(width * height);
        this.width = width;
        this.height = height;
        this.bind();
    }

    bind(): void {
        Pix2D.setPixels(this.data, this.width, this.height);
    }

    draw(x: number, y: number): void {
        this.prepareCanvas();
        this.ctx.putImageData(this.img, x, y);
    }

    private prepareCanvas(): void {
        const length: number = this.data.length;
        const pixels: Int32Array = this.data;
        const paint: Uint32Array = this.paint;
        for (let i: number = 0; i < length; i++) {
            const pixel: number = pixels[i];
            paint[i] = ((pixel >> 16) & 0xff) | (((pixel >> 8) & 0xff) << 8) | ((pixel & 0xff) << 16) | 0xff000000;
        }
    }
}
