export const canvas: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;
export const canvas2d: CanvasRenderingContext2D = canvas?.getContext('2d', { willReadFrequently: true })!;

export const jpegCanvas: HTMLCanvasElement = document.createElement('canvas');
export const jpegImg: HTMLImageElement = document.createElement('img');
export const jpeg2d: CanvasRenderingContext2D = jpegCanvas.getContext('2d', { willReadFrequently: true })!;

export function saveDataURL(dataURL: string, filename: string) {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
