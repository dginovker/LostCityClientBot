import SpotAnimType from '#/config/SpotAnimType.js';

import AnimFrame from '#/dash3d/AnimFrame.js';
import Model from '#/dash3d/Model.js';
import ModelSource from '#/dash3d/ModelSource.js';

export default class ClientProj extends ModelSource {
    readonly graphic: SpotAnimType;
    readonly level: number;
    readonly srcX: number;
    readonly srcZ: number;
    readonly srcY: number;
    readonly dstHeight: number;
    readonly startCycle: number;
    readonly endCycle: number;
    readonly peak: number;
    readonly arc: number;
    readonly target: number;

    mobile: boolean = false;
    x: number = 0.0;
    z: number = 0.0;
    y: number = 0.0;
    velocityX: number = 0.0;
    velocityZ: number = 0.0;
    velocity: number = 0.0;
    velocityY: number = 0.0;
    accelerationY: number = 0.0;
    yaw: number = 0;
    pitch: number = 0;
    seqFrame: number = 0;
    seqCycle: number = 0;

    constructor(spotanim: number, level: number, srcX: number, srcY: number, srcZ: number, startCycle: number, lastCycle: number, peakPitch: number, arc: number, target: number, offsetY: number) {
        super();
        this.graphic = SpotAnimType.list[spotanim];
        this.level = level;
        this.srcX = srcX;
        this.srcZ = srcZ;
        this.srcY = srcY;
        this.startCycle = startCycle;
        this.endCycle = lastCycle;
        this.peak = peakPitch;
        this.arc = arc;
        this.target = target;
        this.dstHeight = offsetY;
        this.mobile = false;
    }

    // jag::oldscape::ClientProj::SetTarget
    setTarget(dstX: number, dstY: number, dstZ: number, cycle: number): void {
        if (!this.mobile) {
            const dx: number = dstX - this.srcX;
            const dz: number = dstZ - this.srcZ;
            const d: number = Math.sqrt(dx * dx + dz * dz);

            this.x = this.srcX + (dx * this.arc) / d;
            this.z = this.srcZ + (dz * this.arc) / d;
            this.y = this.srcY;
        }

        const dt: number = this.endCycle + 1 - cycle;
        this.velocityX = (dstX - this.x) / dt;
        this.velocityZ = (dstZ - this.z) / dt;
        this.velocity = Math.sqrt(this.velocityX * this.velocityX + this.velocityZ * this.velocityZ);
        if (!this.mobile) {
            this.velocityY = -this.velocity * Math.tan(this.peak * 0.02454369);
        }
        this.accelerationY = ((dstY - this.y - this.velocityY * dt) * 2.0) / (dt * dt);
    }

    // jag::oldscape::ClientProj::Move
    move(delta: number): void {
        this.mobile = true;
        this.x += this.velocityX * delta;
        this.z += this.velocityZ * delta;
        this.y += this.velocityY * delta + this.accelerationY * 0.5 * delta * delta;
        this.velocityY += this.accelerationY * delta;
        this.yaw = ((Math.atan2(this.velocityX, this.velocityZ) * 325.949 + 1024) | 0) & 0x7ff;
        this.pitch = ((Math.atan2(this.velocityY, this.velocity) * 325.949) | 0) & 0x7ff;

        if (this.graphic.seq) {
            this.seqCycle += delta;

            while (this.seqCycle > this.graphic.seq.getDuration(this.seqFrame)) {
                this.seqCycle -= this.graphic.seq.getDuration(this.seqFrame) + 1;
                this.seqFrame++;
                if (this.seqFrame >= this.graphic.seq.numFrames) {
                    this.seqFrame = 0;
                }
            }
        }
    }

    // jag::oldscape::ClientProj::GetTempModel
    getTempModel(): Model | null {
        const spotModel: Model | null = this.graphic.getTempModel();
        if (!spotModel) {
            return null;
        }

        let frame = -1;
        if (this.graphic.seq && this.graphic.seq.frames) {
            frame = this.graphic.seq.frames[this.seqFrame];
        }

        const model: Model = Model.copyForAnim(spotModel, true, AnimFrame.shareAlpha(frame), false);

        if (frame !== -1) {
            model.prepareAnim();
            model.animate(frame);
            model.labelFaces = null;
            model.labelVertices = null;
        }

        if (this.graphic.resizeh !== 128 || this.graphic.resizev !== 128) {
            model.resize(this.graphic.resizeh, this.graphic.resizev, this.graphic.resizeh);
        }

        model.rotateXAxis(this.pitch);
        model.calculateNormals(64 + this.graphic.ambient, 850 + this.graphic.contrast, -30, -50, -30, true);
        return model;
    }
}
