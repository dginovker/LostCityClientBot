import { CollisionConstants } from '#/dash3d/CollisionMap.js';
import { LocAngle } from '#/dash3d/LocAngle.js';
import Occlude from '#/dash3d/Occlude.js';

import GroundDecor from '#/dash3d/GroundDecor.js';
import Sprite from '#/dash3d/Sprite.js';
import GroundObject from '#/dash3d/GroundObject.js';
import Square from '#/dash3d/Square.js';
import Ground from '#/dash3d/Ground.js';
import { OverlayShape } from '#/dash3d/OverlayShape.js';
import QuickGround from '#/dash3d/QuickGround.js';
import Wall from '#/dash3d/Wall.js';
import Decor from '#/dash3d/Decor.js';

import LinkList from '#/datastruct/LinkList.js';

import Pix2D from '#/graphics/Pix2D.js';
import Pix3D from '#/graphics/Pix3D.js';
import Model from '#/dash3d/Model.js';

import { Int32Array3d, TypedArray1d, TypedArray2d, TypedArray3d, TypedArray4d } from '#/util/Arrays.js';
import type ModelSource from '#/dash3d/ModelSource.js';
import type VertexNormal from '#/dash3d/VertexNormal.js';

// jag::oldscape::dash3d::world
export default class World {
    static readonly PRETAB: Uint8Array = Uint8Array.of(19, 55, 38, 155, 255, 110, 137, 205, 76); // jag::oldscape::dash3d::world::PRETAB
    static readonly MIDTAB: Uint8Array = Uint8Array.of(160, 192, 80, 96, 0, 144, 80, 48, 160); // jag::oldscape::dash3d::world::MIDTAB
    static readonly POSTTAB: Uint8Array = Uint8Array.of(76, 8, 137, 4, 0, 1, 38, 2, 19); // jag::oldscape::dash3d::world::POSTTAB

    static readonly MIDDEP_16: Int8Array = Int8Array.of(0, 0, 2, 0, 0, 2, 1, 1, 0); // jag::oldscape::dash3d::world::MIDDEP_16
    static readonly MIDDEP_32: Int8Array = Int8Array.of(2, 0, 0, 2, 0, 0, 0, 4, 4); // jag::oldscape::dash3d::world::MIDDEP_32
    static readonly MIDDEP_64: Int8Array = Int8Array.of(0, 4, 4, 8, 0, 0, 8, 0, 0); // jag::oldscape::dash3d::world::MIDDEP_64
    static readonly MIDDEP_128: Int8Array = Int8Array.of(1, 1, 0, 0, 0, 8, 0, 0, 8); // jag::oldscape::dash3d::world::MIDDEP_128

    static readonly WALL_DECORATION_INSET_X: Int8Array = Int8Array.of(53, -53, -53, 53);
    static readonly WALL_DECORATION_INSET_Z: Int8Array = Int8Array.of(-53, -53, 53, 53);
    static readonly WALL_DECORATION_OUTSET_X: Int8Array = Int8Array.of(-45, 45, 45, -45);
    static readonly WALL_DECORATION_OUTSET_Z: Int8Array = Int8Array.of(45, 45, -45, -45);

    // prettier-ignore
    static readonly MINIMAP_SHAPE: Int8Array[] = [
        new Int8Array(16),
        Int8Array.of(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1), // PLAIN_SHAPE
        Int8Array.of(1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1), // DIAGONAL_SHAPE
        Int8Array.of(1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0), // LEFT_SEMI_DIAGONAL_SMALL_SHAPE
        Int8Array.of(0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1), // RIGHT_SEMI_DIAGONAL_SMALL_SHAPE
        Int8Array.of(0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1), // LEFT_SEMI_DIAGONAL_BIG_SHAPE
        Int8Array.of(1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1), // RIGHT_SEMI_DIAGONAL_BIG_SHAPE
        Int8Array.of(1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0), // HALF_SQUARE_SHAPE
        Int8Array.of(0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0), // CORNER_SMALL_SHAPE
        Int8Array.of(1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1), // CORNER_BIG_SHAPE
        Int8Array.of(1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0), // FAN_SMALL_SHAPE
        Int8Array.of(0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1), // FAN_BIG_SHAPE
        Int8Array.of(0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1)  // TRAPEZIUM_SHAPE
    ]; // jag::oldscape::dash3d::world::MINIMAP_SHAPE

    // prettier-ignore
    static readonly MINIMAP_ROTATE: Int8Array[] = [
        Int8Array.of(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15),
        Int8Array.of(12, 8, 4, 0, 13, 9, 5, 1, 14, 10, 6, 2, 15, 11, 7, 3),
        Int8Array.of(15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
        Int8Array.of(3, 7, 11, 15, 2, 6, 10, 14, 1, 5, 9, 13, 0, 4, 8, 12),
    ]; // jag::oldscape::dash3d::world::MINIMAP_ROTATE

    // prettier-ignore
    static readonly TEXTURE_HSL: Int32Array = Int32Array.of(
        41, 39248, 41, 4643, 41, 41, 41, 41,
        41, 41, 41, 41, 41, 41, 41, 43086,
        41, 41, 41, 41, 41, 41, 41, 8602,
        41, 28992, 41, 41, 41, 41, 41, 5056,
        41, 41, 41, 41, 41, 41, 41, 41,
        41, 41, 41, 41, 41, 41, 3131, 41,
        41, 41
    );

    static lowMem: boolean = true; // jag::oldscape::dash3d::world::m_lowMem

    private static cameraSinX: number = 0; // jag::oldscape::dash3d::world::m_cameraSinX
    private static cameraCosX: number = 0; // jag::oldscape::dash3d::world::m_cameraCosX
    private static cameraSinY: number = 0; // jag::oldscape::dash3d::world::m_cameraSinY
    private static cameraCosY: number = 0; // jag::oldscape::dash3d::world::m_cameraCosY

    private static fillLeft: number = 0; // jag::oldscape::dash3d::world::m_fillLeft
    private static fillQueue: LinkList = new LinkList();

    static maxLevel: number = 0; // jag::oldscape::dash3d::world::m_maxLevel

    private static cycleNo: number = 0; // jag::oldscape::dash3d::world::m_cycleNo

    private static minX: number = 0; // jag::oldscape::dash3d::world::m_minX
    private static maxX: number = 0; // jag::oldscape::dash3d::world::m_maxX
    private static minZ: number = 0; // jag::oldscape::dash3d::world::m_minZ
    private static maxZ: number = 0; // jag::oldscape::dash3d::world::m_maxZ

    private static gx: number = 0; // jag::oldscape::dash3d::world::m_gx
    private static gz: number = 0; // jag::oldscape::dash3d::world::m_gz
    private static cx: number = 0; // jag::oldscape::dash3d::world::m_cx
    private static cy: number = 0; // jag::oldscape::dash3d::world::m_cy
    private static cz: number = 0; // jag::oldscape::dash3d::world::m_cz

    private static click: boolean = false; // jag::oldscape::dash3d::world::m_click
    static clickX: number = 0; // jag::oldscape::dash3d::world::m_clickX
    static clickY: number = 0; // jag::oldscape::dash3d::world::m_clickY
    static groundX: number = -1; // jag::oldscape::dash3d::world::m_groundX
    static groundZ: number = -1; // jag::oldscape::dash3d::world::m_groundZ

    private static visibilityMatrix: boolean[][][][] = new TypedArray4d(8, 32, 51, 51, false);
    private static visibilityMap: boolean[][] | null = null;

    static activeOccluderCount: number = 0;
    private static activeOccluders: (Occlude | null)[] = new TypedArray1d(500, null);

    static levelOccluderCount: Int32Array = new Int32Array(CollisionConstants.LEVELS);
    private static levelOccluders: (Occlude | null)[][] = new TypedArray2d(CollisionConstants.LEVELS, 500, null);

    private static locBuffer: (Sprite | null)[] = new TypedArray1d(100, null);

    private static viewportLeft: number = 0;
    private static viewportTop: number = 0;
    private static viewportRight: number = 0;
    private static viewportBottom: number = 0;
    private static viewportCenterX: number = 0;
    private static viewportCenterY: number = 0;

    static init(viewportWidth: number, viewportHeight: number, frustumStart: number, frustumEnd: number, pitchDistance: Int32Array): void {
        this.viewportLeft = 0;
        this.viewportTop = 0;
        this.viewportRight = viewportWidth;
        this.viewportBottom = viewportHeight;
        this.viewportCenterX = (viewportWidth / 2) | 0;
        this.viewportCenterY = (viewportHeight / 2) | 0;

        const matrix: boolean[][][][] = new TypedArray4d(9, 32, 53, 53, false);
        for (let pitch: number = 128; pitch <= 384; pitch += 32) {
            for (let yaw: number = 0; yaw < 2048; yaw += 64) {
                this.cameraSinX = Pix3D.sinTable[pitch];
                this.cameraCosX = Pix3D.cosTable[pitch];
                this.cameraSinY = Pix3D.sinTable[yaw];
                this.cameraCosY = Pix3D.cosTable[yaw];

                const pitchLevel: number = ((pitch - 128) / 32) | 0;
                const yawLevel: number = (yaw / 64) | 0;
                for (let dx: number = -26; dx <= 26; dx++) {
                    for (let dz: number = -26; dz <= 26; dz++) {
                        const x: number = dx * 128;
                        const z: number = dz * 128;

                        let visible: boolean = false;
                        for (let y: number = -frustumStart; y <= frustumEnd; y += 128) {
                            if (this.testPoint(x, z, pitchDistance[pitchLevel] + y)) {
                                visible = true;
                                break;
                            }
                        }

                        matrix[pitchLevel][yawLevel][dx + 25 + 1][dz + 25 + 1] = visible;
                    }
                }
            }
        }

        for (let pitchLevel: number = 0; pitchLevel < 8; pitchLevel++) {
            for (let yawLevel: number = 0; yawLevel < 32; yawLevel++) {
                for (let x: number = -25; x < 25; x++) {
                    for (let z: number = -25; z < 25; z++) {
                        let visible: boolean = false;
                        check_areas: for (let dx: number = -1; dx <= 1; dx++) {
                            for (let dz: number = -1; dz <= 1; dz++) {
                                if (matrix[pitchLevel][yawLevel][x + dx + 25 + 1][z + dz + 25 + 1]) {
                                    visible = true;
                                    break check_areas;
                                }

                                if (matrix[pitchLevel][(yawLevel + 1) % 31][x + dx + 25 + 1][z + dz + 25 + 1]) {
                                    visible = true;
                                    break check_areas;
                                }

                                if (matrix[pitchLevel + 1][yawLevel][x + dx + 25 + 1][z + dz + 25 + 1]) {
                                    visible = true;
                                    break check_areas;
                                }

                                if (matrix[pitchLevel + 1][(yawLevel + 1) % 31][x + dx + 25 + 1][z + dz + 25 + 1]) {
                                    visible = true;
                                    break check_areas;
                                }
                            }
                        }
                        this.visibilityMatrix[pitchLevel][yawLevel][x + 25][z + 25] = visible;
                    }
                }
            }
        }
    }

    // jag::oldscape::dash3d::world::SetOcclude
    static setOcclude(level: number, type: number, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): void {
        World.levelOccluders[level][World.levelOccluderCount[level]++] = new Occlude((minX / 128) | 0, (maxX / 128) | 0, (minZ / 128) | 0, (maxZ / 128) | 0, type, minX, maxX, minZ, maxZ, minY, maxY);
    }

    private static testPoint(x: number, z: number, y: number): boolean {
        const px: number = (z * this.cameraSinY + x * this.cameraCosY) >> 16;
        const tmp: number = (z * this.cameraCosY - x * this.cameraSinY) >> 16;
        const pz: number = (y * this.cameraSinX + tmp * this.cameraCosX) >> 16;
        const py: number = (y * this.cameraCosX - tmp * this.cameraSinX) >> 16;

        if (pz < 50 || pz > 3500) {
            return false;
        }

        const viewportX: number = this.viewportCenterX + (((px << 9) / pz) | 0);
        const viewportY: number = this.viewportCenterY + (((py << 9) / pz) | 0);
        return viewportX >= this.viewportLeft && viewportX <= this.viewportRight && viewportY >= this.viewportTop && viewportY <= this.viewportBottom;
    }

    private readonly maxLevel: number;
    private readonly maxTileX: number;
    private readonly maxTileZ: number;
    private readonly groundHeight: Int32Array[][];
    private readonly levelTiles: (Square | null)[][][];
    private readonly changedLocs: (Sprite | null)[];
    private readonly occlusionCycle: Int32Array[][];
    private readonly mergeIndexA: Int32Array;
    private readonly mergeIndexB: Int32Array;

    private changedLocCount: number = 0;
    private minLevel: number = 0;
    private tmpMergeIndex: number = 0;

    constructor(levelHeightmaps: Int32Array[][], maxTileZ: number, maxLevel: number, maxTileX: number) {
        this.maxLevel = maxLevel;
        this.maxTileX = maxTileX;
        this.maxTileZ = maxTileZ;
        this.levelTiles = new TypedArray3d(maxLevel, maxTileX, maxTileZ, null);
        this.occlusionCycle = new Int32Array3d(maxLevel, maxTileX + 1, maxTileZ + 1);
        this.groundHeight = levelHeightmaps;

        this.changedLocs = new TypedArray1d(5000, null);
        this.mergeIndexA = new Int32Array(10000);
        this.mergeIndexB = new Int32Array(10000);

        this.resetMap();
    }

    // jag::oldscape::dash3d::world::ResetMap(void)
    resetMap(): void {
        for (let level: number = 0; level < this.maxLevel; level++) {
            for (let x: number = 0; x < this.maxTileX; x++) {
                for (let z: number = 0; z < this.maxTileZ; z++) {
                    this.levelTiles[level][x][z] = null;
                }
            }
        }

        for (let l: number = 0; l < CollisionConstants.LEVELS; l++) {
            for (let o: number = 0; o < World.levelOccluderCount[l]; o++) {
                World.levelOccluders[l][o] = null;
            }

            World.levelOccluderCount[l] = 0;
        }

        for (let i: number = 0; i < this.changedLocCount; i++) {
            this.changedLocs[i] = null;
        }

        this.changedLocCount = 0;

        World.locBuffer.fill(null);
    }

    // jag::oldscape::dash3d::world::FillBaseLevel
    fillBaseLevel(level: number): void {
        this.minLevel = level;

        for (let stx: number = 0; stx < this.maxTileX; stx++) {
            for (let stz: number = 0; stz < this.maxTileZ; stz++) {
                this.levelTiles[level][stx][stz] = new Square(level, stx, stz);
            }
        }
    }

    // jag::oldscape::dash3d::world::PushDown
    pushDown(stx: number, stz: number): void {
        const below: Square | null = this.levelTiles[0][stx][stz];

        for (let level: number = 0; level < 3; level++) {
            this.levelTiles[level][stx][stz] = this.levelTiles[level + 1][stx][stz];

            const tile: Square | null = this.levelTiles[level][stx][stz];
            if (tile) {
                tile.level--;
            }
        }

        if (!this.levelTiles[0][stx][stz]) {
            this.levelTiles[0][stx][stz] = new Square(0, stx, stz);
        }

        const tile: Square | null = this.levelTiles[0][stx][stz];
        if (tile) {
            tile.linkedSquare = below;
        }

        this.levelTiles[3][stx][stz] = null;
    }

    // jag::oldscape::dash3d::world::SetLayer
    setLayer(level: number, stx: number, stz: number, drawLevel: number): void {
        const tile: Square | null = this.levelTiles[level][stx][stz];
        if (!tile) {
            return;
        }

        tile.drawLevel = drawLevel;
    }

    // jag::oldscape::dash3d::world::SetGround
    setGround(
        level: number,
        x: number,
        z: number,
        shape: number,
        angle: number,
        textureId: number,
        southwestY: number,
        southeastY: number,
        northeastY: number,
        northwestY: number,
        southwestColor: number,
        southeastColor: number,
        northeastColor: number,
        northwestColor: number,
        southwestColor2: number,
        southeastColor2: number,
        northeastColor2: number,
        northwestColor2: number,
        backgroundRgb: number,
        foregroundRgb: number
    ): void {
        if (shape === OverlayShape.PLAIN) {
            for (let l: number = level; l >= 0; l--) {
                if (!this.levelTiles[l][x][z]) {
                    this.levelTiles[l][x][z] = new Square(l, x, z);
                }
            }

            const tile: Square | null = this.levelTiles[level][x][z];
            if (tile) {
                tile.quickGround = new QuickGround(southwestColor, southeastColor, northeastColor, northwestColor, -1, backgroundRgb, false);
            }
        } else if (shape === OverlayShape.DIAGONAL) {
            for (let l: number = level; l >= 0; l--) {
                if (!this.levelTiles[l][x][z]) {
                    this.levelTiles[l][x][z] = new Square(l, x, z);
                }
            }

            const tile: Square | null = this.levelTiles[level][x][z];
            if (tile) {
                tile.quickGround = new QuickGround(southwestColor2, southeastColor2, northeastColor2, northwestColor2, textureId, foregroundRgb, southwestY === southeastY && southwestY === northeastY && southwestY === northwestY);
            }
        } else {
            for (let l: number = level; l >= 0; l--) {
                if (!this.levelTiles[l][x][z]) {
                    this.levelTiles[l][x][z] = new Square(l, x, z);
                }
            }

            const tile: Square | null = this.levelTiles[level][x][z];
            if (tile) {
                tile.ground = new Ground(
                    x,
                    shape,
                    southeastColor2,
                    southeastY,
                    northeastColor,
                    angle,
                    southwestColor,
                    northwestY,
                    foregroundRgb,
                    southwestColor2,
                    textureId,
                    northwestColor2,
                    backgroundRgb,
                    northeastY,
                    northeastColor2,
                    northwestColor,
                    southwestY,
                    z,
                    southeastColor
                );
            }
        }
    }

    // jag::oldscape::dash3d::world::SetGroundDecor
    setGroundDecor(model: ModelSource | null, tileLevel: number, tileX: number, tileZ: number, y: number, typecode: number, typecode2: number): void {
        if (!this.levelTiles[tileLevel][tileX][tileZ]) {
            this.levelTiles[tileLevel][tileX][tileZ] = new Square(tileLevel, tileX, tileZ);
        }

        const tile: Square | null = this.levelTiles[tileLevel][tileX][tileZ];
        if (tile) {
            tile.groundDecor = new GroundDecor(y, tileX * 128 + 64, tileZ * 128 + 64, model, typecode, typecode2);
        }
    }

    // jag::oldscape::dash3d::world::DelGroundDecor
    delGroundDecor(level: number, x: number, z: number): void {
        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return;
        }

        tile.groundDecor = null;
    }

    // jag::oldscape::dash3d::world::SetObj
    setObj(stx: number, stz: number, y: number, level: number, typecode: number, topObj: ModelSource | null, middleObj: ModelSource | null, bottomObj: ModelSource | null): void {
        let stackOffset: number = 0;

        const tile: Square | null = this.levelTiles[level][stx][stz];
        if (tile) {
            for (let l: number = 0; l < tile.primaryCount; l++) {
                const loc: Sprite | null = tile.locs[l];
                if (!loc || !loc.model || !(loc.model instanceof Model)) {
                    continue;
                }

                const height: number = loc.model.objRaise;
                if (height > stackOffset) {
                    stackOffset = height;
                }
            }
        } else {
            this.levelTiles[level][stx][stz] = new Square(level, stx, stz);
        }

        const tile2: Square | null = this.levelTiles[level][stx][stz];
        if (tile2) {
            tile2.groundObject = new GroundObject(y, stx * 128 + 64, stz * 128 + 64, topObj, middleObj, bottomObj, typecode, stackOffset);
        }
    }

    // jag::oldscape::dash3d::world::DelObj
    delObj(level: number, x: number, z: number): void {
        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return;
        }

        tile.groundObject = null;
    }

    // jag::oldscape::dash3d::world::SetWall
    setWall(level: number, tileX: number, tileZ: number, y: number, angle1: number, angle2: number, model1: ModelSource | null, model2: ModelSource | null, typecode1: number, typecode2: number): void {
        if (!model1 && !model2) {
            return;
        }

        for (let l: number = level; l >= 0; l--) {
            if (!this.levelTiles[l][tileX][tileZ]) {
                this.levelTiles[l][tileX][tileZ] = new Square(l, tileX, tileZ);
            }
        }

        const tile: Square | null = this.levelTiles[level][tileX][tileZ];
        if (tile) {
            tile.wall = new Wall(y, tileX * 128 + 64, tileZ * 128 + 64, angle1, angle2, model1, model2, typecode1, typecode2);
        }
    }

    // jag::oldscape::dash3d::world::DelWall
    delWall(level: number, x: number, z: number): void {
        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return;
        }

        tile.wall = null;
    }

    // jag::oldscape::dash3d::world::SetDecor
    setDecor(level: number, tileX: number, tileZ: number, y: number, offsetX: number, offsetZ: number, typecode: number, model: ModelSource | null, info: number, angle: number, type: number): void {
        if (!model) {
            return;
        }

        for (let l: number = level; l >= 0; l--) {
            if (!this.levelTiles[l][tileX][tileZ]) {
                this.levelTiles[l][tileX][tileZ] = new Square(l, tileX, tileZ);
            }
        }

        const tile: Square | null = this.levelTiles[level][tileX][tileZ];
        if (tile) {
            tile.decor = new Decor(y, tileX * 128 + offsetX + 64, tileZ * 128 + offsetZ + 64, type, angle, model, typecode, info);
        }
    }

    // jag::oldscape::dash3d::world::DelDecor
    delDecor(level: number, x: number, z: number): void {
        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return;
        }

        tile.decor = null;
    }

    setWallDecorationOffset(level: number, x: number, z: number, offset: number): void {
        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return;
        }

        const decor: Decor | null = tile.decor;
        if (!decor) {
            return;
        }

        const sx: number = x * 128 + 64;
        const sz: number = z * 128 + 64;
        decor.x = sx + ((((decor.x - sx) * offset) / 16) | 0);
        decor.z = sz + ((((decor.z - sz) * offset) / 16) | 0);
    }

    setWallDecorationModel(level: number, x: number, z: number, model: Model | null): void {
        if (!model) {
            return;
        }

        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return;
        }

        const decor: Decor | null = tile.decor;
        if (!decor) {
            return;
        }

        decor.model = model;
    }

    setGroundDecorationModel(level: number, x: number, z: number, model: Model | null): void {
        if (!model) {
            return;
        }

        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return;
        }

        const decor: GroundDecor | null = tile.groundDecor;
        if (!decor) {
            return;
        }

        decor.model = model;
    }

    setWallModel(level: number, x: number, z: number, model: Model | null): void {
        if (!model) {
            return;
        }

        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return;
        }

        const wall: Wall | null = tile.wall;
        if (!wall) {
            return;
        }

        wall.model1 = model;
    }

    setWallModels(x: number, z: number, level: number, modelA: Model | null, modelB: Model | null): void {
        if (!modelA) {
            return;
        }

        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return;
        }

        const wall: Wall | null = tile.wall;
        if (!wall) {
            return;
        }

        wall.model1 = modelA;
        wall.model2 = modelB;
    }

    // jag::oldscape::dash3d::world::AddScenery
    addScenery(level: number, tileX: number, tileZ: number, y: number, model: ModelSource | null, typecode: number, info: number, width: number, length: number, yaw: number): boolean {
        if (!model) {
            return true;
        }

        const sceneX: number = tileX * 128 + width * 64;
        const sceneZ: number = tileZ * 128 + length * 64;
        return this.setSprite(sceneX, sceneZ, y, level, tileX, tileZ, width, length, model, typecode, info, yaw, false);
    }

    // jag::oldscape::dash3d::world::AddDynamic
    addDynamic(level: number, x: number, y: number, z: number, model: ModelSource | null, typecode: number, yaw: number, padding: number, forwardPadding: boolean): boolean {
        if (!model) {
            return true;
        }

        let x0: number = x - padding;
        let z0: number = z - padding;
        let x1: number = x + padding;
        let z1: number = z + padding;

        if (forwardPadding) {
            if (yaw > 640 && yaw < 1408) {
                z1 += 128;
            }
            if (yaw > 1152 && yaw < 1920) {
                x1 += 128;
            }
            if (yaw > 1664 || yaw < 384) {
                z0 -= 128;
            }
            if (yaw > 128 && yaw < 896) {
                x0 -= 128;
            }
        }

        x0 = (x0 / 128) | 0;
        z0 = (z0 / 128) | 0;
        x1 = (x1 / 128) | 0;
        z1 = (z1 / 128) | 0;

        return this.setSprite(x, z, y, level, x0, z0, x1 + 1 - x0, z1 - z0 + 1, model, typecode, 0, yaw, true);
    }

    // jag::oldscape::dash3d::world::AddDynamic
    addDynamic2(level: number, x: number, y: number, z: number, minTileX: number, minTileZ: number, maxTileX: number, maxTileZ: number, model: ModelSource | null, typecode: number, yaw: number): boolean {
        return !model || this.setSprite(x, z, y, level, minTileX, minTileZ, maxTileX + 1 - minTileX, maxTileZ - minTileZ + 1, model, typecode, 0, yaw, true);
    }

    // jag::oldscape::dash3d::world::DelLoc
    delLoc(level: number, x: number, z: number): void {
        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return;
        }

        for (let l: number = 0; l < tile.primaryCount; l++) {
            const loc: Sprite | null = tile.locs[l];
            if (loc && ((loc.typecode >> 29) & 0x3) === 2 && loc.minSceneTileX === x && loc.minSceneTileZ === z) {
                this.delSprite(loc);
                return;
            }
        }
    }

    // jag::oldscape::dash3d::world::RemoveSprites
    removeSprites(): void {
        for (let i: number = 0; i < this.changedLocCount; i++) {
            const loc: Sprite | null = this.changedLocs[i];
            if (loc) {
                this.delSprite(loc);
            }

            this.changedLocs[i] = null;
        }

        this.changedLocCount = 0;
    }

    // jag::oldscape::dash3d::world::WallType
    wallType(level: number, x: number, z: number): number {
        const tile: Square | null = this.levelTiles[level][x][z];
        return !tile || !tile.wall ? 0 : tile.wall.typecode;
    }

    // jag::oldscape::dash3d::world::DecorType
    decorType(level: number, z: number, x: number): number {
        const tile: Square | null = this.levelTiles[level][x][z];
        return !tile || !tile.decor ? 0 : tile.decor.typecode;
    }

    // jag::oldscape::dash3d::world::SceneType
    sceneType(level: number, x: number, z: number): number {
        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return 0;
        }

        for (let l: number = 0; l < tile.primaryCount; l++) {
            const loc: Sprite | null = tile.locs[l];
            if (loc && ((loc.typecode >> 29) & 0x3) === 2 && loc.minSceneTileX === x && loc.minSceneTileZ === z) {
                return loc.typecode;
            }
        }

        return 0;
    }

    // jag::oldscape::dash3d::world::GdType
    gdType(level: number, x: number, z: number): number {
        const tile: Square | null = this.levelTiles[level][x][z];
        return !tile || !tile.groundDecor ? 0 : tile.groundDecor.typecode;
    }

    // jag::oldscape::dash3d::world::GetWall
    getWall(level: number, x: number, z: number): Wall | null {
        const tile: Square | null = this.levelTiles[level][x][z];
        return !tile || !tile.wall ? null : tile.wall;
    }

    // jag::oldscape::dash3d::world::GetDecor
    getDecor(level: number, z: number, x: number): Decor | null {
        const tile: Square | null = this.levelTiles[level][x][z];
        return !tile || !tile.decor ? null : tile.decor;
    }

    // jag::oldscape::dash3d::world::GetScene
    getScene(level: number, x: number, z: number): Sprite | null {
        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return null;
        }

        for (let l: number = 0; l < tile.primaryCount; l++) {
            const loc: Sprite | null = tile.locs[l];
            if (loc && ((loc.typecode >> 29) & 0x3) === 2 && loc.minSceneTileX === x && loc.minSceneTileZ === z) {
                return loc;
            }
        }

        return null;
    }

    // jag::oldscape::dash3d::world::GetGd
    getGd(level: number, x: number, z: number): GroundDecor | null {
        const tile: Square | null = this.levelTiles[level][x][z];
        return !tile || !tile.groundDecor ? null : tile.groundDecor;
    }

    // jag::oldscape::dash3d::world::TypeCode2
    typecode2(level: number, x: number, z: number, typecode: number): number {
        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return -1;
        } else if (tile.wall && tile.wall.typecode === typecode) {
            return tile.wall.typecode2 & 0xff;
        } else if (tile.decor && tile.decor.typecode === typecode) {
            return tile.decor.typecode2 & 0xff;
        } else if (tile.groundDecor && tile.groundDecor.typecode === typecode) {
            return tile.groundDecor.typecode2 & 0xff;
        } else {
            for (let i: number = 0; i < tile.primaryCount; i++) {
                const loc: Sprite | null = tile.locs[i];
                if (loc && loc.typecode === typecode) {
                    return loc.typecode2 & 0xff;
                }
            }
            return -1;
        }
    }

    // jag::oldscape::dash3d::world::ShareLight
    shareLight(lightAmbient: number, lightAttenuation: number, lightSrcX: number, lightSrcY: number, lightSrcZ: number): void {
        const lightMagnitude: number = Math.sqrt(lightSrcX * lightSrcX + lightSrcY * lightSrcY + lightSrcZ * lightSrcZ) | 0;
        const attenuation: number = (lightAttenuation * lightMagnitude) >> 8;

        for (let level: number = 0; level < this.maxLevel; level++) {
            for (let tileX: number = 0; tileX < this.maxTileX; tileX++) {
                for (let tileZ: number = 0; tileZ < this.maxTileZ; tileZ++) {
                    const tile: Square | null = this.levelTiles[level][tileX][tileZ];
                    if (!tile) {
                        continue;
                    }

                    const wall: Wall | null = tile.wall;
                    if (wall && wall.model1 && wall.model1.vertexNormal) {
                        this.shareLightLoc(level, tileX, tileZ, 1, 1, (wall.model1 as Model));
                        if (wall.model2 && wall.model2.vertexNormal) {
                            this.shareLightLoc(level, tileX, tileZ, 1, 1, (wall.model2 as Model));
                            this.modelShareLight((wall.model1 as Model), (wall.model2 as Model), 0, 0, 0, false);
                            (wall.model2 as Model).light(lightAmbient, attenuation, lightSrcX, lightSrcY, lightSrcZ);
                        }
                        (wall.model1 as Model).light(lightAmbient, attenuation, lightSrcX, lightSrcY, lightSrcZ);
                    }

                    for (let i: number = 0; i < tile.primaryCount; i++) {
                        const loc: Sprite | null = tile.locs[i];
                        if (loc && loc.model && loc.model.vertexNormal) {
                            this.shareLightLoc(level, tileX, tileZ, loc.maxSceneTileX + 1 - loc.minSceneTileX, loc.maxSceneTileZ - loc.minSceneTileZ + 1, (loc.model as Model));
                            (loc.model as Model).light(lightAmbient, attenuation, lightSrcX, lightSrcY, lightSrcZ);
                        }
                    }

                    const decor: GroundDecor | null = tile.groundDecor;
                    if (decor && decor.model && decor.model.vertexNormal) {
                        this.shareLightGd(level, tileX, tileZ, (decor.model as Model));
                        (decor.model as Model).light(lightAmbient, attenuation, lightSrcX, lightSrcY, lightSrcZ);
                    }
                }
            }
        }
    }

    // jag::oldscape::dash3d::world::ShareLightGd
    shareLightGd(level: number, tileX: number, tileZ: number, model: Model): void {
        if (tileX < this.maxTileX) {
            const tile: Square | null = this.levelTiles[level][tileX + 1][tileZ];
            if (tile && tile.groundDecor && tile.groundDecor.model && tile.groundDecor.model.vertexNormal) {
                this.modelShareLight(model, tile.groundDecor.model as Model, 128, 0, 0, true);
            }
        }

        if (tileZ < this.maxTileX) {
            const tile: Square | null = this.levelTiles[level][tileX][tileZ + 1];
            if (tile && tile.groundDecor && tile.groundDecor.model && tile.groundDecor.model.vertexNormal) {
                this.modelShareLight(model, tile.groundDecor.model as Model, 0, 0, 128, true);
            }
        }

        if (tileX < this.maxTileX && tileZ < this.maxTileZ) {
            const tile: Square | null = this.levelTiles[level][tileX + 1][tileZ + 1];
            if (tile && tile.groundDecor && tile.groundDecor.model && tile.groundDecor.model.vertexNormal) {
                this.modelShareLight(model, tile.groundDecor.model as Model, 128, 0, 128, true);
            }
        }

        if (tileX < this.maxTileX && tileZ > 0) {
            const tile: Square | null = this.levelTiles[level][tileX + 1][tileZ - 1];
            if (tile && tile.groundDecor && tile.groundDecor.model && tile.groundDecor.model.vertexNormal) {
                this.modelShareLight(model, tile.groundDecor.model as Model, 128, 0, -128, true);
            }
        }
    }

    // jag::oldscape::dash3d::world::ShareLightLoc
    shareLightLoc(level: number, tileX: number, tileZ: number, tileSizeX: number, tileSizeZ: number, model: Model): void {
        let allowFaceRemoval: boolean = true;

        let minTileX: number = tileX;
        const maxTileX: number = tileX + tileSizeX;
        const minTileZ: number = tileZ - 1;
        const maxTileZ: number = tileZ + tileSizeZ;

        for (let l: number = level; l <= level + 1; l++) {
            if (l === this.maxLevel) {
                continue;
            }

            for (let x: number = minTileX; x <= maxTileX; x++) {
                if (x < 0 || x >= this.maxTileX) {
                    continue;
                }

                for (let z: number = minTileZ; z <= maxTileZ; z++) {
                    if (z < 0 || z >= this.maxTileZ || (allowFaceRemoval && x < maxTileX && z < maxTileZ && (z >= tileZ || x === tileX))) {
                        continue;
                    }

                    const tile: Square | null = this.levelTiles[l][x][z];
                    if (!tile) {
                        continue;
                    }

                    const offsetX: number = (x - tileX) * 128 + (1 - tileSizeX) * 64;
                    const offsetZ: number = (z - tileZ) * 128 + (1 - tileSizeZ) * 64;
                    const offsetY: number =
                        (((this.groundHeight[l][x][z] + this.groundHeight[l][x + 1][z] + this.groundHeight[l][x][z + 1] + this.groundHeight[l][x + 1][z + 1]) / 4) | 0) -
                        (((this.groundHeight[level][tileX][tileZ] + this.groundHeight[level][tileX + 1][tileZ] + this.groundHeight[level][tileX][tileZ + 1] + this.groundHeight[level][tileX + 1][tileZ + 1]) / 4) | 0);

                    const wall: Wall | null = tile.wall;
                    if (wall && wall.model1 && wall.model1.vertexNormal) {
                        this.modelShareLight(model, wall.model1 as Model, offsetX, offsetY, offsetZ, allowFaceRemoval);
                    }

                    if (wall && wall.model2 && wall.model2.vertexNormal) {
                        this.modelShareLight(model, wall.model2 as Model, offsetX, offsetY, offsetZ, allowFaceRemoval);
                    }

                    for (let i: number = 0; i < tile.primaryCount; i++) {
                        const loc: Sprite | null = tile.locs[i];
                        if (!loc || !loc.model || !loc.model.vertexNormal) {
                            continue;
                        }

                        const locTileSizeX: number = loc.maxSceneTileX + 1 - loc.minSceneTileX;
                        const locTileSizeZ: number = loc.maxSceneTileZ + 1 - loc.minSceneTileZ;
                        this.modelShareLight(model, loc.model as Model, (loc.minSceneTileX - tileX) * 128 + (locTileSizeX - tileSizeX) * 64, offsetY, (loc.minSceneTileZ - tileZ) * 128 + (locTileSizeZ - tileSizeZ) * 64, allowFaceRemoval);
                    }
                }
            }

            minTileX--;
            allowFaceRemoval = false;
        }
    }

    private modelShareLight(modelA: Model, modelB: Model, offsetX: number, offsetY: number, offsetZ: number, allowFaceRemoval: boolean): void {
        this.tmpMergeIndex++;

        let merged: number = 0;
        const vertexX: Int32Array = modelB.vertexX!;
        const vertexCountB: number = modelB.vertexCount;

        if (modelA.vertexNormal && modelA.vertexNormalOriginal) {
            for (let vertexA: number = 0; vertexA < modelA.vertexCount; vertexA++) {
                const normalA: VertexNormal | null = modelA.vertexNormal[vertexA];
                const originalNormalA: VertexNormal | null = modelA.vertexNormalOriginal[vertexA];

                if (originalNormalA && originalNormalA.w !== 0) {
                    const y: number = modelA.vertexY![vertexA] - offsetY;
                    if (y > modelB.maxY) {
                        continue;
                    }

                    const x: number = modelA.vertexX![vertexA] - offsetX;
                    if (x < modelB.minX || x > modelB.maxX) {
                        continue;
                    }

                    const z: number = modelA.vertexZ![vertexA] - offsetZ;
                    if (z < modelB.minZ || z > modelB.maxZ) {
                        continue;
                    }

                    if (modelB.vertexNormal && modelB.vertexNormalOriginal) {
                        for (let vertexB: number = 0; vertexB < vertexCountB; vertexB++) {
                            const normalB: VertexNormal | null = modelB.vertexNormal[vertexB];
                            const originalNormalB: VertexNormal | null = modelB.vertexNormalOriginal[vertexB];
                            if (x !== vertexX[vertexB] || z !== modelB.vertexZ![vertexB] || y !== modelB.vertexY![vertexB] || (originalNormalB && originalNormalB.w === 0)) {
                                continue;
                            }

                            if (normalA && normalB && originalNormalB) {
                                normalA.x += originalNormalB.x;
                                normalA.y += originalNormalB.y;
                                normalA.z += originalNormalB.z;
                                normalA.w += originalNormalB.w;
                                normalB.x += originalNormalA.x;
                                normalB.y += originalNormalA.y;
                                normalB.z += originalNormalA.z;
                                normalB.w += originalNormalA.w;
                                merged++;
                            }

                            this.mergeIndexA[vertexA] = this.tmpMergeIndex;
                            this.mergeIndexB[vertexB] = this.tmpMergeIndex;
                        }
                    }
                }
            }
        }

        if (merged < 3 || !allowFaceRemoval) {
            return;
        }

        if (modelA.faceInfo) {
            for (let i: number = 0; i < modelA.faceCount; i++) {
                if (this.mergeIndexA[modelA.faceVertexA![i]] === this.tmpMergeIndex && this.mergeIndexA[modelA.faceVertexB![i]] === this.tmpMergeIndex && this.mergeIndexA[modelA.faceVertexC![i]] === this.tmpMergeIndex) {
                    modelA.faceInfo[i] = -1;
                }
            }
        }

        if (modelB.faceInfo) {
            for (let i: number = 0; i < modelB.faceCount; i++) {
                if (this.mergeIndexB[modelB.faceVertexA![i]] === this.tmpMergeIndex && this.mergeIndexB[modelB.faceVertexB![i]] === this.tmpMergeIndex && this.mergeIndexB[modelB.faceVertexC![i]] === this.tmpMergeIndex) {
                    modelB.faceInfo[i] = -1;
                }
            }
        }
    }

    // jag::oldscape::dash3d::world::Render2DGround
    render2DGround(level: number, x: number, z: number, dst: Int32Array, offset: number, step: number): void {
        const tile: Square | null = this.levelTiles[level][x][z];
        if (!tile) {
            return;
        }

        const underlay: QuickGround | null = tile.quickGround;
        if (underlay) {
            const rgb: number = underlay.colour;
            if (rgb !== 0) {
                for (let i: number = 0; i < 4; i++) {
                    dst[offset] = rgb;
                    dst[offset + 1] = rgb;
                    dst[offset + 2] = rgb;
                    dst[offset + 3] = rgb;
                    offset += step;
                }
            }
            return;
        }

        const overlay: Ground | null = tile.ground;
        if (!overlay) {
            return;
        }

        const shape: number = overlay.shape;
        const angle: number = overlay.shapeAngle;
        const background: number = overlay.backgroundRgb;
        const foreground: number = overlay.foregroundRgb;
        const mask: Int8Array = World.MINIMAP_SHAPE[shape];
        const rotation: Int8Array = World.MINIMAP_ROTATE[angle];
        let off: number = 0;
        if (background !== 0) {
            for (let i: number = 0; i < 4; i++) {
                dst[offset] = mask[rotation[off++]] === 0 ? background : foreground;
                dst[offset + 1] = mask[rotation[off++]] === 0 ? background : foreground;
                dst[offset + 2] = mask[rotation[off++]] === 0 ? background : foreground;
                dst[offset + 3] = mask[rotation[off++]] === 0 ? background : foreground;
                offset += step;
            }
            return;
        }

        for (let i: number = 0; i < 4; i++) {
            if (mask[rotation[off++]] !== 0) {
                dst[offset] = foreground;
            }
            if (mask[rotation[off++]] !== 0) {
                dst[offset + 1] = foreground;
            }
            if (mask[rotation[off++]] !== 0) {
                dst[offset + 2] = foreground;
            }
            if (mask[rotation[off++]] !== 0) {
                dst[offset + 3] = foreground;
            }
            offset += step;
        }
    }

    // jag::oldscape::dash3d::world::UpdateMousePickingRSeven
    updateMousePicking(mouseX: number, mouseY: number): void {
        World.click = true;
        World.clickX = mouseX;
        World.clickY = mouseY;
        World.groundX = -1;
        World.groundZ = -1;
    }

    // jag::oldscape::dash3d::world::RenderAllSlow
    renderAll(eyeX: number, eyeY: number, eyeZ: number, topLevel: number, eyeYaw: number, eyePitch: number, loopCycle: number): void {
        if (eyeX < 0) {
            eyeX = 0;
        } else if (eyeX >= this.maxTileX * 128) {
            eyeX = this.maxTileX * 128 - 1;
        }

        if (eyeZ < 0) {
            eyeZ = 0;
        } else if (eyeZ >= this.maxTileZ * 128) {
            eyeZ = this.maxTileZ * 128 - 1;
        }

        World.cycleNo++;
        World.cameraSinX = Pix3D.sinTable[eyePitch];
        World.cameraCosX = Pix3D.cosTable[eyePitch];
        World.cameraSinY = Pix3D.sinTable[eyeYaw];
        World.cameraCosY = Pix3D.cosTable[eyeYaw];

        World.visibilityMap = World.visibilityMatrix[((eyePitch - 128) / 32) | 0][(eyeYaw / 64) | 0];
        World.cx = eyeX;
        World.cy = eyeY;
        World.cz = eyeZ;
        World.gx = (eyeX / 128) | 0;
        World.gz = (eyeZ / 128) | 0;
        World.maxLevel = topLevel;

        World.minX = World.gx - 25;
        if (World.minX < 0) {
            World.minX = 0;
        }

        World.minZ = World.gz - 25;
        if (World.minZ < 0) {
            World.minZ = 0;
        }

        World.maxX = World.gx + 25;
        if (World.maxX > this.maxTileX) {
            World.maxX = this.maxTileX;
        }

        World.maxZ = World.gz + 25;
        if (World.maxZ > this.maxTileZ) {
            World.maxZ = this.maxTileZ;
        }

        this.calcOcclude();
        World.fillLeft = 0;

        for (let level: number = this.minLevel; level < this.maxLevel; level++) {
            const tiles: (Square | null)[][] = this.levelTiles[level];
            for (let x: number = World.minX; x < World.maxX; x++) {
                for (let z: number = World.minZ; z < World.maxZ; z++) {
                    const tile: Square | null = tiles[x][z];
                    if (!tile) {
                        continue;
                    }

                    if (tile.drawLevel <= topLevel && (World.visibilityMap[x + 25 - World.gx][z + 25 - World.gz] || this.groundHeight[level][x][z] - eyeY >= 2000)) {
                        tile.drawFront = true;
                        tile.drawBack = true;
                        tile.drawPrimaries = tile.primaryCount > 0;
                        World.fillLeft++;
                    } else {
                        tile.drawFront = false;
                        tile.drawBack = false;
                        tile.cornerSides = 0;
                    }
                }
            }
        }

        for (let level: number = this.minLevel; level < this.maxLevel; level++) {
            const tiles: (Square | null)[][] = this.levelTiles[level];
            for (let dx: number = -25; dx <= 0; dx++) {
                const rightTileX: number = World.gx + dx;
                const leftTileX: number = World.gx - dx;

                if (rightTileX < World.minX && leftTileX >= World.maxX) {
                    continue;
                }

                for (let dz: number = -25; dz <= 0; dz++) {
                    const forwardTileZ: number = World.gz + dz;
                    const backwardTileZ: number = World.gz - dz;
                    let tile: Square | null;
                    if (rightTileX >= World.minX) {
                        if (forwardTileZ >= World.minZ) {
                            tile = tiles[rightTileX][forwardTileZ];
                            if (tile && tile.drawFront) {
                                this.fill(tile, true, loopCycle);
                            }
                        }

                        if (backwardTileZ < World.maxZ) {
                            tile = tiles[rightTileX][backwardTileZ];
                            if (tile && tile.drawFront) {
                                this.fill(tile, true, loopCycle);
                            }
                        }
                    }

                    if (leftTileX < World.maxX) {
                        if (forwardTileZ >= World.minZ) {
                            tile = tiles[leftTileX][forwardTileZ];
                            if (tile && tile.drawFront) {
                                this.fill(tile, true, loopCycle);
                            }
                        }

                        if (backwardTileZ < World.maxZ) {
                            tile = tiles[leftTileX][backwardTileZ];
                            if (tile && tile.drawFront) {
                                this.fill(tile, true, loopCycle);
                            }
                        }
                    }

                    if (World.fillLeft === 0) {
                        World.click = false;
                        return;
                    }
                }
            }
        }

        for (let level: number = this.minLevel; level < this.maxLevel; level++) {
            const tiles: (Square | null)[][] = this.levelTiles[level];
            for (let dx: number = -25; dx <= 0; dx++) {
                const rightTileX: number = World.gx + dx;
                const leftTileX: number = World.gx - dx;
                if (rightTileX < World.minX && leftTileX >= World.maxX) {
                    continue;
                }

                for (let dz: number = -25; dz <= 0; dz++) {
                    const forwardTileZ: number = World.gz + dz;
                    const backgroundTileZ: number = World.gz - dz;
                    let tile: Square | null;
                    if (rightTileX >= World.minX) {
                        if (forwardTileZ >= World.minZ) {
                            tile = tiles[rightTileX][forwardTileZ];
                            if (tile && tile.drawFront) {
                                this.fill(tile, false, loopCycle);
                            }
                        }

                        if (backgroundTileZ < World.maxZ) {
                            tile = tiles[rightTileX][backgroundTileZ];
                            if (tile && tile.drawFront) {
                                this.fill(tile, false, loopCycle);
                            }
                        }
                    }

                    if (leftTileX < World.maxX) {
                        if (forwardTileZ >= World.minZ) {
                            tile = tiles[leftTileX][forwardTileZ];
                            if (tile && tile.drawFront) {
                                this.fill(tile, false, loopCycle);
                            }
                        }

                        if (backgroundTileZ < World.maxZ) {
                            tile = tiles[leftTileX][backgroundTileZ];
                            if (tile && tile.drawFront) {
                                this.fill(tile, false, loopCycle);
                            }
                        }
                    }

                    if (World.fillLeft === 0) {
                        World.click = false;
                        return;
                    }
                }
            }
        }
    }

    // jag::oldscape::dash3d::world::SetSprite
    private setSprite(
        x: number,
        z: number,
        y: number,
        level: number,
        tileX: number,
        tileZ: number,
        tileSizeX: number,
        tileSizeZ: number,
        model: ModelSource | null,
        typecode: number,
        info: number,
        yaw: number,
        changed: boolean
    ): boolean {
        if (!model) {
            return false;
        }

        for (let tx: number = tileX; tx < tileX + tileSizeX; tx++) {
            for (let tz: number = tileZ; tz < tileZ + tileSizeZ; tz++) {
                if (tx < 0 || tz < 0 || tx >= this.maxTileX || tz >= this.maxTileZ) {
                    return false;
                }

                const tile: Square | null = this.levelTiles[level][tx][tz];
                if (tile && tile.primaryCount >= 5) {
                    return false;
                }
            }
        }

        const loc: Sprite = new Sprite(level, y, x, z, model, yaw, tileX, tileX + tileSizeX - 1, tileZ, tileZ + tileSizeZ - 1, typecode, info);
        for (let tx: number = tileX; tx < tileX + tileSizeX; tx++) {
            for (let tz: number = tileZ; tz < tileZ + tileSizeZ; tz++) {
                let spans: number = 0;
                if (tx > tileX) {
                    spans |= 0x1;
                }
                if (tx < tileX + tileSizeX - 1) {
                    spans += 0x4;
                }
                if (tz > tileZ) {
                    spans += 0x8;
                }
                if (tz < tileZ + tileSizeZ - 1) {
                    spans += 0x2;
                }

                for (let l: number = level; l >= 0; l--) {
                    if (!this.levelTiles[l][tx][tz]) {
                        this.levelTiles[l][tx][tz] = new Square(l, tx, tz);
                    }
                }

                const tile: Square | null = this.levelTiles[level][tx][tz];
                if (tile) {
                    tile.locs[tile.primaryCount] = loc;
                    tile.primaryExtendDirections[tile.primaryCount] = spans;
                    tile.combinedPrimaryExtendDirections |= spans;
                    tile.primaryCount++;
                }
            }
        }

        if (changed) {
            this.changedLocs[this.changedLocCount++] = loc;
        }

        return true;
    }

    // jag::oldscape::dash3d::world::DelSprite
    private delSprite(loc: Sprite): void {
        for (let tx: number = loc.minSceneTileX; tx <= loc.maxSceneTileX; tx++) {
            for (let tz: number = loc.minSceneTileZ; tz <= loc.maxSceneTileZ; tz++) {
                const tile: Square | null = this.levelTiles[loc.locLevel][tx][tz];
                if (!tile) {
                    continue;
                }

                for (let i: number = 0; i < tile.primaryCount; i++) {
                    if (tile.locs[i] === loc) {
                        tile.primaryCount--;
                        for (let j: number = i; j < tile.primaryCount; j++) {
                            tile.locs[j] = tile.locs[j + 1];
                            tile.primaryExtendDirections[j] = tile.primaryExtendDirections[j + 1];
                        }
                        tile.locs[tile.primaryCount] = null;
                        break;
                    }
                }

                tile.combinedPrimaryExtendDirections = 0;

                for (let i: number = 0; i < tile.primaryCount; i++) {
                    tile.combinedPrimaryExtendDirections |= tile.primaryExtendDirections[i];
                }
            }
        }
    }

    // jag::oldscape::dash3d::world::CalcOcclude
    private calcOcclude(): void {
        const count: number = World.levelOccluderCount[World.maxLevel];
        const occluders: (Occlude | null)[] = World.levelOccluders[World.maxLevel];

        World.activeOccluderCount = 0;

        for (let i: number = 0; i < count; i++) {
            const occluder: Occlude | null = occluders[i];
            if (!occluder) {
                continue;
            }

            let deltaMaxY: number;
            let deltaMinTileZ: number;
            let deltaMaxTileZ: number;
            let deltaMaxTileX: number;

            if (occluder.type === 1) {
                deltaMaxY = occluder.minTileX + 25 - World.gx;
                if (deltaMaxY >= 0 && deltaMaxY <= 50) {
                    deltaMinTileZ = occluder.minTileZ + 25 - World.gz;
                    if (deltaMinTileZ < 0) {
                        deltaMinTileZ = 0;
                    }

                    deltaMaxTileZ = occluder.maxTileZ + 25 - World.gz;
                    if (deltaMaxTileZ > 50) {
                        deltaMaxTileZ = 50;
                    }

                    let ok: boolean = false;
                    while (deltaMinTileZ <= deltaMaxTileZ) {
                        if (World.visibilityMap && World.visibilityMap[deltaMaxY][deltaMinTileZ++]) {
                            ok = true;
                            break;
                        }
                    }

                    if (ok) {
                        deltaMaxTileX = World.cx - occluder.minX;
                        if (deltaMaxTileX > 32) {
                            occluder.mode = 1;
                        } else {
                            if (deltaMaxTileX >= -32) {
                                continue;
                            }

                            occluder.mode = 2;
                            deltaMaxTileX = -deltaMaxTileX;
                        }

                        occluder.minDeltaZ = (((occluder.minZ - World.cz) << 8) / deltaMaxTileX) | 0;
                        occluder.maxDeltaZ = (((occluder.maxZ - World.cz) << 8) / deltaMaxTileX) | 0;
                        occluder.minDeltaY = (((occluder.minY - World.cy) << 8) / deltaMaxTileX) | 0;
                        occluder.maxDeltaY = (((occluder.maxY - World.cy) << 8) / deltaMaxTileX) | 0;
                        World.activeOccluders[World.activeOccluderCount++] = occluder;
                    }
                }
            } else if (occluder.type === 2) {
                deltaMaxY = occluder.minTileZ + 25 - World.gz;

                if (deltaMaxY >= 0 && deltaMaxY <= 50) {
                    deltaMinTileZ = occluder.minTileX + 25 - World.gx;
                    if (deltaMinTileZ < 0) {
                        deltaMinTileZ = 0;
                    }

                    deltaMaxTileZ = occluder.maxTileX + 25 - World.gx;
                    if (deltaMaxTileZ > 50) {
                        deltaMaxTileZ = 50;
                    }

                    let ok: boolean = false;
                    while (deltaMinTileZ <= deltaMaxTileZ) {
                        if (World.visibilityMap && World.visibilityMap[deltaMinTileZ++][deltaMaxY]) {
                            ok = true;
                            break;
                        }
                    }

                    if (ok) {
                        deltaMaxTileX = World.cz - occluder.minZ;
                        if (deltaMaxTileX > 32) {
                            occluder.mode = 3;
                        } else {
                            if (deltaMaxTileX >= -32) {
                                continue;
                            }

                            occluder.mode = 4;
                            deltaMaxTileX = -deltaMaxTileX;
                        }

                        occluder.minDeltaX = (((occluder.minX - World.cx) << 8) / deltaMaxTileX) | 0;
                        occluder.maxDeltaX = (((occluder.maxX - World.cx) << 8) / deltaMaxTileX) | 0;
                        occluder.minDeltaY = (((occluder.minY - World.cy) << 8) / deltaMaxTileX) | 0;
                        occluder.maxDeltaY = (((occluder.maxY - World.cy) << 8) / deltaMaxTileX) | 0;
                        World.activeOccluders[World.activeOccluderCount++] = occluder;
                    }
                }
            } else if (occluder.type === 4) {
                deltaMaxY = occluder.minY - World.cy;

                if (deltaMaxY > 128) {
                    deltaMinTileZ = occluder.minTileZ + 25 - World.gz;
                    if (deltaMinTileZ < 0) {
                        deltaMinTileZ = 0;
                    }

                    deltaMaxTileZ = occluder.maxTileZ + 25 - World.gz;
                    if (deltaMaxTileZ > 50) {
                        deltaMaxTileZ = 50;
                    }

                    if (deltaMinTileZ <= deltaMaxTileZ) {
                        let deltaMinTileX: number = occluder.minTileX + 25 - World.gx;
                        if (deltaMinTileX < 0) {
                            deltaMinTileX = 0;
                        }

                        deltaMaxTileX = occluder.maxTileX + 25 - World.gx;
                        if (deltaMaxTileX > 50) {
                            deltaMaxTileX = 50;
                        }

                        let ok: boolean = false;
                        find_visible_tile: for (let x: number = deltaMinTileX; x <= deltaMaxTileX; x++) {
                            for (let z: number = deltaMinTileZ; z <= deltaMaxTileZ; z++) {
                                if (World.visibilityMap && World.visibilityMap[x][z]) {
                                    ok = true;
                                    break find_visible_tile;
                                }
                            }
                        }

                        if (ok) {
                            occluder.mode = 5;
                            occluder.minDeltaX = (((occluder.minX - World.cx) << 8) / deltaMaxY) | 0;
                            occluder.maxDeltaX = (((occluder.maxX - World.cx) << 8) / deltaMaxY) | 0;
                            occluder.minDeltaZ = (((occluder.minZ - World.cz) << 8) / deltaMaxY) | 0;
                            occluder.maxDeltaZ = (((occluder.maxZ - World.cz) << 8) / deltaMaxY) | 0;
                            World.activeOccluders[World.activeOccluderCount++] = occluder;
                        }
                    }
                }
            }
        }
    }

    // jag::oldscape::dash3d::world::Fill
    private fill(next: Square, checkAdjacent: boolean, loopCycle: number): void {
        World.fillQueue.push(next);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let tile: Square | null;

            do {
                tile = World.fillQueue.pop() as Square | null;

                if (!tile) {
                    return;
                }
            } while (!tile.drawBack);

            const tileX: number = tile.x;
            const tileZ: number = tile.z;
            const level: number = tile.level;
            const originalLevel: number = tile.originalLevel;
            const tiles: (Square | null)[][] = this.levelTiles[level];

            if (tile.drawFront) {
                if (checkAdjacent) {
                    if (level > 0) {
                        const above: Square | null = this.levelTiles[level - 1][tileX][tileZ];

                        if (above && above.drawBack) {
                            continue;
                        }
                    }

                    if (tileX <= World.gx && tileX > World.minX) {
                        const adjacent: Square | null = tiles[tileX - 1][tileZ];

                        if (adjacent && adjacent.drawBack && (adjacent.drawFront || (tile.combinedPrimaryExtendDirections & 0x1) === 0)) {
                            continue;
                        }
                    }

                    if (tileX >= World.gx && tileX < World.maxX - 1) {
                        const adjacent: Square | null = tiles[tileX + 1][tileZ];

                        if (adjacent && adjacent.drawBack && (adjacent.drawFront || (tile.combinedPrimaryExtendDirections & 0x4) === 0)) {
                            continue;
                        }
                    }

                    if (tileZ <= World.gz && tileZ > World.minZ) {
                        const adjacent: Square | null = tiles[tileX][tileZ - 1];

                        if (adjacent && adjacent.drawBack && (adjacent.drawFront || (tile.combinedPrimaryExtendDirections & 0x8) === 0)) {
                            continue;
                        }
                    }

                    if (tileZ >= World.gz && tileZ < World.maxZ - 1) {
                        const adjacent: Square | null = tiles[tileX][tileZ + 1];

                        if (adjacent && adjacent.drawBack && (adjacent.drawFront || (tile.combinedPrimaryExtendDirections & 0x2) === 0)) {
                            continue;
                        }
                    }
                } else {
                    checkAdjacent = true;
                }

                tile.drawFront = false;

                if (tile.linkedSquare) {
                    const linkedSquare: Square = tile.linkedSquare;

                    if (!linkedSquare.quickGround) {
                        if (linkedSquare.ground && !this.groundOccluded(0, tileX, tileZ)) {
                            this.renderGround(tileX, tileZ, linkedSquare.ground, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY);
                        }
                    } else if (!this.groundOccluded(0, tileX, tileZ)) {
                        this.renderQuickGround(linkedSquare.quickGround, 0, tileX, tileZ, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY);
                    }

                    const wall: Wall | null = linkedSquare.wall;
                    if (wall) {
                        wall.model1?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall.x - World.cx, wall.y - World.cy, wall.z - World.cz, wall.typecode);
                    }

                    for (let i: number = 0; i < linkedSquare.primaryCount; i++) {
                        const loc: Sprite | null = linkedSquare.locs[i];

                        if (loc) {
                            loc.model?.worldRender(loopCycle, loc.yaw, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, loc.x - World.cx, loc.y - World.cy, loc.z - World.cz, loc.typecode);
                        }
                    }
                }

                let tileDrawn: boolean = false;
                if (!tile.quickGround) {
                    if (tile.ground && !this.groundOccluded(originalLevel, tileX, tileZ)) {
                        tileDrawn = true;
                        this.renderGround(tileX, tileZ, tile.ground, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY);
                    }
                } else if (!this.groundOccluded(originalLevel, tileX, tileZ)) {
                    tileDrawn = true;
                    this.renderQuickGround(tile.quickGround, originalLevel, tileX, tileZ, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY);
                }

                let direction: number = 0;
                let frontWallTypes: number = 0;

                const wall: Wall | null = tile.wall;
                const decor: Decor | null = tile.decor;

                if (wall || decor) {
                    if (World.gx === tileX) {
                        direction += 1;
                    } else if (World.gx < tileX) {
                        direction += 2;
                    }

                    if (World.gz === tileZ) {
                        direction += 3;
                    } else if (World.gz > tileZ) {
                        direction += 6;
                    }

                    frontWallTypes = World.PRETAB[direction];
                    tile.backWallTypes = World.POSTTAB[direction];
                }

                if (wall) {
                    if ((wall.angle1 & World.MIDTAB[direction]) === 0) {
                        tile.cornerSides = 0;
                    } else if (wall.angle1 === 16) {
                        tile.cornerSides = 3;
                        tile.sidesBeforeCorner = World.MIDDEP_16[direction];
                        tile.sidesAfterCorner = 3 - tile.sidesBeforeCorner;
                    } else if (wall.angle1 === 32) {
                        tile.cornerSides = 6;
                        tile.sidesBeforeCorner = World.MIDDEP_32[direction];
                        tile.sidesAfterCorner = 6 - tile.sidesBeforeCorner;
                    } else if (wall.angle1 === 64) {
                        tile.cornerSides = 12;
                        tile.sidesBeforeCorner = World.MIDDEP_64[direction];
                        tile.sidesAfterCorner = 12 - tile.sidesBeforeCorner;
                    } else {
                        tile.cornerSides = 9;
                        tile.sidesBeforeCorner = World.MIDDEP_128[direction];
                        tile.sidesAfterCorner = 9 - tile.sidesBeforeCorner;
                    }

                    if ((wall.angle1 & frontWallTypes) !== 0 && !this.wallOccluded(originalLevel, tileX, tileZ, wall.angle1)) {
                        wall.model1?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall.x - World.cx, wall.y - World.cy, wall.z - World.cz, wall.typecode);
                    }

                    if ((wall.angle2 & frontWallTypes) !== 0 && !this.wallOccluded(originalLevel, tileX, tileZ, wall.angle2)) {
                        wall.model2?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall.x - World.cx, wall.y - World.cy, wall.z - World.cz, wall.typecode);
                    }
                }

                if (decor && !this.spriteOccluded(originalLevel, tileX, tileZ, decor.model.minY)) {
                    if ((decor.angle1 & frontWallTypes) !== 0) {
                        decor.model.worldRender(loopCycle, decor.angle2, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, decor.x - World.cx, decor.y - World.cy, decor.z - World.cz, decor.typecode);
                    } else if ((decor.angle1 & 0x300) !== 0) {
                        const x: number = decor.x - World.cx;
                        const y: number = decor.y - World.cy;
                        const z: number = decor.z - World.cz;
                        const angle: number = decor.angle2;

                        let nearestX: number;
                        if (angle === LocAngle.NORTH || angle === LocAngle.EAST) {
                            nearestX = -x;
                        } else {
                            nearestX = x;
                        }

                        let nearestZ: number;
                        if (angle === LocAngle.EAST || angle === LocAngle.SOUTH) {
                            nearestZ = -z;
                        } else {
                            nearestZ = z;
                        }

                        if ((decor.angle1 & 0x100) !== 0 && nearestZ < nearestX) {
                            const drawX: number = x + World.WALL_DECORATION_INSET_X[angle];
                            const drawZ: number = z + World.WALL_DECORATION_INSET_Z[angle];
                            decor.model.worldRender(loopCycle, angle * 512 + 256, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, drawX, y, drawZ, decor.typecode);
                        }

                        if ((decor.angle1 & 0x200) !== 0 && nearestZ > nearestX) {
                            const drawX: number = x + World.WALL_DECORATION_OUTSET_X[angle];
                            const drawZ: number = z + World.WALL_DECORATION_OUTSET_Z[angle];
                            decor.model.worldRender(loopCycle, (angle * 512 + 1280) & 0x7ff, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, drawX, y, drawZ, decor.typecode);
                        }
                    }
                }

                if (tileDrawn) {
                    const groundDecor: GroundDecor | null = tile.groundDecor;
                    if (groundDecor) {
                        groundDecor.model?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, groundDecor.x - World.cx, groundDecor.y - World.cy, groundDecor.z - World.cz, groundDecor.typecode);
                    }

                    const objs: GroundObject | null = tile.groundObject;
                    if (objs && objs.offset === 0) {
                        if (objs.bottomObj) {
                            objs.bottomObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs.x - World.cx, objs.y - World.cy, objs.z - World.cz, objs.typecode);
                        }

                        if (objs.middleObj) {
                            objs.middleObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs.x - World.cx, objs.y - World.cy, objs.z - World.cz, objs.typecode);
                        }

                        if (objs.topObj) {
                            objs.topObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs.x - World.cx, objs.y - World.cy, objs.z - World.cz, objs.typecode);
                        }
                    }
                }

                const spans: number = tile.combinedPrimaryExtendDirections;

                if (spans !== 0) {
                    if (tileX < World.gx && (spans & 0x4) !== 0) {
                        const adjacent: Square | null = tiles[tileX + 1][tileZ];
                        if (adjacent && adjacent.drawBack) {
                            World.fillQueue.push(adjacent);
                        }
                    }

                    if (tileZ < World.gz && (spans & 0x2) !== 0) {
                        const adjacent: Square | null = tiles[tileX][tileZ + 1];
                        if (adjacent && adjacent.drawBack) {
                            World.fillQueue.push(adjacent);
                        }
                    }

                    if (tileX > World.gx && (spans & 0x1) !== 0) {
                        const adjacent: Square | null = tiles[tileX - 1][tileZ];
                        if (adjacent && adjacent.drawBack) {
                            World.fillQueue.push(adjacent);
                        }
                    }

                    if (tileZ > World.gz && (spans & 0x8) !== 0) {
                        const adjacent: Square | null = tiles[tileX][tileZ - 1];
                        if (adjacent && adjacent.drawBack) {
                            World.fillQueue.push(adjacent);
                        }
                    }
                }
            }

            if (tile.cornerSides !== 0) {
                let draw: boolean = true;
                for (let i: number = 0; i < tile.primaryCount; i++) {
                    const loc: Sprite | null = tile.locs[i];
                    if (!loc) {
                        continue;
                    }

                    if (loc.cycle !== World.cycleNo && (tile.primaryExtendDirections[i] & tile.cornerSides) === tile.sidesBeforeCorner) {
                        draw = false;
                        break;
                    }
                }

                if (draw) {
                    const wall: Wall | null = tile.wall;

                    if (wall && !this.wallOccluded(originalLevel, tileX, tileZ, wall.angle1)) {
                        wall.model1?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall.x - World.cx, wall.y - World.cy, wall.z - World.cz, wall.typecode);
                    }

                    tile.cornerSides = 0;
                }
            }

            if (tile.drawPrimaries) {
                const locCount: number = tile.primaryCount;
                tile.drawPrimaries = false;
                let locBufferSize: number = 0;

                iterate_locs: for (let i: number = 0; i < locCount; i++) {
                    const loc: Sprite | null = tile.locs[i];

                    if (!loc || loc.cycle === World.cycleNo) {
                        continue;
                    }

                    for (let x: number = loc.minSceneTileX; x <= loc.maxSceneTileX; x++) {
                        for (let z: number = loc.minSceneTileZ; z <= loc.maxSceneTileZ; z++) {
                            const other: Square | null = tiles[x][z];

                            if (!other) {
                                continue;
                            }

                            if (other.drawFront) {
                                tile.drawPrimaries = true;
                                continue iterate_locs;
                            }

                            if (other.cornerSides === 0) {
                                continue;
                            }

                            let spans: number = 0;

                            if (x > loc.minSceneTileX) {
                                spans += 1;
                            }

                            if (x < loc.maxSceneTileX) {
                                spans += 4;
                            }

                            if (z > loc.minSceneTileZ) {
                                spans += 8;
                            }

                            if (z < loc.maxSceneTileZ) {
                                spans += 2;
                            }

                            if ((spans & other.cornerSides) !== tile.sidesAfterCorner) {
                                continue;
                            }
                        }
                    }

                    World.locBuffer[locBufferSize++] = loc;

                    let minTileDistanceX: number = World.gx - loc.minSceneTileX;
                    const maxTileDistanceX: number = loc.maxSceneTileX - World.gx;

                    if (maxTileDistanceX > minTileDistanceX) {
                        minTileDistanceX = maxTileDistanceX;
                    }

                    const minTileDistanceZ: number = World.gz - loc.minSceneTileZ;
                    const maxTileDistanceZ: number = loc.maxSceneTileZ - World.gz;

                    if (maxTileDistanceZ > minTileDistanceZ) {
                        loc.distance = minTileDistanceX + maxTileDistanceZ;
                    } else {
                        loc.distance = minTileDistanceX + minTileDistanceZ;
                    }
                }

                // eslint-disable-next-line no-constant-condition
                while (locBufferSize > 0) {
                    let farthestDistance: number = -50;
                    let farthestIndex: number = -1;

                    for (let index: number = 0; index < locBufferSize; index++) {
                        const loc: Sprite | null = World.locBuffer[index];
                        if (!loc) {
                            continue;
                        }

                        if (loc.distance > farthestDistance && loc.cycle !== World.cycleNo) {
                            farthestDistance = loc.distance;
                            farthestIndex = index;
                        }
                    }

                    if (farthestIndex === -1) {
                        break;
                    }

                    const farthest: Sprite | null = World.locBuffer[farthestIndex];
                    if (farthest) {
                        farthest.cycle = World.cycleNo;

                        if (!this.spriteOccluded2(originalLevel, farthest.minSceneTileX, farthest.maxSceneTileX, farthest.minSceneTileZ, farthest.maxSceneTileZ, farthest.model?.minY ?? 0)) {
                            farthest.model?.worldRender(loopCycle, farthest.yaw, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, farthest.x - World.cx, farthest.y - World.cy, farthest.z - World.cz, farthest.typecode);
                        }

                        for (let x: number = farthest.minSceneTileX; x <= farthest.maxSceneTileX; x++) {
                            for (let z: number = farthest.minSceneTileZ; z <= farthest.maxSceneTileZ; z++) {
                                const occupied: Square | null = tiles[x][z];
                                if (!occupied) {
                                    continue;
                                }

                                if (occupied.cornerSides !== 0) {
                                    World.fillQueue.push(occupied);
                                } else if ((x !== tileX || z !== tileZ) && occupied.drawBack) {
                                    World.fillQueue.push(occupied);
                                }
                            }
                        }
                    }
                }

                if (tile.drawPrimaries) {
                    continue;
                }
            }

            if (!tile.drawBack || tile.cornerSides !== 0) {
                continue;
            }

            if (tileX <= World.gx && tileX > World.minX) {
                const adjacent: Square | null = tiles[tileX - 1][tileZ];
                if (adjacent && adjacent.drawBack) {
                    continue;
                }
            }

            if (tileX >= World.gx && tileX < World.maxX - 1) {
                const adjacent: Square | null = tiles[tileX + 1][tileZ];
                if (adjacent && adjacent.drawBack) {
                    continue;
                }
            }

            if (tileZ <= World.gz && tileZ > World.minZ) {
                const adjacent: Square | null = tiles[tileX][tileZ - 1];
                if (adjacent && adjacent.drawBack) {
                    continue;
                }
            }

            if (tileZ >= World.gz && tileZ < World.maxZ - 1) {
                const adjacent: Square | null = tiles[tileX][tileZ + 1];
                if (adjacent && adjacent.drawBack) {
                    continue;
                }
            }

            tile.drawBack = false;
            World.fillLeft--;

            const objs: GroundObject | null = tile.groundObject;
            if (objs && objs.offset !== 0) {
                if (objs.bottomObj) {
                    objs.bottomObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs.x - World.cx, objs.y - World.cy - objs.offset, objs.z - World.cz, objs.typecode);
                }

                if (objs.middleObj) {
                    objs.middleObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs.x - World.cx, objs.y - World.cy - objs.offset, objs.z - World.cz, objs.typecode);
                }

                if (objs.topObj) {
                    objs.topObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs.x - World.cx, objs.y - World.cy - objs.offset, objs.z - World.cz, objs.typecode);
                }
            }

            if (tile.backWallTypes !== 0) {
                const decor: Decor | null = tile.decor;

                if (decor && !this.spriteOccluded(originalLevel, tileX, tileZ, decor.model.minY)) {
                    if ((decor.angle1 & tile.backWallTypes) !== 0) {
                        decor.model.worldRender(loopCycle, decor.angle2, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, decor.x - World.cx, decor.y - World.cy, decor.z - World.cz, decor.typecode);
                    } else if ((decor.angle1 & 0x300) !== 0) {
                        const x: number = decor.x - World.cx;
                        const y: number = decor.y - World.cy;
                        const z: number = decor.z - World.cz;
                        const angle: number = decor.angle2;

                        let nearestX: number;
                        if (angle === LocAngle.NORTH || angle === LocAngle.EAST) {
                            nearestX = -x;
                        } else {
                            nearestX = x;
                        }

                        let nearestZ: number;
                        if (angle === LocAngle.EAST || angle === LocAngle.SOUTH) {
                            nearestZ = -z;
                        } else {
                            nearestZ = z;
                        }

                        if ((decor.angle1 & 0x100) !== 0 && nearestZ >= nearestX) {
                            const drawX: number = x + World.WALL_DECORATION_INSET_X[angle];
                            const drawZ: number = z + World.WALL_DECORATION_INSET_Z[angle];
                            decor.model.worldRender(loopCycle, angle * 512 + 256, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, drawX, y, drawZ, decor.typecode);
                        }

                        if ((decor.angle1 & 0x200) !== 0 && nearestZ <= nearestX) {
                            const drawX: number = x + World.WALL_DECORATION_OUTSET_X[angle];
                            const drawZ: number = z + World.WALL_DECORATION_OUTSET_Z[angle];
                            decor.model.worldRender(loopCycle, (angle * 512 + 1280) & 0x7ff, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, drawX, y, drawZ, decor.typecode);
                        }
                    }
                }

                const wall: Wall | null = tile.wall;
                if (wall) {
                    if ((wall.angle2 & tile.backWallTypes) !== 0 && !this.wallOccluded(originalLevel, tileX, tileZ, wall.angle2)) {
                        wall.model2?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall.x - World.cx, wall.y - World.cy, wall.z - World.cz, wall.typecode);
                    }

                    if ((wall.angle1 & tile.backWallTypes) !== 0 && !this.wallOccluded(originalLevel, tileX, tileZ, wall.angle1)) {
                        wall.model1?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall.x - World.cx, wall.y - World.cy, wall.z - World.cz, wall.typecode);
                    }
                }
            }

            if (level < this.maxLevel - 1) {
                const above: Square | null = this.levelTiles[level + 1][tileX][tileZ];
                if (above && above.drawBack) {
                    World.fillQueue.push(above);
                }
            }

            if (tileX < World.gx) {
                const adjacent: Square | null = tiles[tileX + 1][tileZ];
                if (adjacent && adjacent.drawBack) {
                    World.fillQueue.push(adjacent);
                }
            }

            if (tileZ < World.gz) {
                const adjacent: Square | null = tiles[tileX][tileZ + 1];
                if (adjacent && adjacent.drawBack) {
                    World.fillQueue.push(adjacent);
                }
            }

            if (tileX > World.gx) {
                const adjacent: Square | null = tiles[tileX - 1][tileZ];
                if (adjacent && adjacent.drawBack) {
                    World.fillQueue.push(adjacent);
                }
            }

            if (tileZ > World.gz) {
                const adjacent: Square | null = tiles[tileX][tileZ - 1];
                if (adjacent && adjacent.drawBack) {
                    World.fillQueue.push(adjacent);
                }
            }
        }
    }

    // jag::oldscape::dash3d::SoftwareWorldRenderer::RenderQuickGround
    private renderQuickGround(quick: QuickGround, level: number, tileX: number, tileZ: number, sinEyePitch: number, cosEyePitch: number, sinEyeYaw: number, cosEyeYaw: number): void {
        let x3: number;
        let x0: number = (x3 = (tileX << 7) - World.cx);
        let z1: number;
        let z0: number = (z1 = (tileZ << 7) - World.cz);
        let x2: number;
        let x1: number = (x2 = x0 + 128);
        let z3: number;
        let z2: number = (z3 = z0 + 128);

        let y0: number = this.groundHeight[level][tileX][tileZ] - World.cy;
        let y1: number = this.groundHeight[level][tileX + 1][tileZ] - World.cy;
        let y2: number = this.groundHeight[level][tileX + 1][tileZ + 1] - World.cy;
        let y3: number = this.groundHeight[level][tileX][tileZ + 1] - World.cy;

        let tmp: number = (z0 * sinEyeYaw + x0 * cosEyeYaw) >> 16;
        z0 = (z0 * cosEyeYaw - x0 * sinEyeYaw) >> 16;
        x0 = tmp;

        tmp = (y0 * cosEyePitch - z0 * sinEyePitch) >> 16;
        z0 = (y0 * sinEyePitch + z0 * cosEyePitch) >> 16;
        y0 = tmp;

        if (z0 < 50) {
            return;
        }

        tmp = (z1 * sinEyeYaw + x1 * cosEyeYaw) >> 16;
        z1 = (z1 * cosEyeYaw - x1 * sinEyeYaw) >> 16;
        x1 = tmp;

        tmp = (y1 * cosEyePitch - z1 * sinEyePitch) >> 16;
        z1 = (y1 * sinEyePitch + z1 * cosEyePitch) >> 16;
        y1 = tmp;

        if (z1 < 50) {
            return;
        }

        tmp = (z2 * sinEyeYaw + x2 * cosEyeYaw) >> 16;
        z2 = (z2 * cosEyeYaw - x2 * sinEyeYaw) >> 16;
        x2 = tmp;

        tmp = (y2 * cosEyePitch - z2 * sinEyePitch) >> 16;
        z2 = (y2 * sinEyePitch + z2 * cosEyePitch) >> 16;
        y2 = tmp;

        if (z2 < 50) {
            return;
        }

        tmp = (z3 * sinEyeYaw + x3 * cosEyeYaw) >> 16;
        z3 = (z3 * cosEyeYaw - x3 * sinEyeYaw) >> 16;
        x3 = tmp;

        tmp = (y3 * cosEyePitch - z3 * sinEyePitch) >> 16;
        z3 = (y3 * sinEyePitch + z3 * cosEyePitch) >> 16;
        y3 = tmp;

        if (z3 < 50) {
            return;
        }

        const px0: number = Pix3D.centerX + (((x0 << 9) / z0) | 0);
        const py0: number = Pix3D.centerY + (((y0 << 9) / z0) | 0);
        const pz0: number = Pix3D.centerX + (((x1 << 9) / z1) | 0);
        const px1: number = Pix3D.centerY + (((y1 << 9) / z1) | 0);
        const py1: number = Pix3D.centerX + (((x2 << 9) / z2) | 0);
        const pz1: number = Pix3D.centerY + (((y2 << 9) / z2) | 0);
        const px3: number = Pix3D.centerX + (((x3 << 9) / z3) | 0);
        const py3: number = Pix3D.centerY + (((y3 << 9) / z3) | 0);

        Pix3D.trans = 0;

        if ((py1 - px3) * (px1 - py3) - (pz1 - py3) * (pz0 - px3) > 0) {
            Pix3D.hclip = py1 < 0 || px3 < 0 || pz0 < 0 || py1 > Pix2D.boundX || px3 > Pix2D.boundX || pz0 > Pix2D.boundX;

            if (World.click && this.insideTriangle(World.clickX, World.clickY, pz1, py3, px1, py1, px3, pz0)) {
                World.groundX = tileX;
                World.groundZ = tileZ;
            }

            if (quick.textureId === -1) {
                if (quick.northeastColor !== 12345678) {
                    Pix3D.gouraudTriangle(py1, px3, pz0, pz1, py3, px1, quick.northeastColor, quick.northwestColor, quick.southeastColor);
                }
            } else if (World.lowMem) {
                const averageColor: number = World.TEXTURE_HSL[quick.textureId];
                Pix3D.gouraudTriangle(py1, px3, pz0, pz1, py3, px1, this.mulLightness(averageColor, quick.northeastColor), this.mulLightness(averageColor, quick.northwestColor), this.mulLightness(averageColor, quick.southeastColor));
            } else if (quick.flat) {
                Pix3D.textureTriangle(py1, px3, pz0, pz1, py3, px1, quick.northeastColor, quick.northwestColor, quick.southeastColor, x0, y0, z0, x1, x3, y1, y3, z1, z3, quick.textureId);
            } else {
                Pix3D.textureTriangle(py1, px3, pz0, pz1, py3, px1, quick.northeastColor, quick.northwestColor, quick.southeastColor, x2, y2, z2, x3, x1, y3, y1, z3, z1, quick.textureId);
            }
        }

        if ((px0 - pz0) * (py3 - px1) - (py0 - px1) * (px3 - pz0) > 0) {
            Pix3D.hclip = px0 < 0 || pz0 < 0 || px3 < 0 || px0 > Pix2D.boundX || pz0 > Pix2D.boundX || px3 > Pix2D.boundX;

            if (World.click && this.insideTriangle(World.clickX, World.clickY, py0, px1, py3, px0, pz0, px3)) {
                World.groundX = tileX;
                World.groundZ = tileZ;
            }

            if (quick.textureId !== -1) {
                if (!World.lowMem) {
                    Pix3D.textureTriangle(px0, pz0, px3, py0, px1, py3, quick.southwestColor, quick.southeastColor, quick.northwestColor, x0, y0, z0, x1, x3, y1, y3, z1, z3, quick.textureId);
                } else {
                    const averageColor: number = World.TEXTURE_HSL[quick.textureId];
                    Pix3D.gouraudTriangle(px0, pz0, px3, py0, px1, py3, this.mulLightness(averageColor, quick.southwestColor), this.mulLightness(averageColor, quick.southeastColor), this.mulLightness(averageColor, quick.northwestColor));
                }
            } else if (quick.southwestColor !== 12345678) {
                Pix3D.gouraudTriangle(px0, pz0, px3, py0, px1, py3, quick.southwestColor, quick.southeastColor, quick.northwestColor);
            }
        }
    }

    // jag::oldscape::dash3d::SoftwareWorldRenderer::RenderGround
    private renderGround(tileX: number, tileZ: number, ground: Ground, sinEyePitch: number, cosEyePitch: number, sinEyeYaw: number, cosEyeYaw: number): void {
        let vertexCount: number = ground.vertexX.length;

        for (let i: number = 0; i < vertexCount; i++) {
            let x: number = ground.vertexX[i] - World.cx;
            let y: number = ground.vertexY[i] - World.cy;
            let z: number = ground.vertexZ[i] - World.cz;

            let tmp: number = (z * sinEyeYaw + x * cosEyeYaw) >> 16;
            z = (z * cosEyeYaw - x * sinEyeYaw) >> 16;
            x = tmp;

            tmp = (y * cosEyePitch - z * sinEyePitch) >> 16;
            z = (y * sinEyePitch + z * cosEyePitch) >> 16;
            y = tmp;

            if (z < 50) {
                return;
            }

            if (ground.triangleTextureIds) {
                Ground.drawTextureVertexX[i] = x;
                Ground.drawTextureVertexY[i] = y;
                Ground.drawTextureVertexZ[i] = z;
            }

            Ground.drawVertexX[i] = Pix3D.centerX + (((x << 9) / z) | 0);
            Ground.drawVertexY[i] = Pix3D.centerY + (((y << 9) / z) | 0);
        }

        Pix3D.trans = 0;

        vertexCount = ground.triangleVertexA.length;
        for (let v: number = 0; v < vertexCount; v++) {
            const a: number = ground.triangleVertexA[v];
            const b: number = ground.triangleVertexB[v];
            const c: number = ground.triangleVertexC[v];

            const x0: number = Ground.drawVertexX[a];
            const x1: number = Ground.drawVertexX[b];
            const x2: number = Ground.drawVertexX[c];
            const y0: number = Ground.drawVertexY[a];
            const y1: number = Ground.drawVertexY[b];
            const y2: number = Ground.drawVertexY[c];

            if ((x0 - x1) * (y2 - y1) - (y0 - y1) * (x2 - x1) > 0) {
                Pix3D.hclip = x0 < 0 || x1 < 0 || x2 < 0 || x0 > Pix2D.boundX || x1 > Pix2D.boundX || x2 > Pix2D.boundX;

                if (World.click && this.insideTriangle(World.clickX, World.clickY, y0, y1, y2, x0, x1, x2)) {
                    World.groundX = tileX;
                    World.groundZ = tileZ;
                }

                if (!ground.triangleTextureIds || ground.triangleTextureIds[v] === -1) {
                    if (ground.triangleColorA[v] !== 12345678) {
                        Pix3D.gouraudTriangle(x0, x1, x2, y0, y1, y2, ground.triangleColorA[v], ground.triangleColorB[v], ground.triangleColorC[v]);
                    }
                } else if (World.lowMem) {
                    const textureColor: number = World.TEXTURE_HSL[ground.triangleTextureIds[v]];
                    Pix3D.gouraudTriangle(x0, x1, x2, y0, y1, y2, this.mulLightness(textureColor, ground.triangleColorA[v]), this.mulLightness(textureColor, ground.triangleColorB[v]), this.mulLightness(textureColor, ground.triangleColorC[v]));
                } else if (ground.flat) {
                    Pix3D.textureTriangle(
                        x0,
                        x1,
                        x2,
                        y0,
                        y1,
                        y2,
                        ground.triangleColorA[v],
                        ground.triangleColorB[v],
                        ground.triangleColorC[v],
                        Ground.drawTextureVertexX[0],
                        Ground.drawTextureVertexY[0],
                        Ground.drawTextureVertexZ[0],
                        Ground.drawTextureVertexX[1],
                        Ground.drawTextureVertexX[3],
                        Ground.drawTextureVertexY[1],
                        Ground.drawTextureVertexY[3],
                        Ground.drawTextureVertexZ[1],
                        Ground.drawTextureVertexZ[3],
                        ground.triangleTextureIds[v]
                    );
                } else {
                    Pix3D.textureTriangle(
                        x0,
                        x1,
                        x2,
                        y0,
                        y1,
                        y2,
                        ground.triangleColorA[v],
                        ground.triangleColorB[v],
                        ground.triangleColorC[v],
                        Ground.drawTextureVertexX[a],
                        Ground.drawTextureVertexY[a],
                        Ground.drawTextureVertexZ[a],
                        Ground.drawTextureVertexX[b],
                        Ground.drawTextureVertexX[c],
                        Ground.drawTextureVertexY[b],
                        Ground.drawTextureVertexY[c],
                        Ground.drawTextureVertexZ[b],
                        Ground.drawTextureVertexZ[c],
                        ground.triangleTextureIds[v]
                    );
                }
            }
        }
    }

    // jag::oldscape::dash3d::world::GroundoOcluded [sic]
    private groundOccluded(level: number, x: number, z: number): boolean {
        const cycle: number = this.occlusionCycle[level][x][z];
        if (cycle === -World.cycleNo) {
            return false;
        } else if (cycle === World.cycleNo) {
            return true;
        } else {
            const sx: number = x << 7;
            const sz: number = z << 7;
            if (
                this.occluded(sx + 1, this.groundHeight[level][x][z], sz + 1) &&
                this.occluded(sx + 128 - 1, this.groundHeight[level][x + 1][z], sz + 1) &&
                this.occluded(sx + 128 - 1, this.groundHeight[level][x + 1][z + 1], sz + 128 - 1) &&
                this.occluded(sx + 1, this.groundHeight[level][x][z + 1], sz + 128 - 1)
            ) {
                this.occlusionCycle[level][x][z] = World.cycleNo;
                return true;
            } else {
                this.occlusionCycle[level][x][z] = -World.cycleNo;
                return false;
            }
        }
    }

    // jag::oldscape::dash3d::world::WallOccluded
    private wallOccluded(level: number, x: number, z: number, type: number): boolean {
        if (!this.groundOccluded(level, x, z)) {
            return false;
        }

        const sceneX: number = x << 7;
        const sceneZ: number = z << 7;
        const sceneY: number = this.groundHeight[level][x][z] - 1;
        const y0: number = sceneY - 120;
        const y1: number = sceneY - 230;
        const y2: number = sceneY - 238;
        if (type < 16) {
            if (type === 1) {
                if (sceneX > World.cx) {
                    if (!this.occluded(sceneX, sceneY, sceneZ)) {
                        return false;
                    }
                    if (!this.occluded(sceneX, sceneY, sceneZ + 128)) {
                        return false;
                    }
                }
                if (level > 0) {
                    if (!this.occluded(sceneX, y0, sceneZ)) {
                        return false;
                    }
                    if (!this.occluded(sceneX, y0, sceneZ + 128)) {
                        return false;
                    }
                }
                if (!this.occluded(sceneX, y1, sceneZ)) {
                    return false;
                }
                return this.occluded(sceneX, y1, sceneZ + 128);
            }
            if (type === 2) {
                if (sceneZ < World.cz) {
                    if (!this.occluded(sceneX, sceneY, sceneZ + 128)) {
                        return false;
                    }
                    if (!this.occluded(sceneX + 128, sceneY, sceneZ + 128)) {
                        return false;
                    }
                }
                if (level > 0) {
                    if (!this.occluded(sceneX, y0, sceneZ + 128)) {
                        return false;
                    }
                    if (!this.occluded(sceneX + 128, y0, sceneZ + 128)) {
                        return false;
                    }
                }
                if (!this.occluded(sceneX, y1, sceneZ + 128)) {
                    return false;
                }
                return this.occluded(sceneX + 128, y1, sceneZ + 128);
            }
            if (type === 4) {
                if (sceneX < World.cx) {
                    if (!this.occluded(sceneX + 128, sceneY, sceneZ)) {
                        return false;
                    }
                    if (!this.occluded(sceneX + 128, sceneY, sceneZ + 128)) {
                        return false;
                    }
                }
                if (level > 0) {
                    if (!this.occluded(sceneX + 128, y0, sceneZ)) {
                        return false;
                    }
                    if (!this.occluded(sceneX + 128, y0, sceneZ + 128)) {
                        return false;
                    }
                }
                if (!this.occluded(sceneX + 128, y1, sceneZ)) {
                    return false;
                }
                return this.occluded(sceneX + 128, y1, sceneZ + 128);
            }
            if (type === 8) {
                if (sceneZ > World.cz) {
                    if (!this.occluded(sceneX, sceneY, sceneZ)) {
                        return false;
                    }
                    if (!this.occluded(sceneX + 128, sceneY, sceneZ)) {
                        return false;
                    }
                }
                if (level > 0) {
                    if (!this.occluded(sceneX, y0, sceneZ)) {
                        return false;
                    }
                    if (!this.occluded(sceneX + 128, y0, sceneZ)) {
                        return false;
                    }
                }
                if (!this.occluded(sceneX, y1, sceneZ)) {
                    return false;
                }
                return this.occluded(sceneX + 128, y1, sceneZ);
            }
        }

        if (!this.occluded(sceneX + 64, y2, sceneZ + 64)) {
            return false;
        } else if (type === 16) {
            return this.occluded(sceneX, y1, sceneZ + 128);
        } else if (type === 32) {
            return this.occluded(sceneX + 128, y1, sceneZ + 128);
        } else if (type === 64) {
            return this.occluded(sceneX + 128, y1, sceneZ);
        } else if (type === 128) {
            return this.occluded(sceneX, y1, sceneZ);
        }

        console.warn('Warning unsupported wall type!');
        return true;
    }

    // jag::oldscape::dash3d::world::SpriteOccluded
    private spriteOccluded(level: number, tileX: number, tileZ: number, y: number): boolean {
        if (this.groundOccluded(level, tileX, tileZ)) {
            const x: number = tileX << 7;
            const z: number = tileZ << 7;
            return (
                this.occluded(x + 1, this.groundHeight[level][tileX][tileZ] - y, z + 1) &&
                this.occluded(x + 128 - 1, this.groundHeight[level][tileX + 1][tileZ] - y, z + 1) &&
                this.occluded(x + 128 - 1, this.groundHeight[level][tileX + 1][tileZ + 1] - y, z + 128 - 1) &&
                this.occluded(x + 1, this.groundHeight[level][tileX][tileZ + 1] - y, z + 128 - 1)
            );
        }
        return false;
    }

    // jag::oldscape::dash3d::world::SpriteOccluded
    private spriteOccluded2(level: number, minX: number, maxX: number, minZ: number, maxZ: number, y: number): boolean {
        let x: number;
        let z: number;
        if (minX !== maxX || minZ !== maxZ) {
            for (x = minX; x <= maxX; x++) {
                for (z = minZ; z <= maxZ; z++) {
                    if (this.occlusionCycle[level][x][z] === -World.cycleNo) {
                        return false;
                    }
                }
            }

            z = (minX << 7) + 1;
            const z0: number = (minZ << 7) + 2;
            const y0: number = this.groundHeight[level][minX][minZ] - y;
            if (!this.occluded(z, y0, z0)) {
                return false;
            }

            const x1: number = (maxX << 7) - 1;
            if (!this.occluded(x1, y0, z0)) {
                return false;
            }

            const z1: number = (maxZ << 7) - 1;
            if (!this.occluded(z, y0, z1)) {
                return false;
            } else return this.occluded(x1, y0, z1);
        } else if (this.groundOccluded(level, minX, minZ)) {
            x = minX << 7;
            z = minZ << 7;
            return (
                this.occluded(x + 1, this.groundHeight[level][minX][minZ] - y, z + 1) &&
                this.occluded(x + 128 - 1, this.groundHeight[level][minX + 1][minZ] - y, z + 1) &&
                this.occluded(x + 128 - 1, this.groundHeight[level][minX + 1][minZ + 1] - y, z + 128 - 1) &&
                this.occluded(x + 1, this.groundHeight[level][minX][minZ + 1] - y, z + 128 - 1)
            );
        }
        return false;
    }

    // jag::oldscape::dash3d::world::Occluded
    private occluded(x: number, y: number, z: number): boolean {
        for (let i: number = 0; i < World.activeOccluderCount; i++) {
            const occluder: Occlude | null = World.activeOccluders[i];
            if (!occluder) {
                continue;
            }

            if (occluder.mode === 1) {
                const dx: number = occluder.minX - x;
                if (dx > 0) {
                    const minZ: number = occluder.minZ + ((occluder.minDeltaZ * dx) >> 8);
                    const maxZ: number = occluder.maxZ + ((occluder.maxDeltaZ * dx) >> 8);
                    const minY: number = occluder.minY + ((occluder.minDeltaY * dx) >> 8);
                    const maxY: number = occluder.maxY + ((occluder.maxDeltaY * dx) >> 8);
                    if (z >= minZ && z <= maxZ && y >= minY && y <= maxY) {
                        return true;
                    }
                }
            } else if (occluder.mode === 2) {
                const dx: number = x - occluder.minX;
                if (dx > 0) {
                    const minZ: number = occluder.minZ + ((occluder.minDeltaZ * dx) >> 8);
                    const maxZ: number = occluder.maxZ + ((occluder.maxDeltaZ * dx) >> 8);
                    const minY: number = occluder.minY + ((occluder.minDeltaY * dx) >> 8);
                    const maxY: number = occluder.maxY + ((occluder.maxDeltaY * dx) >> 8);
                    if (z >= minZ && z <= maxZ && y >= minY && y <= maxY) {
                        return true;
                    }
                }
            } else if (occluder.mode === 3) {
                const dz: number = occluder.minZ - z;
                if (dz > 0) {
                    const minX: number = occluder.minX + ((occluder.minDeltaX * dz) >> 8);
                    const maxX: number = occluder.maxX + ((occluder.maxDeltaX * dz) >> 8);
                    const minY: number = occluder.minY + ((occluder.minDeltaY * dz) >> 8);
                    const maxY: number = occluder.maxY + ((occluder.maxDeltaY * dz) >> 8);
                    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                        return true;
                    }
                }
            } else if (occluder.mode === 4) {
                const dz: number = z - occluder.minZ;
                if (dz > 0) {
                    const minX: number = occluder.minX + ((occluder.minDeltaX * dz) >> 8);
                    const maxX: number = occluder.maxX + ((occluder.maxDeltaX * dz) >> 8);
                    const minY: number = occluder.minY + ((occluder.minDeltaY * dz) >> 8);
                    const maxY: number = occluder.maxY + ((occluder.maxDeltaY * dz) >> 8);
                    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                        return true;
                    }
                }
            } else if (occluder.mode === 5) {
                const dy: number = y - occluder.minY;
                if (dy > 0) {
                    const minX: number = occluder.minX + ((occluder.minDeltaX * dy) >> 8);
                    const maxX: number = occluder.maxX + ((occluder.maxDeltaX * dy) >> 8);
                    const minZ: number = occluder.minZ + ((occluder.minDeltaZ * dy) >> 8);
                    const maxZ: number = occluder.maxZ + ((occluder.maxDeltaZ * dy) >> 8);
                    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // jag::oldscape::dash3d::world::InsideTriangle
    private insideTriangle(x: number, y: number, y0: number, y1: number, y2: number, x0: number, x1: number, x2: number): boolean {
        if (y < y0 && y < y1 && y < y2) {
            return false;
        } else if (y > y0 && y > y1 && y > y2) {
            return false;
        } else if (x < x0 && x < x1 && x < x2) {
            return false;
        } else if (x > x0 && x > x1 && x > x2) {
            return false;
        }

        const crossProduct_01: number = (y - y0) * (x1 - x0) - (x - x0) * (y1 - y0);
        const crossProduct_20: number = (y - y2) * (x0 - x2) - (x - x2) * (y0 - y2);
        const crossProduct_12: number = (y - y1) * (x2 - x1) - (x - x1) * (y2 - y1);
        return crossProduct_01 * crossProduct_12 > 0 && crossProduct_12 * crossProduct_20 > 0;
    }

    private mulLightness(hsl: number, lightness: number): number {
        const invLightness: number = 127 - lightness;
        lightness = ((invLightness * (hsl & 0x7f)) / 160) | 0;
        if (lightness < 2) {
            lightness = 2;
        } else if (lightness > 126) {
            lightness = 126;
        }
        return (hsl & 0xff80) + lightness;
    }
}
