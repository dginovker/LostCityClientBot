import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

export default class VarpType {
    static count: number = 0;
    static list: VarpType[] = [];

    clientcode: number = 0;

    static unpack(config: Jagfile): void {
        const dat: Packet = new Packet(config.read('varp.dat'));

        this.count = dat.g2();
        this.list = new Array(this.count);

        for (let id: number = 0; id < this.count; id++) {
            if (!this.list[id]) {
                this.list[id] = new VarpType();
            }

            this.list[id].decode(dat);
        }

        if (dat.pos != dat.data.length) {
			console.log('varptype load mismatch');
		}
    }

    decode(dat: Packet): void {
        while (true) {
            const code = dat.g1();
            if (code === 0) {
                break;
            }

            if (code === 1) {
                dat.pos += 1;
            } else if (code === 2) {
                dat.pos += 1;
            } else if (code === 3) {
            } else if (code === 4) {
            } else if (code === 5) {
                this.clientcode = dat.g2();
            } else if (code === 6) {
            } else if (code === 7) {
                dat.pos += 4;
            } else if (code === 8) {
            } else if (code === 10) {
                dat.gjstr();
            } else if (code === 11) {
            } else {
                console.log('Error unrecognised config code: ', code);
            }
        }
    }
}
