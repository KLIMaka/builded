
#define PI (3.1415926535897932384626433832795)

int ubyte2byte(uint x) { return int(x) <= 0x7f ? int(x) : int(x) - 0xff - 1; }
int ushort2short(uint x) { return int(x) <= 0x7fff ? int(x) : int(x) - 0xffff - 1; }
int uint2int(uint x) { return int(x) <= 0x7fffffff ? int(x) : int(x) - 0xffffffff - 1; }
float nextpow2(float x) { return pow(2.0, ceil(log2(x))); }
float scaleZ(int z) { return float(z) / -16.0; }

//////////////////////////////////////////////////////////////////////////////////

struct pic_t {
  uint picnum;
  vec3 pos;
  vec4 sizeOff;
  uvec4 framesAnimSpeedType;
  float nonpow2Wrap;
  uint parallax;
};

pic_t unpackPic(uint id, uvec4 pdata) {
  float h = float((pdata.x >> 16) & uint(0xffff));
  return pic_t(
    id,
    vec3(pdata.y & uint(0xffff), (pdata.y >> 16) & uint(0xffff), pdata.z & uint(0xff)),
    vec4(pdata.x & uint(0xffff), (pdata.x >> 16) & uint(0xffff), ubyte2byte((pdata.w >> 8) & uint(0xff)), ubyte2byte((pdata.w >> 16) & uint(0xff))),
    uvec4(pdata.w & uint(0x3f), (pdata.w >> 6) & uint(0x3), (pdata.w >> 24) & uint(0xf), (pdata.w >> 28) & uint(0xf)),
    nextpow2(h) / h,
    (pdata.z >> 8) & uint(0xffffff));
}

int animate(int frame, pic_t info) {
  if (info.framesAnimSpeedType.x == uint(0)) return 0;
  int max = int(info.framesAnimSpeedType.x) + 1;
  if (info.framesAnimSpeedType.y == uint(0)) return 0;
  else if (info.framesAnimSpeedType.y == uint(1)) {
    int x = frame % (max * 2 - 2);
    return x >= max ? max * 2 - 2 - x : x;
  } else if (info.framesAnimSpeedType.y == uint(2)) return frame % max;
  else if (info.framesAnimSpeedType.y == uint(3)) return - frame % max;
}

pic_t loadPicInfoImpl(highp usampler2D s, uint picnum) {
  uint lo = picnum & uint(0xff);
  uint hi = (picnum >> 8) & uint(0xff);
  return unpackPic(picnum, texelFetch(s, ivec2(lo, hi), 0));
}

pic_t loadPicInfo(highp usampler2D s, uint picnum, float animOff) {
  pic_t original = loadPicInfoImpl(s, picnum);
  float speed = pow(2.0, float(original.framesAnimSpeedType.z)) * 8.0;
  int frame = int((time + animOff * 123.45) / speed);
  int off = animate(frame, original);
  if (off == 0) return original;
  else return loadPicInfoImpl(s, uint(int(picnum) + off));
}

//////////////////////////////////////////////////////////////////////////////////

uint sector_wallptr(uvec4[3] sec) { return sec[0].x & uint(0xffff); }
uint sector_wallnum(uvec4[3] sec) { return (sec[0].x >> 16) & uint(0xffff); }
int sector_ceilingz(uvec4[3] sec) { return uint2int(sec[0].y); }
int sector_floorz(uvec4[3] sec) { return uint2int(sec[0].z); }
uint sector_ceilingstat(uvec4[3] sec) { return sec[0].w & uint(0xffff); }
uint sector_floorstat(uvec4[3] sec) { return (sec[0].w >> 16) & uint(0xffff); }
uint sector_ceilingpicnum(uvec4[3] sec) { return sec[1].x & uint(0xffff); }
int sector_ceilingheinum(uvec4[3] sec) { return ushort2short((sec[1].x >> 16) & uint(0xffff)); }
int sector_ceilingshade(uvec4[3] sec) { return ubyte2byte(sec[1].y & uint(0xff)); }
uint sector_ceilingpal(uvec4[3] sec) { return (sec[1].y >> 8) & uint(0xff); }
uint sector_ceilingxpanning(uvec4[3] sec) { return (sec[1].y >> 16) & uint(0xff); }
uint sector_ceilingypanning(uvec4[3] sec) { return (sec[1].y >> 24) & uint(0xff); }
uint sector_floorpicnum(uvec4[3] sec) { return sec[1].z & uint(0xffff); }
int sector_floorheinum(uvec4[3] sec) { return ushort2short((sec[1].z >> 16) & uint(0xffff)); }
int sector_floorshade(uvec4[3] sec) { return ubyte2byte(sec[1].w & uint(0xff)); }
uint sector_floorpal(uvec4[3] sec) { return (sec[1].w >> 8) & uint(0xff); }
uint sector_floorxpanning(uvec4[3] sec) { return (sec[1].w >> 16) & uint(0xff); }
uint sector_floorypanning(uvec4[3] sec) { return (sec[1].w >> 24) & uint(0xff); }
uint sector_visibility(uvec4[3] sec) { return sec[2].x & uint(0xff); }

bool sector_cstat_parallaxing(uint cstat) { return (cstat & uint(1)) == uint(1); }
bool sector_cstat_slopped(uint cstat) { return ((cstat >> 1) & uint(1)) == uint(1); }
bool sector_cstat_swapXY(uint cstat) { return ((cstat >> 2) & uint(1)) == uint(1); }
bool sector_cstat_doubleSmooshiness(uint cstat) { return ((cstat >> 3) & uint(1)) == uint(1); }
bool sector_cstat_xflip(uint cstat) { return ((cstat >> 4) & uint(1)) == uint(1); }
bool sector_cstat_yflip(uint cstat) { return ((cstat >> 5) & uint(1)) == uint(1); }
bool sector_cstat_alignToFirstWall(uint cstat) { return ((cstat >> 6) & uint(1)) == uint(1); }
uint sector_cstat_type(uint cstat) { return (cstat >> 7) & uint(0x3); }
bool sector_cstat_tror(uint cstat) { return ((cstat >> 10) & uint(1)) == uint(1); }
bool sector_cstat_floorShade(uint cstat) { return ((cstat >> 15) & uint(1)) == uint(1); }

struct sector_t {
  uvec2 wallPtrNum;
  vec4 ceilingFloorHeinumZ;
  uvec2 ceilingFloorCstat;
  uvec2 ceilingFloorPicnum;
  ivec2 ceilingFloorShade;
  uvec2 ceilingFloorPal;
  uvec4 ceilingFloorPan;
  uint visibility;
};

sector_t unpackSector(uvec4[3] sdata) {
  uvec2 cstats = uvec2(sector_ceilingstat(sdata), sector_floorstat(sdata));
  bool ceilingSlopped = sector_cstat_slopped(cstats.x);
  bool floorSlopped = sector_cstat_slopped(cstats.y);
  float ceilingHeinum = ceilingSlopped ? float(sector_ceilingheinum(sdata)) : 0.0;
  float floorHeinum = floorSlopped ? float(sector_floorheinum(sdata)) : 0.0;
  return sector_t(
    uvec2(sector_wallptr(sdata), sector_wallnum(sdata)),
    vec4(ceilingHeinum, scaleZ(sector_ceilingz(sdata)), floorHeinum, scaleZ(sector_floorz(sdata))),
    cstats,
    uvec2(sector_ceilingpicnum(sdata), sector_floorpicnum(sdata)),
    ivec2(sector_ceilingshade(sdata), sector_floorshade(sdata)),
    uvec2(sector_ceilingpal(sdata), sector_floorpal(sdata)),
    uvec4(sector_ceilingxpanning(sdata), sector_ceilingypanning(sdata), sector_floorxpanning(sdata), sector_floorypanning(sdata)),
    sector_visibility(sdata));
}

sector_t loadSector(highp usampler2D samp, uint s) {
  uint lo = (s << 2) & uint(0xff);
  uint hi = ((s << 2) >> 8) & uint(0xff);
  return unpackSector(uvec4[3](
    texelFetch(samp, ivec2(lo, hi), 0),
    texelFetch(samp, ivec2(lo + uint(1), hi), 0),
    texelFetch(samp, ivec2(lo + uint(2), hi), 0)));
}

//////////////////////////////////////////////////////////////////////////////////

int wall_x(uvec4[2] wall) { return uint2int(wall[0].x); }
int wall_y(uvec4[2] wall) { return uint2int(wall[0].y); }
uint wall_point2(uvec4[2] wall) { return wall[0].z & uint(0xffff); }
uint wall_nextwall(uvec4[2] wall) { return (wall[0].z >> 16) & uint(0xffff); }
uint wall_nextsector(uvec4[2] wall) { return wall[0].w & uint(0xffff); }
uint wall_cstat(uvec4[2] wall) { return (wall[0].w >> 16) & uint(0xffff); }
uint wall_picnum(uvec4[2] wall) { return wall[1].x & uint(0xffff); }
uint wall_overpicnum(uvec4[2] wall) { return (wall[1].x >> 16) & uint(0xffff); }
int wall_shade(uvec4[2] wall) { return ubyte2byte(wall[1].y & uint(0xff)); }
uint wall_pal(uvec4[2] wall) { return (wall[1].y >> 8) & uint(0xff); }
uint wall_xrepeat(uvec4[2] wall) { return (wall[1].y >> 16) & uint(0xff); }
uint wall_yrepeat(uvec4[2] wall) { return (wall[1].y >> 24) & uint(0xff); }
uint wall_xpanning(uvec4[2] wall) { return wall[1].z & uint(0xff); }
uint wall_ypanning(uvec4[2] wall) { return (wall[1].z >> 8) & uint(0xff); }


struct wall_t {
  vec2 pos;
  uint point2;
  uvec2 nextWallSector;
  uint cstat;
  uvec2 picnumOverpicnum;
  int shade;
  uint pal;
  vec4 panRepeat;
};

bool wall_cstat_alignBottom(wall_t wall) { return ((wall.cstat >> 2) & uint(1)) == uint(1); }
bool wall_cstat_swapBottoms(wall_t wall) { return ((wall.cstat >> 1) & uint(1)) == uint(1); }
bool wall_cstat_xflip(wall_t wall) { return ((wall.cstat >> 3) & uint(1)) == uint(1); }
bool wall_cstat_masking(wall_t wall) { return ((wall.cstat >> 4) & uint(1)) == uint(1); }
bool wall_cstat_oneWay(wall_t wall) { return ((wall.cstat >> 5) & uint(1)) == uint(1); }
bool wall_cstat_translucent(wall_t wall) { return ((wall.cstat >> 7) & uint(1)) == uint(1); }
bool wall_cstat_yflip(wall_t wall) { return ((wall.cstat >> 8) & uint(1)) == uint(1); }
bool wall_cstat_translucentReversed(wall_t wall) { return ((wall.cstat >> 9) & uint(1)) == uint(1); }
bool wall_cstat_yaxUpWall(wall_t wall) { return ((wall.cstat >> 10) & uint(1)) == uint(1); }
bool wall_cstat_yaxDownWall(wall_t wall) { return ((wall.cstat >> 11) & uint(1)) == uint(1); }
bool wall_cstat_rotate90(wall_t wall) { return ((wall.cstat >> 12) & uint(1)) == uint(1); }

wall_t unpackWall(uvec4[2] wdata) {
  return wall_t(
    vec2(wall_x(wdata), wall_y(wdata)),
    wall_point2(wdata),
    uvec2(wall_nextwall(wdata), wall_nextsector(wdata)),
    wall_cstat(wdata),
    uvec2(wall_picnum(wdata), wall_overpicnum(wdata)),
    wall_shade(wdata),
    wall_pal(wdata),
    vec4(wall_xpanning(wdata), wall_ypanning(wdata), wall_xrepeat(wdata), wall_yrepeat(wdata)));
}

wall_t loadWall(highp usampler2D s, uint w) {
  uint lo = (w << 1) & uint(0xff);
  uint hi = ((w << 1) >> 8) & uint(0xff);
  return unpackWall(uvec4[2](
    texelFetch(s, ivec2(lo, hi), 0),
    texelFetch(s, ivec2(lo + uint(1), hi), 0)));
}

//////////////////////////////////////////////////////////////////////////////////

int sprite_x(uvec4[2] sdata) { return uint2int(sdata[0].x); }
int sprite_y(uvec4[2] sdata) { return uint2int(sdata[0].y); }
int sprite_z(uvec4[2] sdata) { return uint2int(sdata[0].z); }
uint sprite_cstat(uvec4[2] sdata) { return sdata[0].w & uint(0xffff); }
uint sprite_picnum(uvec4[2] sdata) { return (sdata[0].w >> 16) & uint(0xffff); }
int sprite_shade(uvec4[2] sdata) { return ubyte2byte(sdata[1].x & uint(0xff)); }
uint sprite_pal(uvec4[2] sdata) { return (sdata[1].x >> 8) & uint(0xff); }
uint sprite_clipdist(uvec4[2] sdata) { return (sdata[1].x >> 16) & uint(0xff); }
uint sprite_blend(uvec4[2] sdata) { return (sdata[1].x >> 24) & uint(0xff); }
uint sprite_xrepeat(uvec4[2] sdata) { return sdata[1].y  & uint(0xff); }
uint sprite_yrepeat(uvec4[2] sdata) { return (sdata[1].y >> 8)  & uint(0xff); }
int sprite_xoffset(uvec4[2] sdata) { return ubyte2byte((sdata[1].y >> 16)  & uint(0xff)); }
int sprite_yoffset(uvec4[2] sdata) { return ubyte2byte((sdata[1].y >> 24)  & uint(0xff)); }
uint sprite_sectnum(uvec4[2] sdata) { return sdata[1].z  & uint(0xffff); }
uint sprite_statnum(uvec4[2] sdata) { return (sdata[1].z  >> 16)  & uint(0xffff); }
uint sprite_ang(uvec4[2] sdata) { return sdata[1].w & uint(0xffff); }


struct sprite_t {
  vec3 pos;
  uint cstat;
  uint picnum;
  int shade;
  uint pal;
  uvec2 repeat;
  ivec2 pan;
  uint ang;
  uint sec;
  uint blend;
};

bool sprite_cstat_translucent(sprite_t sprite) { return ((sprite.cstat >> 1) & uint(1)) == uint(1); }
bool sprite_cstat_xflip(sprite_t sprite) { return ((sprite.cstat >> 2) & uint(1)) == uint(1); }
bool sprite_cstat_yflip(sprite_t sprite) { return ((sprite.cstat >> 3) & uint(1)) == uint(1); }
uint sprite_cstat_type(sprite_t sprite) { return (sprite.cstat >> 4) & uint(0x3); }
bool sprite_cstat_onesided(sprite_t sprite) { return ((sprite.cstat >> 6) & uint(1)) == uint(1); }
bool sprite_cstat_realCenter(sprite_t sprite) { return ((sprite.cstat >> 7) & uint(1)) == uint(1); }
bool sprite_cstat_translucentReversed(sprite_t sprite) { return ((sprite.cstat >> 9) & uint(1)) == uint(1); }
bool sprite_cstat_noshade(sprite_t sprite) { return ((sprite.cstat >> 11) & uint(1)) == uint(1); }

sprite_t unpackSprite(uvec4[2] sdata) {
  return sprite_t(
    vec3(sprite_x(sdata), sprite_y(sdata), scaleZ(sprite_z(sdata))),
    sprite_cstat(sdata),
    sprite_picnum(sdata),
    sprite_shade(sdata), 
    sprite_pal(sdata),
    uvec2(sprite_xrepeat(sdata), sprite_yrepeat(sdata)),
    ivec2(sprite_xoffset(sdata), sprite_yoffset(sdata)),
    sprite_ang(sdata),
    sprite_sectnum(sdata),
    sprite_blend(sdata));
}

sprite_t loadSprite(highp usampler2D samp, uint s) {
  uint lo = (s << 1) & uint(0xff);
  uint hi = ((s << 1) >> 8) & uint(0xff);
  return unpackSprite(uvec4[2](
    texelFetch(samp, ivec2(lo, hi), 0),
    texelFetch(samp, ivec2(lo + uint(1), hi), 0)));
}

//////////////////////////////////////////////////////////////////////////////////

vec4 loadOrient(highp usampler2D walls, sector_t sector) {
  wall_t firstWall = loadWall(walls, sector.wallPtrNum.x);
  wall_t secondWall = loadWall(walls, firstWall.point2);
  return vec4(firstWall.pos, normalize(secondWall.pos - firstWall.pos));
}

float angscale(float heinum) { return heinum / 4096.0; }

float calcZ(vec2 pos, vec2 heinumZ, vec4 orient) {
  vec2 d = pos - orient.xy;
  float k = -cross(vec3(orient.zw, 0.0), vec3(d, 0.0)).z;
  return angscale(heinumZ.x) * k + heinumZ.y;
}

vec4 applyParallax(vec4 pos) {
  return vec4(pos.xy, pos.w - 0.1, pos.w);
}

vec2 scaleValue(vec2 value, vec2 repeat) {
  return trunc((value * repeat) / 4.0);
}

//////////////////////////////////////////////////////////////////////////////////

struct voxel_t {
  vec3 off;
  vec3 pos;
  uint quad;
  uint color;
};

voxel_t unpackVoxel(uvec4 off, uint quad,  uvec4 vdata) {
  return voxel_t(
    vec3(uint2int(off.x), uint2int(off.y), uint2int(off.z)) / 256.0,
    vec3(uint2int(vdata.x), uint2int(vdata.y), uint2int(vdata.z)),
    quad,
    vdata.w);
}

uvec4 fetchPixel(highp usampler2D s, uint off) {
  uint lo = off & uint(0x3ff);
  uint hi = off >> 10;
  return texelFetch(s, ivec2(lo, hi), 0);
}

voxel_t loadVoxel(highp usampler2D s, uint v) {
  uint part = v % uint(4);
  uvec4 info = fetchPixel(s, uint(0));
  uvec4 offQuad4 = fetchPixel(s, v / uint(4) + uint(1));
  uint offQuad = part == uint(0) ? offQuad4.x : part == uint(1) ? offQuad4.y : part == uint(2) ? offQuad4.z : offQuad4.w;
  uint quad = offQuad >> 28;
  uint voxelDataOff = info.w + (offQuad & uint(0xfffffff));
  return unpackVoxel(info, quad, fetchPixel(s, voxelDataOff));
}
