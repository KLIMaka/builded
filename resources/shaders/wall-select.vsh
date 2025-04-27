precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"
#include "wall-inc.vsh"

uniform highp usampler2D walls;
uniform highp usampler2D sectors;
uniform highp usampler2D infos;

// Part: 0 - void, 1 - top, 2 - bottom, 3 - mask
in uvec4 aWallSectorPart_u16;

out vec3 tc;
out vec3 wpos;
flat out pic_t picInfo;

void main() {
  wall_t wall1 = loadWall(walls, aWallSectorPart_u16.x);
  wall_t wall2 = loadWall(walls, wall1.point2);
  sector_t sector = loadSector(sectors, aWallSectorPart_u16.y);
  uint part = aWallSectorPart_u16.z;
  wall_info_t wallInfo = getWallInfo(sectors, walls, infos, part, gl_VertexID, wall1, wall2, sector);

  gl_Position = P * V * vec4(wallInfo.pos.xzy, 1.0);
  wpos = wallInfo.pos.xzy;
  picInfo = wallInfo.picInfo;
  tc = wallInfo.tc;
}

