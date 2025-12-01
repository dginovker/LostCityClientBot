import { canvas2d } from '#/graphics/Canvas.js';
import Pix2D from '#/graphics/Pix2D.js';

export default class PixMap {
    readonly data: Int32Array;
    private readonly width: number;
    private readonly height: number;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly paint: Uint32Array;
    private readonly img: ImageData;

    constructor(width: number, height: number, ctx: CanvasRenderingContext2D = canvas2d) {
        this.width = width;
        this.height = height;
        this.data = new Int32Array(width * height);

        this.ctx = ctx;
        this.img = this.ctx.getImageData(0, 0, width, height);
        this.paint = new Uint32Array(this.img.data.buffer);

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
        for (let i: number = 0; i < this.data.length; i++) {
            const pixel: number = this.data[i];
            this.paint[i] = ((pixel >> 16) & 0xff) | (((pixel >> 8) & 0xff) << 8) | ((pixel & 0xff) << 16) | 0xff000000;
        }
    }
}
