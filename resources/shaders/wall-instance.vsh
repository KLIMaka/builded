precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"
#include "wall-inc.vsh"

uniform highp usampler2D infos;
uniform highp usampler2D walls;
uniform highp usampler2D sectors;

// Part: 0 - void, 1 - top, 2 - bottom, 3 - mask
in uvec4 aWallSectorPart_u16;

out vec3 tc;
out vec4 parallax;
flat out ivec4 params;
flat out pic_t picInfo;
flat out float trans;

vec4 calcParallax(vec3 wpos, bool isParallax) {
    vec3 eyepos = (IV * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    return vec4(wpos - eyepos,  isParallax ? 1.0 : 0.0);
}

void main() {
  wall_t wall1 = loadWall(walls, aWallSectorPart_u16.x);
  wall_t wall2 = loadWall(walls, wall1.point2);
  sector_t sector = loadSector(sectors, aWallSectorPart_u16.y);
  uint part = aWallSectorPart_u16.z;
  wall_info_t wallInfo = getWallInfo(sectors, walls, infos, part, gl_VertexID, wall1, wall2, sector);


  if (part > uint(0)) {
    bool masked = part == uint(3);
    bool isParallax = wallInfo.parallax;
    vec3 wpos = wallInfo.pos.xzy;
    vec4 finalPos = P * V * vec4(wpos, 1.0);

    trans = masked ? (wall_cstat_translucent(wall1) ? (wall_cstat_translucentReversed(wall1) ? TRANS1 : TRANS2) : 1.0) : 1.0;
    gl_Position = isParallax ? applyParallax(finalPos) : finalPos;
    parallax = calcParallax(wpos, isParallax);
  } else {
    trans = 1.0;
    gl_Position = P * V * vec4(wallInfo.pos.xzy, 1.0);
  }

  picInfo = wallInfo.picInfo;
  tc = wallInfo.tc;
  params = ivec4(wallInfo.shade, wallInfo.pal, int(sector.visibility), 255);
}

