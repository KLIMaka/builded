precision highp float;

#include "structs.vsh"

uniform Matrices {
  mat4 P;
  mat4 V;
  mat4 IV;
};

uniform highp usampler2D infos;
uniform highp usampler2D walls;
uniform highp usampler2D sectors;

in vec4 aPos12;
in vec4 aPos3Sec;

out vec3 tc;
flat out ivec4 params;
flat out pic_t picInfo;

vec3 getTc(vec2 pos, sector_t sector, vec4 orient, pic_t pic, bool ceiling) {
  vec2 pan = vec2(ceiling ? sector.ceilingFloorPan.xy : sector.ceilingFloorPan.zw) / vec2(255.0);
  uint cstat = ceiling ? sector.ceilingFloorCstat.x : sector.ceilingFloorCstat.y;
  float heinum = angscale(ceiling ? sector.ceilingFloorHeinumZ.x : sector.ceilingFloorHeinumZ.z);
  bool alignToFirstWall = sector_cstat_alignToFirstWall(cstat);
  vec2 angFactor = vec2(1.0, alignToFirstWall ? sqrt(1.0 + heinum * heinum) : 1.0);
  vec2 flip = vec2(sector_cstat_xflip(cstat) ? -1.0 : 1.0, sector_cstat_yflip(cstat) ? -1.0 : 1.0);
  vec2 scale = vec2(sector_cstat_doubleSmooshiness(cstat) ? 8.0 : 16.0) * pic.sizeOff.xy * flip / angFactor;
  vec2 yFlipPos = pos * vec2(1.0, -1.0);
  if (alignToFirstWall) {
    yFlipPos -= orient.xy * vec2(1.0, -1.0);
    float ang = atan(orient.w, orient.z);
    vec4 orig = vec4(sin(ang), cos(ang), -cos(ang), sin(ang));
    yFlipPos = vec2(-dot(yFlipPos, orig.zw), -dot(yFlipPos, orig.xy));
  }
  vec2 inPos = sector_cstat_swapXY(cstat) ? yFlipPos.yx : yFlipPos.xy;
  return vec3(inPos / scale + pan, 1.0);
}

vec2 getPos() {
  if (gl_VertexID == 0) return aPos12.xy;
  else if (gl_VertexID == 1) return aPos12.zw;
  else if (gl_VertexID == 2) return aPos3Sec.xy;
  else if (gl_VertexID == 3) return aPos3Sec.xy;
  else if (gl_VertexID == 4) return aPos12.zw;
  else if (gl_VertexID == 5) return aPos12.xy;
}

void main() {
  sector_t sector = loadSector(sectors, uint(aPos3Sec.z));
  wall_t firstWall = loadWall(walls, sector.wallPtrNum.x);
  wall_t secondWall = loadWall(walls, firstWall.point2);
  vec4 orient = vec4(firstWall.pos, normalize(secondWall.pos - firstWall.pos));
  bool ceiling = gl_VertexID <= 2;
  picInfo = loadPicInfo(infos, ceiling ? sector.ceilingFloorPicnum.x : sector.ceilingFloorPicnum.y);

  vec2 pos = getPos();
  vec2 heinumZ = ceiling ? sector.ceilingFloorHeinumZ.xy : sector.ceilingFloorHeinumZ.zw;
  float z = calcZ(pos, heinumZ, orient);
  tc = getTc(pos, sector, orient, picInfo, ceiling);
  int shade = ceiling ? sector.ceilingFloorShade.x : sector.ceilingFloorShade.y;
  int pal = int(ceiling ? sector.ceilingFloorPal.x : sector.ceilingFloorPal.y);
  bool parallax = sector_cstat_parallaxing(ceiling ? sector.ceilingFloorCstat.x : sector.ceilingFloorCstat.y);
  params = ivec4(shade, pal, int(sector.visibility), 0);
  vec4 finalPos = P * V * vec4(pos.x, z,  pos.y, 1.0);
  gl_Position = parallax ? applyParallax(finalPos) : finalPos;
}