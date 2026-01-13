import DoublyLinkable from '#/datastruct/DoublyLinkable.js';

// jag::oldscape::graphics::Pix2D
export default class Pix2D extends DoublyLinkable {
    static pixels: Int32Array = new Int32Array();

    static width: number = 0;
    static height: number = 0;

    static boundTop: number = 0;
    static boundBottom: number = 0;
    static boundLeft: number = 0;
    static boundRight: number = 0;
    static clipX: number = 0;

    static centerX: number = 0;
    static centerY: number = 0;

    // jag::oldscape::graphics::Pix2D::SetPixels
    static setPixels(pixels: Int32Array, width: number, height: number): void {
        this.pixels = pixels;
        this.width = width;
        this.height = height;
        this.setClipping(0, 0, width, height);
    }

    // jag::oldscape::graphics::Pix2D::ResetClipping
    static resetClipping(): void {
        this.boundLeft = 0;
        this.boundTop = 0;
        this.boundRight = this.width;
        this.boundBottom = this.height;
        this.clipX = this.boundRight - 1;
        this.centerX = (this.boundRight / 2) | 0;
    }

    // jag::oldscape::graphics::Pix2D::SetClipping
    static setClipping(left: number, top: number, right: number, bottom: number): void {
        if (left < 0) {
            left = 0;
        }

        if (top < 0) {
            top = 0;
        }

        if (right > this.width) {
            right = this.width;
        }

        if (bottom > this.height) {
            bottom = this.height;
        }

        this.boundTop = top;
        this.boundBottom = bottom;
        this.boundLeft = left;
        this.boundRight = right;
        this.clipX = this.boundRight - 1;
        this.centerX = (this.boundRight / 2) | 0;
        this.centerY = (this.boundBottom / 2) | 0;
    }

    // jag::oldscape::graphics::NXTPix2D::Cls
    static cls(): void {
        const len: number = this.width * this.height;
        for (let i: number = 0; i < len; i++) {
            this.pixels[i] = 0;
        }
    }

    // jag::oldscape::graphics::NXTPix2D::FillRectTrans
    static fillRectTrans(x: number, y: number, width: number, height: number, rgb: number, alpha: number): void {
        if (x < this.boundLeft) {
            width -= this.boundLeft - x;
            x = this.boundLeft;
        }

        if (y < this.boundTop) {
            height -= this.boundTop - y;
            y = this.boundTop;
        }

        if (x + width > this.boundRight) {
            width = this.boundRight - x;
        }

        if (y + height > this.boundBottom) {
            height = this.boundBottom - y;
        }

        const invAlpha: number = 256 - alpha;
        const r0: number = ((rgb >> 16) & 0xff) * alpha;
        const g0: number = ((rgb >> 8) & 0xff) * alpha;
        const b0: number = (rgb & 0xff) * alpha;
        const step: number = this.width - width;
        let offset: number = x + y * this.width;
        for (let i: number = 0; i < height; i++) {
            for (let j: number = -width; j < 0; j++) {
                const r1: number = ((this.pixels[offset] >> 16) & 0xff) * invAlpha;
                const g1: number = ((this.pixels[offset] >> 8) & 0xff) * invAlpha;
                const b1: number = (this.pixels[offset] & 0xff) * invAlpha;
                const color: number = (((r0 + r1) >> 8) << 16) + (((g0 + g1) >> 8) << 8) + ((b0 + b1) >> 8);
                this.pixels[offset++] = color;
            }
            offset += step;
        }
    }

    // jag::oldscape::graphics::NXTPix2D::FillRect
    static fillRect(x: number, y: number, width: number, height: number, color: number): void {
        if (x < this.boundLeft) {
            width -= this.boundLeft - x;
            x = this.boundLeft;
        }

        if (y < this.boundTop) {
            height -= this.boundTop - y;
            y = this.boundTop;
        }

        if (x + width > this.boundRight) {
            width = this.boundRight - x;
        }

        if (y + height > this.boundBottom) {
            height = this.boundBottom - y;
        }

        const step: number = this.width - width;
        let offset: number = x + y * this.width;
        for (let i: number = -height; i < 0; i++) {
            for (let j: number = -width; j < 0; j++) {
                this.pixels[offset++] = color;
            }

            offset += step;
        }
    }

    // jag::oldscape::graphics::Pix2D::DrawRect
    static drawRect(x: number, y: number, w: number, h: number, color: number): void {
        this.hline(x, y, color, w);
        this.hline(x, y + h - 1, color, w);
        this.vline(x, y, color, h);
        this.vline(x + w - 1, y, color, h);
    }

    // jag::oldscape::graphics::Pix2D::DrawRectTrans
    static drawRectTrans(x: number, y: number, w: number, h: number, color: number, alpha: number): void {
        this.hlineTrans(x, y, color, w, alpha);
        this.hlineTrans(x, y + h - 1, color, w, alpha);
        if (h >= 3) {
            this.vlineTrans(x, y, color, h, alpha);
            this.vlineTrans(x + w - 1, y, color, h, alpha);
        }
    }

    // jag::oldscape::graphics::NXTPix2D::HLine
    static hline(x: number, y: number, color: number, width: number): void {
        if (y < this.boundTop || y >= this.boundBottom) {
            return;
        }

        if (x < this.boundLeft) {
            width -= this.boundLeft - x;
            x = this.boundLeft;
        }

        if (x + width > this.boundRight) {
            width = this.boundRight - x;
        }

        const off: number = x + y * this.width;
        for (let i: number = 0; i < width; i++) {
            this.pixels[off + i] = color;
        }
    }

    // jag::oldscape::graphics::NXTPix2D::HLineTrans
    static hlineTrans(x: number, y: number, color: number, width: number, alpha: number): void {
        if (y < this.boundTop || y >= this.boundBottom) {
            return;
        }

        if (x < this.boundLeft) {
            width -= this.boundLeft - x;
            x = this.boundLeft;
        }

        if (x + width > this.boundRight) {
            width = this.boundRight - x;
        }

        const invAlpha: number = 256 - alpha;
        const r0: number = ((color >> 16) & 0xff) * alpha;
        const g0: number = ((color >> 8) & 0xff) * alpha;
        const b0: number = (color & 0xff) * alpha;
        const _step: number = this.width - width;
        let offset: number = x + y * this.width;
        for (let i: number = 0; i < width; i++) {
            const r1: number = ((this.pixels[offset] >> 16) & 0xff) * invAlpha;
            const g1: number = ((this.pixels[offset] >> 8) & 0xff) * invAlpha;
            const b1: number = (this.pixels[offset] & 0xff) * invAlpha;
            const color: number = (((r0 + r1) >> 8) << 16) + (((g0 + g1) >> 8) << 8) + ((b0 + b1) >> 8);
            this.pixels[offset++] = color;
        }
    };

    // jag::oldscape::graphics::NXTPix2D::VLine
    static vline(x: number, y: number, color: number, height: number): void {
        if (x < this.boundLeft || x >= this.boundRight) {
            return;
        }

        if (y < this.boundTop) {
            height -= this.boundTop - y;
            y = this.boundTop;
        }

        if (y + height > this.boundBottom) {
            height = this.boundBottom - y;
        }

        const off: number = x + y * this.width;
        for (let i: number = 0; i < height; i++) {
            this.pixels[off + i * this.width] = color;
        }
    }

    // jag::oldscape::graphics::NXTPix2D::VLineTrans
    static vlineTrans(x: number, y: number, color: number, height: number, alpha: number): void {
        if (x < this.boundLeft || x >= this.boundRight) {
            return;
        }

        if (y < this.boundTop) {
            height -= this.boundTop - y;
            y = this.boundTop;
        }

        if (y + height > this.boundBottom) {
            height = this.boundBottom - y;
        }

        const invAlpha: number = 256 - alpha;
        const r0: number = ((color >> 16) & 0xff) * alpha;
        const g0: number = ((color >> 8) & 0xff) * alpha;
        const b0: number = (color & 0xff) * alpha;
        let offset: number = x + y * this.width;
        for (let i: number = 0; i < height; i++) {
            const r1: number = ((this.pixels[offset] >> 16) & 0xff) * invAlpha;
            const g1: number = ((this.pixels[offset] >> 8) & 0xff) * invAlpha;
            const b1: number = (this.pixels[offset] & 0xff) * invAlpha;
            const color: number = (((r0 + r1) >> 8) << 16) + (((g0 + g1) >> 8) << 8) + ((b0 + b1) >> 8);
            this.pixels[offset] = color;
            offset += this.width;
        }
    };

    // jag::oldscape::graphics::NXTPix2D::FillCircle
    static fillCircle(xCenter: number, yCenter: number, yRadius: number, rgb: number, alpha: number): void {
        const invAlpha: number = 256 - alpha;
        const r0: number = ((rgb >> 16) & 0xff) * alpha;
        const g0: number = ((rgb >> 8) & 0xff) * alpha;
        const b0: number = (rgb & 0xff) * alpha;

        let yStart: number = yCenter - yRadius;
        if (yStart < 0) {
            yStart = 0;
        }

        let yEnd: number = yCenter + yRadius;
        if (yEnd >= this.height) {
            yEnd = this.height - 1;
        }

        for (let y: number = yStart; y <= yEnd; y++) {
            const midpoint: number = y - yCenter;
            const xRadius: number = Math.sqrt(yRadius * yRadius - midpoint * midpoint) | 0;

            let xStart: number = xCenter - xRadius;
            if (xStart < 0) {
                xStart = 0;
            }

            let xEnd: number = xCenter + xRadius;
            if (xEnd >= this.width) {
                xEnd = this.width - 1;
            }

            let offset: number = xStart + y * this.width;
            for (let x: number = xStart; x <= xEnd; x++) {
                const r1: number = ((this.pixels[offset] >> 16) & 0xff) * invAlpha;
                const g1: number = ((this.pixels[offset] >> 8) & 0xff) * invAlpha;
                const b1: number = (this.pixels[offset] & 0xff) * invAlpha;
                const color: number = (((r0 + r1) >> 8) << 16) + (((g0 + g1) >> 8) << 8) + ((b0 + b1) >> 8);
                this.pixels[offset++] = color;
            }
        }
    }
}
