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
out vec3 wpos;
out vec2 gridPos;

void main() {
  sector_t sector = loadSector(sectors, uint(aPos3SecPart.z));
  bool ceiling = aPos3SecPart.w == 0.0;
  vec2 pos = getPos(sector, ceiling, gl_VertexID, aPos12, aPos3SecPart.xy);
  sector_info_t sectorInfo = getSectorInfo(walls, infos, sector, ceiling, pos);
  
  gl_Position =  P * V * vec4(sectorInfo.pos, 1.0);;
  wpos = sectorInfo.pos;
  gridPos = sectorInfo.pos.xz;
  tc = sectorInfo.tc;
}