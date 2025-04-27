precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"

uniform highp usampler2D infos;
uniform highp usampler2D walls;
uniform highp usampler2D sectors;

in uvec4 aWallSectorPrev_u16;

out vec3 tc;
out vec4 parallax;
flat out ivec4 params;
flat out pic_t picInfo;
flat out float trans;

#define IS_START ((gl_VertexID & 1) == 0)

vec3 getTc(vec3 pos, wall_t orig, wall_t ref, pic_t picInfo, vec2 p1, vec2 p2, float basez) {
  float yf = wall_cstat_yflip(ref) ? -1.0 : 1.0;
  bool nonSwapped = ref.pos == p1;
  vec3 base = nonSwapped && wall_cstat_xflip(orig) ? vec3(p2, basez) : vec3(p1, basez);
  bool rotate90 = wall_cstat_rotate90(ref);
  float yfr = rotate90 ? -1.0 : 1.0;
  vec2 size = rotate90 ? picInfo.sizeOff.yx : picInfo.sizeOff.xy;
  vec3 delta = base - pos;
  float p = length(delta.xy) / length(p1 - p2);
  float uoff = ref.panRepeat.x / size.x;
  float voff = (ref.panRepeat.y * picInfo.nonpow2Wrap) / 256.0;
  float u = (orig.panRepeat.z * 8.0 * p) / size.x + uoff;
  float v = (orig.panRepeat.w * delta.z) / (size.y * 128.0) + voff;
  vec2 tc = vec2(u, v * yf * yfr);
 return vec3(rotate90 ? tc.yx : tc, 1.0); 
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
    bool isParallax = sector_cstat_parallaxing(cstat) && sector_cstat_parallaxing(ncstat) && !masked;
    bool ceilingWall = aWallSectorPart_u16.z == uint(1);
    uint parallaxPic = ceilingWall ? sector.ceilingFloorPicnum.x : sector.ceilingFloorPicnum.y;
    uint parallaxPal = ceilingWall ? sector.ceilingFloorPal.x : sector.ceilingFloorPal.y;
    int parallaxShade = ceilingWall ? sector.ceilingFloorShade.x : sector.ceilingFloorShade.y;

    picInfo = loadPicInfo(infos, isParallax ? parallaxPic : (masked ? ref.picnumOverpicnum.y : ref.picnumOverpicnum.x), 0.0);
    tc = getTc(pos, wall1, ref, picInfo, wall1.pos, wall2.pos, basez);
    trans = masked ? (wall_cstat_translucent(wall1) ? (wall_cstat_translucentReversed(wall1) ? TRANS1 : TRANS2) : 1.0) : 1.0;
    params = ivec4(isParallax ? parallaxShade : ref.shade, isParallax ? int(parallaxPal) : int(ref.pal), int(sector.visibility), 255);
    vec3 wpos = pos.xzy;
    vec4 finalPos = P * V * vec4(wpos, 1.0);
    gl_Position = isParallax ? applyParallax(finalPos) : finalPos;
    vec3 eyepos = (IV * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    parallax = vec4(wpos - eyepos,  isParallax ? 1.0 : 0.0);
  } else {
    vec2 ceiling = sector.ceilingFloorHeinumZ.xy;
    vec2 floor = sector.ceilingFloorHeinumZ.zw;
    vec3 pos = getWall3dPos(wall1, wall2, orient, orient, ceiling, floor);
    picInfo = loadPicInfo(infos, wall1.picnumOverpicnum.x, 0.0);
    float basez = wall_cstat_alignBottom(wall1) ? sector.ceilingFloorHeinumZ.w : sector.ceilingFloorHeinumZ.y;
    tc = getTc(pos, wall1, wall1, picInfo, wall1.pos, wall2.pos, basez);
    trans = 1.0;
    params = ivec4(wall1.shade, int(wall1.pal), int(sector.visibility), 255);
    gl_Position = P * V * vec4(pos.xzy, 1.0);
  }
}

