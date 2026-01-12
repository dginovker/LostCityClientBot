import LocType from '#/config/LocType.js';
import SeqType from '#/config/SeqType.js';
import type Model from '#/dash3d/Model.js';

import ModelSource from '#/dash3d/ModelSource.js';

export default class ClientLocAnim extends ModelSource {
    readonly index: number;
    readonly shape: number;
    readonly angle: number;
    readonly hmapSW: number;
    readonly hmapSE: number;
    readonly hmapNE: number;
    readonly hmapNW: number;
    seq: SeqType | null;
    seqFrame: number;
    seqCycle: number;

    constructor(loopCycle: number, index: number, shape: number, angle: number, heightmapSW: number, heightmapSE: number, heightmapNE: number, heightmapNW: number, seq: number, randomFrame: boolean) {
        super();

        this.index = index;
        this.shape = shape;
        this.angle = angle;

        this.hmapSW = heightmapSW;
        this.hmapSE = heightmapSE;
        this.hmapNE = heightmapNE;
        this.hmapNW = heightmapNW;

        this.seq = SeqType.list[seq];
        this.seqFrame = 0;
        this.seqCycle = loopCycle;

        if (randomFrame && this.seq.loops !== -1) {
            this.seqFrame = (Math.random() * this.seq.numFrames) | 0;
            this.seqCycle -= (Math.random() * this.seq.getDuration(this.seqFrame)) | 0;
        }
    }

    // jag::oldscape::ClientLocAnim::GetTempModel
    override getTempModel(loopCycle: number): Model | null {
        if (this.seq) {
            let delta = loopCycle - this.seqCycle;
            if (delta > 100 && this.seq.loops > 0) {
                delta = 100;
            }

            while (delta > this.seq.getDuration(this.seqFrame)) {
                delta -= this.seq.getDuration((this.seqFrame));
                this.seqFrame++;

                if (this.seqFrame < this.seq.numFrames) {
                    continue;
                }

                this.seqFrame -= this.seq.loops;

                if (this.seqFrame < 0 || this.seqFrame >= this.seq.numFrames) {
                    this.seq = null;
                    break;
                }
            }

            this.seqCycle = loopCycle - delta;
        }

        let frame = -1;
        if (this.seq && this.seq.frames && typeof this.seq.frames[this.seqFrame] !== 'undefined') {
            frame = this.seq.frames[this.seqFrame];
        }

        const loc = LocType.get(this.index);
        return loc.getModel(this.shape, this.angle, this.hmapSW, this.hmapSE, this.hmapNE, this.hmapNW, frame);
    }
}
