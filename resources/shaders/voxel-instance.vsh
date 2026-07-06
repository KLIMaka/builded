precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"
#include "voxel-inc.vsh"

uniform highp usampler2D sprites;
uniform highp usampler2D sectors;
uniform highp usampler2D voxel;
uniform highp usampler2D infos;

in uint aSpriteId_u16;

flat out ivec4 params;
flat out uint color;

vec3 scaleValue3d(vec3 value, vec2 repeat) {
  return (value * repeat.xxy) / 4.0;
}

void main() {
  sprite_t sprite = loadSprite(sprites, aSpriteId_u16);
  sector_t sector = loadSector(sectors, sprite.sec);
  pic_t picInfo = loadPicInfo(infos, sprite.picnum, 0.0);
  bool realCenter = sprite_cstat_realCenter(sprite);
  vec2 repeat = vec2(sprite.repeat);
  vec2 picOff = scaleValue(picInfo.sizeOff.zw, repeat) * vec2(0.0, 1.0);
  
  float rotation = time * (picInfo.framesAnimSpeedType.w == uint(7) ? 1.0 : 0.0);
  float radAng = PI - (float(sprite.ang) + rotation) * PI / 1024.0;
  vec4 vec = vec4(sin(radAng), cos(radAng), -cos(radAng), sin(radAng));

  voxel_info_t voxelInfo = getVoxelInfo(voxel, uint(gl_VertexID));

  vec3 off = (realCenter ? voxelInfo.off : vec3(voxelInfo.off.xy, 0.0));
  vec3 correctOff = vec3(1.0 / 2.0) * vec3(1.0, 1.0, -1.0);
  vec3 spriteOff = vec3(-sprite.pan.x, 0.0, sprite.pan.y);

  vec3 pos = scaleValue3d(voxelInfo.pos - off + correctOff + spriteOff, repeat);
  vec3 rotated = vec3(vec.xy * pos.x + vec.zw * pos.y, pos.z) + sprite.pos + picOff.xxy;
  gl_Position = P * V * vec4(rotated.xzy, 1.0);

#ifdef SPRITE_SHADOW_OFF
  int shade = sprite.shade + (sector_cstat_floorShade(sector.ceilingFloorCstat.y) 
    ? sector.ceilingFloorShade.y 
    : sector_cstat_parallaxing(sector.ceilingFloorCstat.x) 
      ? sector.ceilingFloorShade.x 
      : sector.ceilingFloorShade.y);
  int pal = int(sprite.pal);
#else
  int shade = sprite_cstat_type(sprite) == uint(1)
    ? sprite.shade
    : sector_cstat_parallaxing(sector.ceilingFloorCstat.x) 
      ? sector.ceilingFloorShade.x 
      : sector.ceilingFloorShade.y;
  int pal = sector.ceilingFloorPal.y != uint(0) ? int(sector.ceilingFloorPal.y) : int(sprite.pal);
#endif
  color = voxelInfo.color;
  params = ivec4(shade, pal, int(sector.visibility), 0);
}