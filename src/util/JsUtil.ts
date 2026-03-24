export const sleep = async (ms: number): Promise<void> => new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, ms));

// Strip leading slash to make URLs relative (needed for GitHub Pages subdirectory hosting)
// Throws on non-ok responses so CRC-suffix fallback in getJagFile works
export const downloadUrl = async (url: string): Promise<Uint8Array> => {
    const res = await fetch(url.startsWith('/') ? url.slice(1) : url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
};

export const downloadText = async (url: string): Promise<string> => (await fetch(url.startsWith('/') ? url.slice(1) : url)).text();

export function arraycopy(src: Int32Array | Uint8Array, srcPos: number, dst: Int32Array | Uint8Array, dstPos: number, length: number): void {
    while (length--) dst[dstPos++] = src[srcPos++];
}

export function bytesToBigInt(bytes: Uint8Array): bigint {
    let result: bigint = 0n;
    for (let index: number = 0; index < bytes.length; index++) {
        result = (result << 8n) | BigInt(bytes[index]);
    }
    return result;
}

export function bigIntToBytes(bigInt: bigint): Uint8Array {
    const bytes: number[] = [];
    while (bigInt > 0n) {
        bytes.unshift(Number(bigInt & 0xffn));
        bigInt >>= 8n;
    }

    if (bytes[0] & 0x80) {
        bytes.unshift(0);
    }

    return new Uint8Array(bytes);
}

export function bigIntModPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result: bigint = 1n;
    while (exponent > 0n) {
        if (exponent % 2n === 1n) {
            result = (result * base) % modulus;
        }
        base = (base * base) % modulus;
        exponent >>= 1n;
    }
    return result;
}
