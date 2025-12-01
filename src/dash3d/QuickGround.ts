export default class QuickGround {
    readonly swColour: number;
    readonly seColour: number;
    readonly neColour: number;
    readonly nwColour: number;
    readonly textureId: number;
    readonly rgb: number;
    readonly flat: boolean;

    constructor(southwestColor: number, southeastColor: number, northeastColor: number, northwestColor: number, textureId: number, color: number, flat: boolean) {
        this.swColour = southwestColor;
        this.seColour = southeastColor;
        this.neColour = northeastColor;
        this.nwColour = northwestColor;
        this.textureId = textureId;
        this.rgb = color;
        this.flat = flat;
    }
}
