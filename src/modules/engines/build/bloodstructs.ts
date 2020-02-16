import { Sector, Wall, Sprite, Board } from "./structs";

export class SectorExtra {
  public reference: number;
  public state: number;
  public busy: number;
  public data: number;
  public txID: number;
  public waveTime1: number;
  public waveTime0: number;
  public rxID: number;
  public command: number;
  public triggerOn: number;
  public triggerOff: number;
  public busyTime1: number;
  public waitTime1: number;
  public unk1: number;
  public interruptable: number;
  public amplitude: number;
  public freq: number;
  public waitFlag1: number;
  public waitFlag0: number;
  public phase: number;
  public wave: number;
  public shadeAlways: number;
  public shadeFloor: number;
  public shadeCeiling: number;
  public shadeWalls: number;
  public shade: number;
  public panAlways: number;
  public panFloor: number;
  public panCeiling: number;
  public Drag: number;
  public Underwater: number;
  public Depth: number;
  public panVel: number;
  public panAngle: number;
  public wind: number;
  public decoupled: number;
  public triggerOnce: number;
  public isTriggered: number;
  public Key: number;
  public Push: number;
  public Vector: number;
  public Reserved: number;
  public Enter: number;
  public Exit: number;
  public Wallpush: number;
  public color: number;
  public unk2: number;
  public busyTime0: number;
  public waitTime0: number;
  public unk3: number;
  public unk4: number;
  public ceilpal: number;
  public offCeilZ: number;
  public onCeilZ: number;
  public offFloorZ: number;
  public onFloorZ: number;
  public marker0: number;
  public marker1: number;
  public Crush: number;
  public ceilxpanFrac: number;
  public ceilypanFrac: number;
  public floorxpanFrac: number;
  public damageType: number;
  public floorpal: number;
  public floorypanFrac: number;
  public locked: number;
  public windVel: number;
  public windAng: number;
  public windAlways: number;
  public dudelockout: number;
  public bobTheta: number;
  public bobZRange: number;
  public bobSpeed: number;
  public bobAlways: number;
  public bobFloor: number;
  public bobCeiling: number;
  public bobRotate: number;
}

export class BloodSector extends Sector {
  public extraData: SectorExtra;
}

export class WallExtra {
  public reference: number;
  public state: number;
  public busy: number;
  public data: number;
  public txID: number;
  public unk1: number;
  public rxID: number;
  public command: number;
  public triggerOn: number;
  public triggerOff: number;
  public busyTime: number;
  public waitTime: number;
  public restState: number;
  public interruptable: number;
  public panAlways: number;
  public panX: number;
  public panY: number;
  public decoupled: number;
  public triggerOnce: number;
  public unk2: number;
  public Key: number;
  public Push: number;
  public Vector: number;
  public Reserved: number;
  public unk3: number;
  public xPanFrac: number;
  public yPanFrac: number;
  public Locked: number;
  public DudeLockout: number;
  public unk4: number;
  public unk5: number;
}

export class BloodWall extends Wall {
  public extraData: WallExtra;
}

export class SpriteExtra {
  public reference: number;
  public state: number;
  public busy: number;
  public txID: number;
  public rxID: number;
  public command: number;
  public triggerOn: number;
  public triggerOff: number;
  public Wave: number;
  public busyTime: number;
  public waitTime: number;
  public restState: number;
  public interruptable: number;
  public unk1: number;
  public respawnPending: number;
  public unk2: number;
  public launchTeam: number;
  public dropItem: number;
  public decoupled: number;
  public triggerOnce: number;
  public unk3: number;
  public Key: number;
  public Push: number;
  public Vector: number;
  public Impact: number;
  public Pickup: number;
  public Touch: number;
  public Sight: number;
  public Proximity: number;
  public unk4: number;
  public launch12345: number;
  public single: number;
  public bloodbath: number;
  public coop: number;
  public DudeLockout: number;
  public data1: number;
  public data2: number;
  public data3: number;
  public unk5: number;
  public Dodge: number;
  public Locked: number;
  public unk6: number;
  public respawnOption: number;
  public data4: number;
  public unk7: number;
  public LockMsg: number;
  public unk8: number;
  public dudeDeaf: number;
  public dudeAmbush: number;
  public dudeGuard: number;
  public dfReserved: number;
  public target: number;
  public targetX: number;
  public targetY: number;
  public unk9: number;
  public unk10: number;
  public unk11: number;
  public unk12: number;
  public aiTimer: number;
  public ai: number;
}

export class BloodSprite extends Sprite {
  public extraData: SpriteExtra;
}

export class BloodBoard extends Board {
  public sectors: BloodSector[];
  public walls: BloodWall[];
  public sprites: BloodSprite[];
}