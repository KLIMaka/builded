precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"
#include "sector-inc.vsh"

uniform highp usampler2D infos;
uniform highp usampler2D walls;
uniform highp usampler2D sectors;

in vec4 aPos12;
in vec4 aPos3SecPart;

out vec3 tc;
out vec4 parallax;
flat out ivec4 params;
flat out pic_t picInfo;
flat out float trans;

void main() {
  sector_t sector = loadSector(sectors, uint(aPos3SecPart.z));
  bool ceiling = aPos3SecPart.w == 0.0;
  vec2 pos = getPos(sector, ceiling, gl_VertexID, aPos12, aPos3SecPart.xy);
  sector_info_t sectorInfo = getSectorInfo(walls, infos, sector, ceiling, pos);

  uint type = sector_cstat_type(ceiling ? sector.ceilingFloorCstat.x : sector.ceilingFloorCstat.y);
  vec3 wpos = sectorInfo.pos;
  vec4 finalPos = P * V * vec4(wpos, 1.0);
  vec3 eyepos = (IV * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  
  gl_Position = sectorInfo.parallax ? applyParallax(finalPos) : finalPos;
  parallax = vec4(wpos - eyepos,  sectorInfo.parallax ? 1.0 : 0.0);
  picInfo = sectorInfo.picInfo;
  tc = sectorInfo.tc;
  trans = type == uint(0) ? 1.0 : type == uint(1) ? 0.0 : type == uint(2) ? TRANS2 : TRANS1;
  params = ivec4(sectorInfo.shade, sectorInfo.pal, int(sector.visibility), 0);
}