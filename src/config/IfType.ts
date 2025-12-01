import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

import Model from '#/dash3d/Model.js';
import PixFont from '#/graphics/PixFont.js';

import LruCache from '#/datastruct/LruCache.js';
import JString from '#/datastruct/JString.js';

import Pix32 from '#/graphics/Pix32.js';

import { TypedArray1d } from '#/util/Arrays.js';
import NpcType from '#/config/NpcType.js';
import ObjType from '#/config/ObjType.js';
import type ClientPlayer from '#/dash3d/ClientPlayer.js';

export const enum ComponentType {
    TYPE_LAYER = 0,
    TYPE_UNUSED = 1, // TODO
    TYPE_INV = 2,
    TYPE_RECT = 3,
    TYPE_TEXT = 4,
    TYPE_GRAPHIC = 5,
    TYPE_MODEL = 6,
    TYPE_INV_TEXT = 7,
};

export const enum ButtonType {
    BUTTON_OK = 1,
    BUTTON_TARGET = 2,
    BUTTON_CLOSE = 3,
    BUTTON_TOGGLE = 4,
    BUTTON_SELECT = 5,
    BUTTON_CONTINUE = 6,
};

export default class IfType {
    static list: IfType[] = []; // jag::oldscape::rs2lib::IfType::m_list
    static modelCache: LruCache = new LruCache(30); // jag::oldscape::rs2lib::IfType::m_modelCache
    static spriteCache: LruCache | null = null; // jag::oldscape::rs2lib::IfType::m_spriteCache

    seqFrame: number = 0;
    seqCycle: number = 0;
    id: number = -1;
    layerId: number = -1;
    type: number = -1;
    buttonType: number = -1;
    clientCode: number = 0;
    width: number = 0;
    height: number = 0;
    transparency: number = 0;
    overlayer: number = -1;
    x: number = 0;
    y: number = 0;
    scripts: (Uint16Array | null)[] | null = null;
    scriptComparator: Uint8Array | null = null;
    scriptOperand: Uint16Array | null = null;
    scrollSize: number = 0;
    scrollPos: number = 0;
    hidden: boolean = false;
    children: number[] | null = null;
    childX: number[] | null = null;
    childY: number[] | null = null;
    linkObjType: Int32Array | null = null;
    linkObjCount: Int32Array | null = null;
    draggable: boolean = false;
    interactable: boolean = false;
    usable: boolean = false;
    swappable: boolean = false;
    marginX: number = 0;
    marginY: number = 0;
    invSlotOffsetX: Int16Array | null = null;
    invSlotOffsetY: Int16Array | null = null;
    invSlotGraphic: (Pix32 | null)[] | null = null;
    iop: (string | null)[] | null = null;
    fill: boolean = false;
    center: boolean = false;
    font: PixFont | null = null;
    shadowed: boolean = false;
    text: string | null = null;
    text2: string | null = null;
    colour: number = 0;
    colour2: number = 0;
    colourOver: number = 0;
    colour2Over: number = 0;
    graphic: Pix32 | null = null;
    graphic2: Pix32 | null = null;
    modelType: number = 0;
    modelId: number = 0;
    model2Id: number = 0;
    model2Type: number = 0;
    modelAnim: number = -1;
    model2Anim: number = -1;
    modelZoom: number = 0;
    modelXAn: number = 0;
    modelYAn: number = 0;
    targetVerb: string | null = null;
    targetText: string | null = null;
    targetMask: number = -1;
    option: string | null = null;

    static unpack(interfaces: Jagfile, media: Jagfile | null, fonts: PixFont[]): void {
        this.spriteCache = new LruCache(50000);

        const data: Packet = new Packet(interfaces.read('data'));
        let layer: number = -1;

        const count = data.g2();
        this.list = new Array(count);

        while (data.pos < data.length) {
            let id: number = data.g2();
            if (id === 65535) {
                layer = data.g2();
                id = data.g2();
            }

            const com: IfType = (this.list[id] = new IfType());
            com.id = id;
            com.layerId = layer;
            com.type = data.g1();
            com.buttonType = data.g1();
            com.clientCode = data.g2();
            com.width = data.g2();
            com.height = data.g2();
            com.transparency = data.g1();

            com.overlayer = data.g1();
            if (com.overlayer === 0) {
                com.overlayer = -1;
            } else {
                com.overlayer = ((com.overlayer - 1) << 8) + data.g1();
            }

            const comparatorCount: number = data.g1();
            if (comparatorCount > 0) {
                com.scriptComparator = new Uint8Array(comparatorCount);
                com.scriptOperand = new Uint16Array(comparatorCount);

                for (let i: number = 0; i < comparatorCount; i++) {
                    com.scriptComparator[i] = data.g1();
                    com.scriptOperand[i] = data.g2();
                }
            }

            const scriptCount: number = data.g1();
            if (scriptCount > 0) {
                com.scripts = new TypedArray1d(scriptCount, null);

                for (let i: number = 0; i < scriptCount; i++) {
                    const opcodeCount: number = data.g2();

                    const script: Uint16Array = new Uint16Array(opcodeCount);
                    com.scripts[i] = script;
                    for (let j: number = 0; j < opcodeCount; j++) {
                        script[j] = data.g2();
                    }
                }
            }

            if (com.type === ComponentType.TYPE_LAYER) {
                com.scrollSize = data.g2();
                com.hidden = data.g1() === 1;

                const childCount: number = data.g2();
                com.children = new Array(childCount);
                com.childX = new Array(childCount);
                com.childY = new Array(childCount);

                for (let i: number = 0; i < childCount; i++) {
                    com.children[i] = data.g2();
                    com.childX[i] = data.g2b();
                    com.childY[i] = data.g2b();
                }
            }

            if (com.type === ComponentType.TYPE_UNUSED) {
                data.pos += 3;
            }

            if (com.type === ComponentType.TYPE_INV) {
                com.linkObjType = new Int32Array(com.width * com.height);
                com.linkObjCount = new Int32Array(com.width * com.height);

                com.draggable = data.g1() === 1;
                com.interactable = data.g1() === 1;
                com.usable = data.g1() === 1;
                com.swappable = data.g1() === 1;
                com.marginX = data.g1();
                com.marginY = data.g1();

                com.invSlotOffsetX = new Int16Array(20);
                com.invSlotOffsetY = new Int16Array(20);
                com.invSlotGraphic = new TypedArray1d(20, null);

                for (let i: number = 0; i < 20; i++) {
                    if (data.g1() === 1) {
                        com.invSlotOffsetX[i] = data.g2b();
                        com.invSlotOffsetY[i] = data.g2b();

                        const graphic: string = data.gjstr();
                        if (media && graphic.length > 0) {
                            const spriteIndex: number = graphic.lastIndexOf(',');
                            com.invSlotGraphic[i] = this.getImage(media, graphic.substring(0, spriteIndex), parseInt(graphic.substring(spriteIndex + 1)));
                        }
                    }
                }

                com.iop = new TypedArray1d(5, null);
                for (let i: number = 0; i < 5; i++) {
                    com.iop[i] = data.gjstr();
                    if (com.iop[i]!.length === 0) {
                        com.iop[i] = null;
                    }
                }
            }

            if (com.type === ComponentType.TYPE_RECT) {
                com.fill = data.g1() === 1;
            }

            if (com.type === ComponentType.TYPE_TEXT || com.type === ComponentType.TYPE_UNUSED) {
                com.center = data.g1() === 1;
                const font: number = data.g1();
                if (fonts) {
                    com.font = fonts[font];
                }
                com.shadowed = data.g1() === 1;
            }

            if (com.type === ComponentType.TYPE_TEXT) {
                com.text = data.gjstr();
                com.text2 = data.gjstr();
            }

            if (com.type === ComponentType.TYPE_UNUSED || com.type === ComponentType.TYPE_RECT || com.type === ComponentType.TYPE_TEXT) {
                com.colour = data.g4();
            }

            if (com.type === ComponentType.TYPE_RECT || com.type === ComponentType.TYPE_TEXT) {
                com.colour2 = data.g4();
                com.colourOver = data.g4();
                com.colour2Over = data.g4();
            }

            if (com.type === ComponentType.TYPE_GRAPHIC) {
                const graphic: string = data.gjstr();
                if (media && graphic.length > 0) {
                    const index: number = graphic.lastIndexOf(',');
                    com.graphic = this.getImage(media, graphic.substring(0, index), parseInt(graphic.substring(index + 1), 10));
                }

                const activeGraphic: string = data.gjstr();
                if (media && activeGraphic.length > 0) {
                    const index: number = activeGraphic.lastIndexOf(',');
                    com.graphic2 = this.getImage(media, activeGraphic.substring(0, index), parseInt(activeGraphic.substring(index + 1), 10));
                }
            }

            if (com.type === ComponentType.TYPE_MODEL) {
                const model: number = data.g1();
                if (model !== 0) {
                    com.modelType = 1;
                    com.modelId = ((model - 1) << 8) + data.g1();
                }

                const activeModel: number = data.g1();
                if (activeModel !== 0) {
                    com.model2Type = 1;
                    com.model2Id = ((activeModel - 1) << 8) + data.g1();
                }

                com.modelAnim = data.g1();
                if (com.modelAnim === 0) {
                    com.modelAnim = -1;
                } else {
                    com.modelAnim = ((com.modelAnim - 1) << 8) + data.g1();
                }

                com.model2Anim = data.g1();
                if (com.model2Anim === 0) {
                    com.model2Anim = -1;
                } else {
                    com.model2Anim = ((com.model2Anim - 1) << 8) + data.g1();
                }

                com.modelZoom = data.g2();
                com.modelXAn = data.g2();
                com.modelYAn = data.g2();
            }

            if (com.type === ComponentType.TYPE_INV_TEXT) {
                com.linkObjType = new Int32Array(com.width * com.height);
                com.linkObjCount = new Int32Array(com.width * com.height);

                com.center = data.g1() === 1;
                const font: number = data.g1();
                if (fonts) {
                    com.font = fonts[font];
                }
                com.shadowed = data.g1() === 1;
                com.colour = data.g4();
                com.marginX = data.g2b();
                com.marginY = data.g2b();
                com.interactable = data.g1() === 1;

                com.iop = new TypedArray1d(5, null);
                for (let i: number = 0; i < 5; i++) {
                    com.iop[i] = data.gjstr();
                    if (com.iop[i]!.length === 0) {
                        com.iop[i] = null;
                    }
                }
            }

            if (com.buttonType === ButtonType.BUTTON_TARGET || com.type === ComponentType.TYPE_INV) {
                com.targetVerb = data.gjstr();
                com.targetText = data.gjstr();
                com.targetMask = data.g2();
            }

            if (com.buttonType === ButtonType.BUTTON_OK || com.buttonType === ButtonType.BUTTON_TOGGLE || com.buttonType === ButtonType.BUTTON_SELECT || com.buttonType === ButtonType.BUTTON_CONTINUE) {
                com.option = data.gjstr();

                if (com.option.length === 0) {
                    if (com.buttonType === ButtonType.BUTTON_OK) {
                        com.option = 'Ok';
                    } else if (com.buttonType === ButtonType.BUTTON_TOGGLE) {
                        com.option = 'Select';
                    } else if (com.buttonType === ButtonType.BUTTON_SELECT) {
                        com.option = 'Select';
                    } else if (com.buttonType === ButtonType.BUTTON_CONTINUE) {
                        com.option = 'Continue';
                    }
                }
            }
        }

        this.spriteCache = null;
    }

    swapObj(src: number, dst: number) {
        if (!this.linkObjType || !this.linkObjCount) {
            return;
        }

        let tmp = this.linkObjType[src];
		this.linkObjType[src] = this.linkObjType[dst];
		this.linkObjType[dst] = tmp;

		tmp = this.linkObjCount[src];
		this.linkObjCount[src] = this.linkObjCount[dst];
		this.linkObjCount[dst] = tmp;
    }

    // jag::oldscape::rs2lib::IfType::GetTempModel
    getTempModel(primaryFrame: number, secondaryFrame: number, active: boolean, localPlayer: ClientPlayer | null): Model | null {
        let model: Model | null = null;
        if (active) {
            model = this.loadModel(this.model2Type, this.model2Id, localPlayer);
        } else {
            model = this.loadModel(this.modelType, this.modelId, localPlayer);
        }

        if (!model) {
            return null;
        }

        if (primaryFrame === -1 && secondaryFrame === -1 && !model.faceColour) {
            return model;
        }

        const tmp: Model = Model.copyForAnim(model, true, true, false);
        if (primaryFrame !== -1 || secondaryFrame !== -1) {
            tmp.prepareAnim();
        }

        if (primaryFrame !== -1) {
            tmp.animate(primaryFrame);
        }

        if (secondaryFrame !== -1) {
            tmp.animate(secondaryFrame);
        }

        tmp.calculateNormals(64, 768, -50, -10, -50, true);
        return tmp;
    }

    loadModel(type: number, id: number, localPlayer: ClientPlayer | null): Model | null {
        let model = IfType.modelCache.get(BigInt((type << 16) + id)) as Model | null;
        if (model) {
            return model;
        }

        if (type === 1) {
            model = Model.load(id);
        } else if (type === 2) {
            model = NpcType.get(id).getHead();
        } else if (type === 3) {
            if (localPlayer) {
                model = localPlayer.getHeadModel();
            }
        } else if (type === 4) {
            model = ObjType.get(id).getInvModel(50);
        } else if (type === 5) {
            model = null;
        }

        if (model) {
            IfType.modelCache.put(BigInt((type << 16) + id), model);
        }

        return model;
    }

    static cacheModel(model: Model, type: number, id: number) {
        IfType.modelCache.clear();

        if (model && type != 4) {
            IfType.modelCache.put(BigInt((type << 16) + id), model);
        }
    }

    private static getImage(media: Jagfile, name: string, spriteIndex: number): Pix32 | null {
        const uid: bigint = (JString.hashCode(name) << 8n) | BigInt(spriteIndex);

        if (this.spriteCache) {
            const image: Pix32 | null = this.spriteCache.get(uid) as Pix32 | null;
            if (image) {
                return image;
            }
        }

        try {
            const image = Pix32.load(media, name, spriteIndex);
            this.spriteCache?.put(uid, image);
            return image;
        } catch (e) {
            return null;
        }
    }
}
