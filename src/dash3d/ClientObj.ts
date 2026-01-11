import ObjType from '#/config/ObjType.js';
import type Model from '#/dash3d/Model.js';
import ModelSource from '#/dash3d/ModelSource.js';

export default class ClientObj extends ModelSource {
    readonly id: number;
    count: number;

    constructor(id: number, count: number) {
        super();
        this.id = id;
        this.count = count;
    }

    // jag::oldscape::ClientObj::GetTempModel
    getTempModel(): Model | null {
        const obj = ObjType.get(this.id);
        return obj.getModel(this.count);
    }
}
