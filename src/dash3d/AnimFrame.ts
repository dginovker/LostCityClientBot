import AnimBase from '#/dash3d/AnimBase.js';

import Packet from '#/io/Packet.js';

// jag::oldscape::dash3d::AnimFrame
export default class AnimFrame {
    static list: AnimFrame[] = [];
    delay: number = -1;
    base: AnimBase | null = null;
    size: number = 0;
    tempTi: Int32Array | null = null; // jag::oldscape::dash3d::AnimFrame::m_tempTi
    tempTx: Int32Array | null = null; // jag::oldscape::dash3d::AnimFrame::m_tempTx
    tempTy: Int32Array | null = null; // jag::oldscape::dash3d::AnimFrame::m_tempTy
    tempTz: Int32Array | null = null; // jag::oldscape::dash3d::AnimFrame::m_tempTz
    static opaque: boolean[] = [];

    static init(total: number) {
        this.list = new Array(total + 1);
        this.opaque = new Array(total + 1);
        for (let i = 0; i < total + 1; i++) {
            this.opaque[i] = true;
        }
    }

    static unpack(data: Uint8Array) {
        const buf = new Packet(data);
        buf.pos = data.length - 8;

        const headLength = buf.g2();
        const tran1Length = buf.g2();
        const tran2Length = buf.g2();
        const delLength = buf.g2();
        let pos = 0;

		const head = new Packet(data);
		head.pos = pos;
		pos += headLength + 2;

		const tran1 = new Packet(data);
		tran1.pos = pos;
		pos += tran1Length;

		const tran2 = new Packet(data);
		tran2.pos = pos;
		pos += tran2Length;

		const del = new Packet(data);
		del.pos = pos;
		pos += delLength;

		const baseBuf = new Packet(data);
		baseBuf.pos = pos;
		const base = new AnimBase(baseBuf);

        const total = head.g2();
        const labels: Int32Array = new Int32Array(500);
        const x: Int32Array = new Int32Array(500);
        const y: Int32Array = new Int32Array(500);
        const z: Int32Array = new Int32Array(500);

        for (let i: number = 0; i < total; i++) {
            const id: number = head.g2();

            const frame: AnimFrame = (this.list[id] = new AnimFrame());
            frame.delay = del.g1();
            frame.base = base;

            const groupCount: number = head.g1();
            let lastGroup: number = -1;
            let current: number = 0;

            for (let j: number = 0; j < groupCount; j++) {
                if (!base.type) {
                    throw new Error();
                }

                const flags: number = tran1.g1();
                if (flags > 0) {
                    if (base.type[j] !== 0) {
                        for (let group: number = j - 1; group > lastGroup; group--) {
                            if (base.type[group] === 0) {
                                labels[current] = group;
                                x[current] = 0;
                                y[current] = 0;
                                z[current] = 0;
                                current++;
                                break;
                            }
                        }
                    }

                    labels[current] = j;

                    let defaultValue: number = 0;
                    if (base.type[labels[current]] === 3) {
                        defaultValue = 128;
                    }

                    if ((flags & 0x1) === 0) {
                        x[current] = defaultValue;
                    } else {
                        x[current] = tran2.gsmart();
                    }

                    if ((flags & 0x2) === 0) {
                        y[current] = defaultValue;
                    } else {
                        y[current] = tran2.gsmart();
                    }

                    if ((flags & 0x4) === 0) {
                        z[current] = defaultValue;
                    } else {
                        z[current] = tran2.gsmart();
                    }

                    lastGroup = j;
                    current++;

                    if (base.type[j] === 5) {
                        this.opaque[id] = false;
                    }
                }
            }

            frame.size = current;
            frame.tempTi = new Int32Array(current);
            frame.tempTx = new Int32Array(current);
            frame.tempTy = new Int32Array(current);
            frame.tempTz = new Int32Array(current);

            for (let j: number = 0; j < current; j++) {
                frame.tempTi[j] = labels[j];
                frame.tempTx[j] = x[j];
                frame.tempTy[j] = y[j];
                frame.tempTz[j] = z[j];
            }
        }
    }

    static get(id: number) {
        return AnimFrame.list[id];
    }

    static shareAlpha(frame: number) {
        return frame === -1;
    }
}
