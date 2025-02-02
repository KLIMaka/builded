precision highp float;

#include "structs.vsh"

uniform Matrices {
  mat4 P;
  mat4 V;
  mat4 IV;
};

// gl_VertexID mapping
// 1----0 
// |\   |
// | \  |
// |  \ |
// |   \|
// 3----2 

uniform highp usampler2D infos;
uniform highp usampler2D walls;
uniform highp usampler2D sectors;

// Part: 0 - void, 1 - top, 2 - bottom, 3 - mask
in uvec4 aWallSectorPart_u16;

out vec3 tc;
flat out ivec4 params;
flat out pic_t picInfo;

#define IS_START ((gl_VertexID & 1) == 0)

vec3 getTc(vec3 pos, wall_t orig, wall_t ref, pic_t picInfo, vec2 p1, vec2 p2, float basez) {
  float yf = wall_cstat_yflip(ref) ? -1.0 : 1.0;
  bool nonSwapped = ref.pos == p1;
  vec3 base = nonSwapped && wall_cstat_xflip(orig) ? vec3(p2, scaleZ(basez)) : vec3(p1, scaleZ(basez));
  vec3 delta = base - pos;
  float p = length(delta.xy) / length(p1 - p2);
  float uoff = ref.panRepeat.x / picInfo.sizeOff.x;
  float voff = (ref.panRepeat.y * picInfo.nonpow2Wrap) / 255.0;
  float u = (orig.panRepeat.z * 8.0 * p) / picInfo.sizeOff.x + uoff;
  float v = (orig.panRepeat.w * delta.z) / (picInfo.sizeOff.y * 128.0) + voff;
 return vec3(u, yf * v, 1.0); 
}

vec3 getWall3dPosMasked(wall_t wall1, wall_t wall2, vec4 orient, vec4 norient, sector_t sector, sector_t nextSector) {
  vec2 ceiling = sector.ceilingFloorHeinumZ.xy; 
  vec2 floor = sector.ceilingFloorHeinumZ.zw; 
  vec2 nceiling = nextSector.ceilingFloorHeinumZ.xy;
  vec2 nfloor = nextSector.ceilingFloorHeinumZ.zw;
  vec2 start = wall2.pos;
  vec2 end = wall1.pos;
  float zsc = calcZ(start, nceiling, norient);
  float zec = min(calcZ(end, ceiling, orient), calcZ(end, nceiling, norient));
  float zsf = calcZ(start, nfloor, norient);
  float zef = max(calcZ(end, floor, orient), calcZ(end, nfloor, norient));
  if (IS_START) return vec3(start, gl_VertexID == 0 ? zsc : zsf);
  else return vec3(end, gl_VertexID == 1 ? zec : zef);
}

vec3 getWall3dPos(wall_t wall1, wall_t wall2, vec4 corient, vec4 forient, vec2 ceiling, vec2 floor) {
  vec2 start = wall2.pos;
  vec2 end = wall1.pos;
  float zsc = calcZ(start, ceiling, corient);
  float zec = calcZ(end, ceiling, corient);
  float zsf = calcZ(start, floor, forient);
  float zef = calcZ(end, floor, forient);
  if (zef >= zec && zsf >= zsc) return vec3(0.0);
  vec2 dz = vec2((zsf - zsc) / (zec - zef), (zsc - zsf) / (zef - zec));
  vec2 ds = vec2(1.0) - vec2(1.0) / (dz + vec2(1.0));
  vec3 a = vec3(start, zsc);
  vec3 b = vec3(end, zec);

  if (IS_START) {
    if (zsf > zsc) return mix(a, b, ds.x);
    return vec3(start, gl_VertexID == 0 ? zsc : zsf);
  } else {
    if (zef > zec) return mix(a, b, ds.y);
    return vec3(end, gl_VertexID == 1 ? zec : zef);
  }
}

void main() {
  wall_t wall1 = loadWall(walls, aWallSectorPart_u16.x);
  wall_t wall2 = loadWall(walls, wall1.point2);
  sector_t sector = loadSector(sectors, aWallSectorPart_u16.y);
  wall_t firstWall = loadWall(walls, sector.wallPtrNum.x);
  wall_t secondWall = loadWall(walls, firstWall.point2);
  vec4 orient = vec4(firstWall.pos, normalize(secondWall.pos - firstWall.pos));

  if (aWallSectorPart_u16.z > uint(0)) {
    sector_t nextSector = loadSector(sectors, wall1.nextWallSector.y);
    wall_t nextFirstWall = loadWall(walls, nextSector.wallPtrNum.x);
    wall_t nextSecondWall = loadWall(walls, nextFirstWall.point2);
    vec4 nextOrient = vec4(nextFirstWall.pos, normalize(nextSecondWall.pos - nextFirstWall.pos));
    vec4 corient = orient;
    vec4 eorient = nextOrient;
    vec2 ceiling = sector.ceilingFloorHeinumZ.xy;
    vec2 floor = nextSector.ceilingFloorHeinumZ.xy;
    float basez = wall_cstat_alignBottom(wall1) 
      ? sector.ceilingFloorHeinumZ.y 
      : nextSector.ceilingFloorHeinumZ.y;
    wall_t ref = wall1;
    uint cstat = sector.ceilingFloorCstat.x;
    uint ncstat = nextSector.ceilingFloorCstat.x;
    if (aWallSectorPart_u16.z == uint(2)) {
      if (wall_cstat_swapBottoms(wall1)) 
        ref = loadWall(walls, wall1.nextWallSector.x);
      corient = nextOrient;
      eorient = orient;
      ceiling = nextSector.ceilingFloorHeinumZ.zw;
      floor = sector.ceilingFloorHeinumZ.zw;
      cstat = sector.ceilingFloorCstat.y;
      ncstat = nextSector.ceilingFloorCstat.y;
      basez = wall_cstat_alignBottom(ref) 
        ? sector.ceilingFloorHeinumZ.y 
        : nextSector.ceilingFloorHeinumZ.w;
    }
    bool masked = aWallSectorPart_u16.z == uint(3);
    vec3 pos = masked
      ? getWall3dPosMasked(wall1, wall2, orient, nextOrient, sector, nextSector)
      : getWall3dPos(wall1, wall2, corient, eorient, ceiling, floor);
    picInfo = loadPicInfo(infos, masked ? ref.picnumOverpicnum.y : ref.picnumOverpicnum.x);
    tc = getTc(pos, wall1, ref, picInfo, wall1.pos, wall2.pos, basez);
    params = ivec4(ref.shade, int(ref.pal), int(sector.visibility), 255);
    bool parallax = sector_cstat_parallaxing(cstat) && sector_cstat_parallaxing(ncstat) && !masked;
    vec4 finalPos = P * V * vec4(pos.xzy, 1.0);
    gl_Position = parallax ? applyParallax(finalPos) : finalPos;
  } else {
    vec2 ceiling = sector.ceilingFloorHeinumZ.xy;
    vec2 floor = sector.ceilingFloorHeinumZ.zw;
    vec3 pos = getWall3dPos(wall1, wall2, orient, orient, ceiling, floor);
    picInfo = loadPicInfo(infos, wall1.picnumOverpicnum.x);
    float basez = wall_cstat_alignBottom(wall1) ? sector.ceilingFloorHeinumZ.w : sector.ceilingFloorHeinumZ.y;
    tc = getTc(pos, wall1, wall1, picInfo, wall1.pos, wall2.pos, basez);
    params = ivec4(wall1.shade, int(wall1.pal), int(sector.visibility), 255);
    gl_Position = P * V * vec4(pos.xzy, 1.0);
  }
}

