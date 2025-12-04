
// vtxId mapping
// 1----0 
// |\   |
// | \  |
// |  \ |
// |   \|
// 3----2

#define IS_START(v) ((v & 1) == 0)

vec3 getWall3dPos(int vtxId, wall_t wall1, wall_t wall2, vec4 corient, vec4 forient, vec2 ceiling, vec2 floor) {
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

  if (IS_START(vtxId)) {
    if (zsf > zsc) return mix(a, b, ds.x);
    return vec3(start, vtxId == 0 ? zsc : zsf);
  } else {
    if (zef > zec) return mix(a, b, ds.y);
    return vec3(end, vtxId == 1 ? zec : zef);
  }
}

vec3 getWall3dPosMasked(int vtxId, wall_t wall1, wall_t wall2, vec4 orient, vec4 norient, sector_t sector, sector_t nSector) {
  vec2 ceiling = sector.ceilingFloorHeinumZ.xy; 
  vec2 floor = sector.ceilingFloorHeinumZ.zw; 
  vec2 nceiling = nSector.ceilingFloorHeinumZ.xy;
  vec2 nfloor = nSector.ceilingFloorHeinumZ.zw;
  vec2 start = wall2.pos;
  vec2 end = wall1.pos;
  float nzsc = calcZ(start, nceiling, norient);
  float nzec = calcZ(end, nceiling, norient);
  float nzsf = calcZ(start, nfloor, norient);
  float nzef = calcZ(end, nfloor, norient);
  float czsc = calcZ(start, ceiling, orient);
  float czec = calcZ(end, ceiling, orient);
  float czsf = calcZ(start, floor, orient);
  float czef = calcZ(end, floor, orient);
  vec2 zc = nzsc > czsc && nzec > czec ? vec2(czsc, czec) : vec2(nzsc, nzec);
  vec2 zf = nzsf < czsf && nzef < czef ? vec2(czsf, czef) : vec2(nzsf, nzef);
  if (IS_START(vtxId)) return vec3(start, vtxId == 0 ? zc.x : zf.x);
  else return vec3(end, vtxId == 1 ? zc.y : zf.y);
}

vec3 getTc(vec3 pos, wall_t orig, wall_t ref, pic_t picInfo, vec2 p1, vec2 p2, float basez) {
  float yf = wall_cstat_yflip(ref) ? -1.0 : 1.0;
  vec3 base = wall_cstat_xflip(orig) ? vec3(p2, basez) : vec3(p1, basez);
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

struct wall_info_t {
  vec3 pos;
  bool parallax;
  pic_t picInfo;
  int shade;
  int pal;
  vec3 tc;
};

wall_info_t getWallInfo(highp usampler2D sectors, highp usampler2D walls, highp usampler2D infos, uint part,  int vtxId, wall_t wall1, wall_t wall2, sector_t sector) {
  vec4 orient = loadOrient(walls, sector);
  if (part > uint(0)) {
    sector_t nextSector = loadSector(sectors, wall1.nextWallSector.y);
    vec4 nextOrient = loadOrient(walls, nextSector);
    vec4 corient = orient;
    vec4 forient = nextOrient;
    vec2 ceiling = sector.ceilingFloorHeinumZ.xy;
    vec2 floor = nextSector.ceilingFloorHeinumZ.xy;
    wall_t ref = wall1;
    uint cstat = sector.ceilingFloorCstat.x;
    uint ncstat = nextSector.ceilingFloorCstat.x;
    if (part == uint(2)) {
      if (wall_cstat_swapBottoms(wall1)) 
        ref = loadWall(walls, wall1.nextWallSector.x);
      corient = nextOrient;
      forient = orient;
      ceiling = nextSector.ceilingFloorHeinumZ.zw;
      floor = sector.ceilingFloorHeinumZ.zw;
      cstat = sector.ceilingFloorCstat.y;
      ncstat = nextSector.ceilingFloorCstat.y;
    }
    bool masked = part == uint(3);
    bool isParallax = sector_cstat_parallaxing(cstat) && sector_cstat_parallaxing(ncstat) && !masked;
    bool ceilingWall = part == uint(1);
    uint parallaxPal = ceilingWall ? sector.ceilingFloorPal.x : sector.ceilingFloorPal.y;
    int parallaxShade = ceilingWall ? sector.ceilingFloorShade.x : sector.ceilingFloorShade.y;
    int shade = isParallax ? parallaxShade : ref.shade;
    int pal = isParallax ? int(parallaxPal) : int(ref.pal);
    uint parallaxPic = ceilingWall ? sector.ceilingFloorPicnum.x : sector.ceilingFloorPicnum.y;
    uint picnum = isParallax ? parallaxPic : (masked ? ref.picnumOverpicnum.y : ref.picnumOverpicnum.x);
    vec3 pos = masked
      ? getWall3dPosMasked(vtxId, wall1, wall2, orient, nextOrient, sector, nextSector)
      : getWall3dPos(vtxId, wall1, wall2, corient, forient, ceiling, floor);
    float basez = masked
      ? wall_cstat_alignBottom(ref) 
        ? (wall_cstat_oneWay(wall1) ? sector.ceilingFloorHeinumZ.y : nextSector.ceilingFloorHeinumZ.w) 
        : min(sector.ceilingFloorHeinumZ.y, nextSector.ceilingFloorHeinumZ.y)
      : wall_cstat_alignBottom(ref) 
        ? sector.ceilingFloorHeinumZ.y 
        : part == uint(1)
          ? nextSector.ceilingFloorHeinumZ.y
          : nextSector.ceilingFloorHeinumZ.w;
    pic_t picInfo = loadPicInfo(infos, picnum, 0.0);
    vec3 tc = getTc(pos, wall1, ref, picInfo, wall1.pos, wall2.pos, basez);
    return wall_info_t(pos, isParallax, picInfo, shade, pal, tc);
  } else {
    vec2 ceiling = sector.ceilingFloorHeinumZ.xy;
    vec2 floor = sector.ceilingFloorHeinumZ.zw;
    vec3 pos = getWall3dPos(vtxId, wall1, wall2, orient, orient, ceiling, floor);
    pic_t picInfo = loadPicInfo(infos, wall1.picnumOverpicnum.x, 0.0);
    float basez = wall_cstat_alignBottom(wall1) 
      ? sector.ceilingFloorHeinumZ.w 
      : sector.ceilingFloorHeinumZ.y;
    vec3 tc = getTc(pos, wall1, wall1, picInfo, wall1.pos, wall2.pos, basez);
    return wall_info_t(pos, false, picInfo, wall1.shade, int(wall1.pal), tc);
  }
}
