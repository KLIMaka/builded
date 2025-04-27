
struct sector_info_t {
  vec3 pos;
  pic_t picInfo;
  vec3 tc;
  bool parallax;
  int shade;
  int pal;
};

vec2 getPos(sector_t sector, bool ceiling, int vtxId, vec4 pos12, vec2 pos3) {
  uint cstat = ceiling ? sector.ceilingFloorCstat.x : sector.ceilingFloorCstat.y;
  bool render = !sector_cstat_tror(cstat) || sector_cstat_type(cstat) != uint(0);
  if (vtxId == 0) return render ? (ceiling ? pos12.xy : pos3) : vec2(0.0);
  else if (vtxId == 1) return render ? pos12.zw : vec2(0.0);
  else if (vtxId == 2) return render ? (ceiling ? pos3 : pos12.xy) : vec2(0.0);
}

vec3 getTc(vec2 pos, sector_t sector, vec4 orient, pic_t pic, bool ceiling) {
  vec2 pan = vec2(ceiling ? sector.ceilingFloorPan.xy : sector.ceilingFloorPan.zw) / vec2(256.0);
  uint cstat = ceiling ? sector.ceilingFloorCstat.x : sector.ceilingFloorCstat.y;
  float heinum = angscale(ceiling ? sector.ceilingFloorHeinumZ.x : sector.ceilingFloorHeinumZ.z);
  bool alignToFirstWall = sector_cstat_alignToFirstWall(cstat);
  bool swapXY = sector_cstat_swapXY(cstat);
  vec2 angFactor = vec2(1.0, alignToFirstWall ? sqrt(1.0 + heinum * heinum) : 1.0);
  vec2 flip = vec2(sector_cstat_xflip(cstat) ? -1.0 : 1.0, sector_cstat_yflip(cstat) ? -1.0 : 1.0);
  vec2 scale = vec2(sector_cstat_doubleSmooshiness(cstat) ? 8.0 : 16.0) * pic.sizeOff.xy * flip / (swapXY ? angFactor.yx : angFactor);
  vec2 yFlipPos = pos * vec2(1.0, -1.0);
  if (alignToFirstWall) {
    yFlipPos -= orient.xy * vec2(1.0, -1.0);
    float ang = atan(orient.w, orient.z);
    vec4 orig = vec4(sin(ang), cos(ang), -cos(ang), sin(ang));
    yFlipPos = vec2(-dot(yFlipPos, orig.zw), -dot(yFlipPos, orig.xy));
  }
  vec2 inPos = swapXY ? yFlipPos.yx : yFlipPos.xy;
  return vec3(inPos / scale + pan, 1.0);
}


sector_info_t getSectorInfo(highp usampler2D walls, highp usampler2D infos, sector_t sector, bool ceiling, vec2 pos) {
  vec4 orient = loadOrient(walls, sector);
  pic_t picInfo = loadPicInfo(infos, ceiling ? sector.ceilingFloorPicnum.x : sector.ceilingFloorPicnum.y, 0.0);
  vec2 heinumZ = ceiling ? sector.ceilingFloorHeinumZ.xy : sector.ceilingFloorHeinumZ.zw;
  float z = calcZ(pos, heinumZ, orient);
  vec3 tc = getTc(pos, sector, orient, picInfo, ceiling);

  int shade = ceiling ? sector.ceilingFloorShade.x : sector.ceilingFloorShade.y;
  int pal = int(ceiling ? sector.ceilingFloorPal.x : sector.ceilingFloorPal.y);
  bool isParallax = sector_cstat_parallaxing(ceiling ? sector.ceilingFloorCstat.x : sector.ceilingFloorCstat.y);
  vec3 wpos = vec3(pos.x, z,  pos.y);
  return sector_info_t(wpos, picInfo, tc, isParallax, shade, pal);
}