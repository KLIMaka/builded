
//  wallptr - index to first wall of sector
//  wallnum - number of walls in sector
//  z's - z coordinate (height) of ceiling / floor at first point of sector
//  stat's
//  bit 0: 1 = parallaxing, 0 = not                                 "P"
//  bit 1: 1 = groudraw, 0 = not
//  bit 2: 1 = swap x&y, 0 = not                                    "F"
//  bit 3: 1 = double smooshiness                                   "E"
//  bit 4: 1 = x-flip                                               "F"
//  bit 5: 1 = y-flip                                               "F"
//  bit 6: 1 = Align texture to first wall of sector                "R"
//  bits 8-7:                                                       "T"
//         00 = normal floors
//         01 = masked floors
//         10 = transluscent masked floors
//         11 = reverse transluscent masked floors
//  bit 9: 1 = blocking ceiling/floor
//  bit 10: 1 = YAX'ed ceiling/floor
//  bit 11: 1 = hitscan-sensitive ceiling/floor
//  bits 12-15: reserved
//  picnum's - texture index into art file
//  heinum's - slope value (rise/run) (0-parallel to floor, 4096-45 degrees)
//  shade's - shade offset of ceiling/floor
//  pal's - palette lookup table number (0 - use standard colors)
//  panning's - used to align textures or to do texture panning
//  visibility - determines how fast an area changes shade relative to distance
//  filler - useless byte to make structure aligned
//  lotag, hitag, extra - These variables used by the game programmer only

export type SectorStats = {
  parallaxing: boolean;
  slopped: number;
  swapXY: number;
  doubleSmooshiness: number;
  xflip: number;
  yflip: number;
  alignToFirstWall: number;
  type: number;
  blocking: number;
  tror: number;
  hitscan: number;
  unk12: number;
  unk13: number;
  unk14: number;
  floorShade: number
}

export type Sector<Stats extends SectorStats = SectorStats> = {
  wallptr: number;
  wallnum: number;
  ceilingz: number;
  floorz: number;
  ceilingstat: Stats;
  floorstat: Stats;
  ceilingpicnum: number;
  ceilingheinum: number;
  ceilingshade: number;
  ceilingpal: number;
  ceilingxpanning: number;
  ceilingypanning: number;
  floorpicnum: number;
  floorheinum: number;
  floorshade: number;
  floorpal: number;
  floorxpanning: number;
  floorypanning: number;
  visibility: number;
  filler: number;
  lotag: number;
  hitag: number;
  extra: number;
}

//  x, y: Coordinate of left side of wall, get right side from next wall's left side
//  point2: Index to next wall on the right (always in the same sector)
//  nextwall: Index to wall on other side of wall (-1 if there is no sector)
//  nextsector: Index to sector on other side of wall (-1 if there is no sector)
//  cstat:
//  bit 0: 1 = Blocking wall (use with clipmove, getzrange)         "B"
//  bit 1: 1 = bottoms of invisible walls swapped, 0 = not          "2"
//  bit 2: 1 = align picture on bottom (for doors), 0 = top         "O"
//  bit 3: 1 = x-flipped, 0 = normal                                "F"
//  bit 4: 1 = masking wall, 0 = not                                "M"
//  bit 5: 1 = 1-way wall, 0 = not                                  "1"
//  bit 6: 1 = Blocking wall (use with hitscan / cliptype 1)        "H"
//  bit 7: 1 = Transluscence, 0 = not                               "T"
//  bit 8: 1 = y-flipped, 0 = normal                                "F"
//  bit 9: 1 = Transluscence reversing, 0 = normal                  "T"
//  bits 10-15: reserved
//  picnum - texture index into art file
//  overpicnum - texture index into art file for masked walls / 1-way walls
//  shade - shade offset of wall
//  pal - palette lookup table number (0 - use standard colors)
//  repeat's - used to change the size of pixels (stretch textures)
//  pannings - used to align textures or to do texture panning
//  lotag, hitag, extra - These variables used by the game programmer only

export type WallStats = {
  blocking: number;
  swapBottoms: number;
  alignBottom: number;
  xflip: number;
  masking: number;
  oneWay: number;
  blocking2: number;
  translucent: number;
  yflip: number;
  translucentReversed: number;
  yaxUpWall: number;
  yaxDownWall: number;
  rotate90: number;
  unk13: number;
  unk14: number;
  unk15: number;
}

export type Wall = {
  x: number;
  y: number;
  point2: number;
  nextwall: number;
  nextsector: number;
  cstat: WallStats;
  picnum: number;
  overpicnum: number;
  shade: number;
  pal: number;
  xrepeat: number;
  yrepeat: number;
  xpanning: number;
  ypanning: number;
  lotag: number;
  hitag: number;
  extra: number;
}

//  x, y, z - position of sprite - can be defined at center bottom or center
//  cstat:
//    bit 0: 1 = Blocking sprite (use with clipmove, getzrange)       "B"
//  bit 1: 1 = transluscence, 0 = normal                            "T"
//  bit 2: 1 = x-flipped, 0 = normal                                "F"
//  bit 3: 1 = y-flipped, 0 = normal                                "F"
//  bits 5-4: 00 = FACE sprite (default)                            "R"
//  01 = WALL sprite (like masked walls)
//  10 = FLOOR sprite (parallel to ceilings&floors)
//  bit 6: 1 = 1-sided sprite, 0 = normal                           "1"
//  bit 7: 1 = Real centered centering, 0 = foot center             "C"
//  bit 8: 1 = Blocking sprite (use with hitscan / cliptype 1)      "H"
//  bit 9: 1 = Transluscence reversing, 0 = normal                  "T"
//  bits 10-14: reserved
//  bit 15: 1 = Invisible sprite, 0 = not invisible
//  picnum - texture index into art file
//  shade - shade offset of sprite
//  pal - palette lookup table number (0 - use standard colors)
//  clipdist - the size of the movement clipping square (face sprites only)
//  filler - useless byte to make structure aligned
//  repeat's - used to change the size of pixels (stretch textures)
//  offset's - used to center the animation of sprites
//  sectnum - current sector of sprite
//  statnum - current status of sprite (inactive/monster/bullet, etc.)
//
//  ang - angle the sprite is facing
//  owner, xvel, yvel, zvel, lotag, hitag, extra - These variables used by the
//  game programmer only

export const FACE_SPRITE = 0;
export const WALL_SPRITE = 1;
export const FLOOR_SPRITE = 2;

export type SpriteStats = {
  blocking: number;
  translucent: number;
  xflip: number;
  yflip: number;
  type: number; // 0 - FACE, 1 - WALL, 2 - FLOOR
  onesided: number;
  realCenter: number;
  blocking2: number;
  tranclucentReversed: number;
  noautoshading: number;
  reserved: number;
  invisible: number;
  unk10: number;
  unk12: number;
  unk13: number;
  unk14: number;
}

export type Sprite = {
  x: number;
  y: number;
  z: number;
  cstat: SpriteStats;
  picnum: number;
  shade: number;
  pal: number;
  clipdist: number;
  blend: number;
  xrepeat: number;
  yrepeat: number;
  xoffset: number;
  yoffset: number;
  sectnum: number;
  statnum: number;
  ang: number;
  owner: number;
  xvel: number;
  yvel: number;
  zvel: number;
  lotag: number;
  hitag: number;
  extra: number;
}

export type Board<W extends Wall = Wall, S extends Sector = Sector, SPR extends Sprite = Sprite> = {
  version: number;
  posx: number;
  posy: number;
  posz: number;
  ang: number;
  cursectnum: number;
  numsectors: number;
  sectors: S[];
  numwalls: number;
  walls: W[];
  numsprites: number;
  sprites: SPR[];
}


export type Header1 = {
  startX: number;
  startY: number;
  startZ: number;
  startAng: number;
  startSec: number;
  parallaxSize: number;
}

