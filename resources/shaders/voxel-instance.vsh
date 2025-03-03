precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"

uniform highp usampler2D sprites;
uniform highp usampler2D sectors;
uniform highp usampler2D voxel;
uniform highp usampler2D infos;

in uint aSpriteId_u16;

flat out ivec4 params;
flat out uint color;

const uint vertexCountPerVoxel = uint(6);

const vec3[8] cubeVertices = vec3[](
  vec3(-1.0, -1.0, +1.0),
  vec3(+1.0, -1.0, +1.0),
  vec3(+1.0, +1.0, +1.0),
  vec3(-1.0, +1.0, +1.0),
  vec3(-1.0, -1.0, -1.0),
  vec3(+1.0, -1.0, -1.0),
  vec3(+1.0, +1.0, -1.0),
  vec3(-1.0, +1.0, -1.0));

const uint[6] quadOff = uint[](uint(0), uint(1), uint(2), uint(0), uint(2), uint(3));

const uint[24] cubeIndices = uint[](
  uint(3), uint(2), uint(1), uint(0), 
  uint(4), uint(5), uint(6), uint(7),
  uint(4), uint(7), uint(3), uint(0), 
  uint(2), uint(6), uint(5), uint(1),
  uint(0), uint(1), uint(5), uint(4), 
  uint(3), uint(7), uint(6), uint(2));

void main() {
  sprite_t sprite = loadSprite(sprites, aSpriteId_u16);
  sector_t sector = loadSector(sectors, sprite.sec);
  pic_t picInfo = loadPicInfo(infos, sprite.picnum, 0.0);
  bool realCenter = sprite_cstat_realCenter(sprite);
  vec2 picOff = scaleValue(picInfo.sizeOff.zw, vec2(sprite.repeat)) * vec2(0.0, 1.0);
  uint voxelId = uint(gl_VertexID) / vertexCountPerVoxel;
  voxel_t voxel = loadVoxel(voxel, voxelId);
  
  float rotation = time * (picInfo.framesAnimSpeedType.w == uint(7) ? 1.0 : 0.0);
  float radAng = PI - (float(sprite.ang) + rotation) * PI / 1024.0;
  vec4 vec = vec4(sin(radAng), cos(radAng), -cos(radAng), sin(radAng));
  vec2 scale2d = scaleValue(vec2(1.0), vec2(sprite.repeat));
  vec3 scale3d = vec3(scale2d.xx, scale2d.y);
  vec3 hscale3d = scale3d / 2.0;
  uint vertexInQuad = uint(gl_VertexID) % vertexCountPerVoxel;
  vec3 posOff = cubeVertices[cubeIndices[voxel.quad * uint(4) + quadOff[vertexInQuad]]];
  vec3 pos = posOff * hscale3d + vec3(voxel.pos) * scale3d - (realCenter ? voxel.off : vec3(voxel.off.xy, 0.0)) * scale3d - hscale3d;
  vec3 rotated = vec3(vec.xy * pos.x + vec.zw * pos.y, pos.z) + sprite.pos + picOff.xxy;
  gl_Position = P * V * vec4(rotated.xzy, 1.0);

#ifdef SPRITE_SHADOW_OFF
  int shade = sprite.shade + (sector_cstat_floorShade(sector.ceilingFloorCstat.y) 
    ? sector.ceilingFloorShade.y 
    : sector_cstat_parallaxing(sector.ceilingFloorCstat.x) 
      ? sector.ceilingFloorShade.x 
      : sector.ceilingFloorShade.y);
#else
  int shade = sprite_cstat_type(sprite) == uint(1)
    ? sprite.shade
    : sector_cstat_parallaxing(sector.ceilingFloorCstat.x) 
      ? sector.ceilingFloorShade.x 
      : sector.ceilingFloorShade.y;
#endif
  color = voxel.color;
  params = ivec4(shade, int(sprite.pal), int(sector.visibility), 0);
}