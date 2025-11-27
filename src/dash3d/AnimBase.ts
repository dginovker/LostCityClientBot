import Packet from '#/io/Packet.js';

import { TypedArray1d } from '#/util/Arrays.js';

// jag::oldscape::dash3d::AnimBase
export default class AnimBase {
    size: number = 0;
    type: Uint8Array | null = null; // jag::graphics::AnimBase::GetTransformType
    labels: (Uint8Array | null)[] | null = null; // jag::graphics::AnimBase::GetTransformLabels

    constructor(buf: Packet) {
        this.size = buf.g1();

        this.type = new Uint8Array(this.size);
        this.labels = new TypedArray1d(this.size, null);

        for (let i = 0; i < this.size; i++) {
            this.type[i] = buf.g1();
        }

        for (let i = 0; i < this.size; i++) {
            const count = buf.g1();
            this.labels[i] = new Uint8Array(count);

            for (let j = 0; j < count; j++) {
                this.labels[i]![j] = buf.g1();
            }
        }
    }
}
