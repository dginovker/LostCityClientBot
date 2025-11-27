import { ConfigType } from '#/config/ConfigType.js';

import AnimFrame from '#/dash3d/AnimFrame.js';

import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

export const enum PreanimMove {
    DELAYMOVE = 0,
    DELAYANIM = 1,
    MERGE = 2
}

export const enum PostanimMove {
    DELAYMOVE = 0,
    ABORTANIM = 1,
    MERGE = 2
}

export const enum RestartMode {
    RESET = 1,
    RESETLOOP = 2
}

export default class SeqType extends ConfigType {
    static count: number = 0;
    static list: SeqType[] = [];

    numFrames: number = 0; // jag::oldscape::configdecoder::SeqType::GetNumFrames
    frames: Int16Array | null = null;
    iframes: Int16Array | null = null;
    delay: Int16Array | null = null;
    loops: number = -1; // jag::game::SeqType::GetLoops
    walkmerge: Int32Array | null = null;
    stretches: boolean = false;
    priority: number = 5; // jag::game::SeqType::GetPriority
    replaceheldleft: number = -1; // jag::game::SeqType::GetReplaceHeldLeft
    replaceheldright: number = -1; // jag::game::SeqType::GetReplaceHeldRight
    maxloops: number = 99; // jag::game::SeqType::GetMaxLoops
    preanim_move: number = -1; // jag::game::SeqType::GetPreanimMove
    postanim_move: number = -1; // jag::game::SeqType::GetPostanimMove
    duplicatebehavior: number = -1; // jag::game::SeqType::GetDuplicateBehaviour

    static unpack(config: Jagfile): void {
        const dat: Packet = new Packet(config.read('seq.dat'));

        this.count = dat.g2();
        this.list = new Array(this.count);

        for (let id: number = 0; id < this.count; id++) {
            if (!this.list[id]) {
                this.list[id] = new SeqType(id);
            }

            const seq = this.list[id].decodeType(dat);

            if (seq.preanim_move === -1) {
                if (seq.walkmerge === null) {
                    seq.preanim_move = PreanimMove.DELAYMOVE;
                } else {
                    seq.preanim_move = PreanimMove.MERGE;
                }
            }

            if (seq.postanim_move === -1) {
                if (seq.walkmerge === null) {
                    seq.postanim_move = PostanimMove.DELAYMOVE;
                } else {
                    seq.postanim_move = PostanimMove.MERGE;
                }
            }

            if (seq.numFrames === 0) {
                seq.numFrames = 1;

                seq.frames = new Int16Array(1);
                seq.frames[0] = -1;

                seq.iframes = new Int16Array(1);
                seq.iframes[0] = -1;

                seq.delay = new Int16Array(1);
                seq.delay[0] = -1;
            }
        }
    }

    // jag::oldscape::configdecoder::SeqType::GetDuration
    getDuration(frame: number) {
        if (!this.delay || !this.frames) {
            return 0;
        }

        let duration = this.delay[frame];

        if (duration === 0) {
            let transform = AnimFrame.get(this.frames[frame]);
            if (transform != null) {
                duration = this.delay[frame] = transform.delay;
            }
        }

        if (duration === 0) {
            duration = 1;
        }

        return duration;
    }

    decode(code: number, dat: Packet): void {
        if (code === 1) {
            this.numFrames = dat.g1();
            this.frames = new Int16Array(this.numFrames);
            this.iframes = new Int16Array(this.numFrames);
            this.delay = new Int16Array(this.numFrames);

            for (let i: number = 0; i < this.numFrames; i++) {
                this.frames[i] = dat.g2();

                this.iframes[i] = dat.g2();
                if (this.iframes[i] === 65535) {
                    this.iframes[i] = -1;
                }

                this.delay[i] = dat.g2();
            }
        } else if (code === 2) {
            this.loops = dat.g2();
        } else if (code === 3) {
            const count: number = dat.g1();
            this.walkmerge = new Int32Array(count + 1);

            for (let i: number = 0; i < count; i++) {
                this.walkmerge[i] = dat.g1();
            }

            this.walkmerge[count] = 9999999;
        } else if (code === 4) {
            this.stretches = true;
        } else if (code === 5) {
            this.priority = dat.g1();
        } else if (code === 6) {
            this.replaceheldleft = dat.g2();
        } else if (code === 7) {
            this.replaceheldright = dat.g2();
        } else if (code === 8) {
            this.maxloops = dat.g1();
        } else if (code === 9) {
            this.preanim_move = dat.g1();
        } else if (code === 10) {
            this.postanim_move = dat.g1();
        } else if (code === 11) {
            this.duplicatebehavior = dat.g1();
        } else {
            console.log('Error unrecognised seq config code: ', code);
        }
    }
}
