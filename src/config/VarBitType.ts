import { ConfigType } from '#/config/ConfigType.js';

import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

export default class VarBitType extends ConfigType {
    static count: number = 0;
    static types: VarBitType[] = [];
    debugname: string = '';
    basevar: number = -1;
    startbit: number = 0;
    endbit: number = 0;

    static unpack(config: Jagfile): void {
        const dat: Packet = new Packet(config.read('varbit.dat'));
        this.count = dat.g2();
        for (let i: number = 0; i < this.count; i++) {
            this.types[i] = new VarBitType(i).unpackType(dat);
        }
    }

    unpack(code: number, dat: Packet): void {
        if (code === 1) {
            this.basevar = dat.g2();
            this.startbit = dat.g1();
            this.endbit = dat.g1();
        } else if (code === 10) {
            this.debugname = dat.gjstr();
        } else {
            console.log('Error unrecognised config code: ', code);
        }
    }
}
