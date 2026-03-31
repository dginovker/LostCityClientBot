export const canvas: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;

// High-DPI fix: render into an offscreen canvas at game resolution,
// then blit to the visible canvas at physical pixel resolution using
// nearest-neighbor scaling. This avoids the blurry non-integer DPR
// upscaling that browsers do even with image-rendering: pixelated.
const dpr = window.devicePixelRatio || 1;

// Offscreen canvas at game resolution for the engine to render into
const offscreen = document.createElement('canvas');
offscreen.width = canvas.width;
offscreen.height = canvas.height;

export const canvas2d: CanvasRenderingContext2D = offscreen.getContext('2d', {
    desynchronized: false,
    alpha: false
})!;

// Display context for blitting offscreen → visible
const displayCtx: CanvasRenderingContext2D = canvas.getContext('2d', {
    desynchronized: false,
    alpha: false
})!;

export function resizeCanvas(width: number, height: number): void {
    offscreen.width = width;
    offscreen.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    displayCtx.imageSmoothingEnabled = false;
}

// Initialize with the HTML-defined dimensions
resizeCanvas(offscreen.width, offscreen.height);

/** Game resolution (logical pixels, not physical) */
export function gameWidth(): number { return offscreen.width; }
export function gameHeight(): number { return offscreen.height; }

export function blitToScreen(): void {
    displayCtx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
}

export function saveDataURL(dataURL: string, filename: string) {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
