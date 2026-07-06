precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"

// gl_VertexID mapping
// 1----0 
// |\   |
// | \  |
// |  \ |
// |   \|
// 3----2 

uniform highp usampler2D infos;
uniform highp usampler2D sprites;
uniform highp usampler2D sectors;

in uint aSpriteId_u16;

out vec3 tc;
flat out ivec4 params;
flat out pic_t picInfo;
flat out float trans;

#define IS_RIGHT ((gl_VertexID & 0x1) == 0)
#define IS_TOP (gl_VertexID < 2 || gl_VertexID > 3)

struct sprite_data_t {
  vec2 size;
  vec2 off;
};

sprite_data_t loadData(pic_t picInfo, sprite_t sprite, bool wallSprite) {
  float xf = sprite_cstat_xflip(sprite) ? -1.0 : 1.0;
  float yf = wallSprite ? sprite_cstat_yflip(sprite) ? -1.0 : 1.0 : 1.0;
  return sprite_data_t(
    picInfo.sizeOff.xy,
    (picInfo.sizeOff.zw + vec2(sprite.pan)) * vec2(xf, yf));
}

const vec2 tcs[6] = vec2[](
  vec2(1.0, 0.0), 
  vec2(0.0, 0.0), 
  vec2(1.0, 1.0), 
  vec2(0.0, 1.0),
  vec2(1.0, 0.0),
  vec2(0.0, 0.0));

float invert(float x, bool i) {
  return i ? (x == 0.0 ? 1.0 : 0.0) : x;
}

vec3 getTc(sprite_t sprite) {
  bool xf = sprite_cstat_xflip(sprite);
  bool yf = sprite_cstat_yflip(sprite);
  vec2 tc = tcs[gl_VertexID];
  return vec3(invert(tc.x, xf), invert(tc.y, yf), 1.0);
}

vec4 getWallPos(pic_t picInfo, sprite_t sprite) {
  float radAng = -float(sprite.ang) * PI / 1024.0;
  vec2 angVec = vec2(sin(radAng), cos(radAng));

  sprite_data_t data = loadData(picInfo, sprite, true);

  float l = trunc(data.size.x / 2.0);
  float r = data.size.x - l;
  float x = (IS_RIGHT ? -r : l) + data.off.x;

  float u = sprite_cstat_realCenter(sprite) ? trunc(data.size.y / 2.0) : data.size.y;
  float d = data.size.y - u;
  float y = (IS_TOP ? u : -d) + data.off.y;

  vec2 scaled = scaleValue(vec2(x, y), vec2(sprite.repeat));

  vec3 pos = vec3(angVec * scaled.x, scaled.y) + sprite.pos;
  return  P * V * vec4(pos.xzy, 1.0);
}

vec4 getFloorPos(pic_t picInfo, sprite_t sprite) {
  float radAng = float(sprite.ang) * PI / 1024.0;
  vec4 vec = vec4(cos(radAng), sin(radAng), -sin(radAng), cos(radAng));
  
  bool onesideFlipped = sprite_cstat_onesided(sprite) && sprite_cstat_yflip(sprite);
  sprite_data_t data = loadData(picInfo, sprite, false);

  float l = trunc(data.size.x / 2.0);
  float r = data.size.x - l;
  float x = (IS_RIGHT ? r : -l) - data.off.x;

  float u = trunc(data.size.y / 2.0);
  float d = data.size.y - u;
  float y = (onesideFlipped ? (IS_TOP ? -d : u) : (IS_TOP ? u : -d)) + data.off.y;

  vec2 scaled = scaleValue(vec2(x, y), vec2(sprite.repeat));

  vec3 pos = vec3(vec.xy * scaled.y + vec.zw * scaled.x, 0.0) + sprite.pos;
  return P * V * vec4(pos.xzy, 1.0);
}

vec4 getFacePos(pic_t picInfo, sprite_t sprite) {
  sprite_data_t data = loadData(picInfo, sprite, false);

  float width = trunc(data.size.x);
  float l = trunc(width / 2.0);
  float r = width - l;
  float x = (IS_RIGHT ? r : -l) - data.off.x;

  float height = data.size.y;
  float u = sprite_cstat_realCenter(sprite) ? trunc(height / 2.0) : height;
  float d = height - u;
  float y = (IS_TOP ? u : -d) + data.off.y;

  vec2 scaled = scaleValue(vec2(x, y), vec2(sprite.repeat));

  vec4 pos = vec4((sprite.pos + vec3(0.0, 0.0, scaled.y)).xzy, 1.0);
  return P * (V * pos + vec4(scaled.x, 0.0, 0.0, 0.0));
}

// vec4 getFaceShadowPos(pic_t picInfo, sprite_t sprite) {
// vec3 eyedir = (IV * vec4(0.0, 0.0, -1.0, 0.0)).xyz;
// vec2 normal = normalize(eyedir.xz);
// scaled_t scaled = scale(picInfo, sprite);
// }

ivec2 getShadePal(uint type, sprite_t sprite, sector_t sector) {
#ifdef SPRITE_SHADOW_OFF
  int shade = sprite.shade + (sector_cstat_floorShade(sector.ceilingFloorCstat.y) 
    ? sector.ceilingFloorShade.y 
    : sector_cstat_parallaxing(sector.ceilingFloorCstat.x) 
      ? sector.ceilingFloorShade.x 
      : sector.ceilingFloorShade.y);
  int pal = int(sprite.pal);
#else
  int shade = type == SPRITE_TYPE_WALL
    ? sprite.shade
    : sector_cstat_parallaxing(sector.ceilingFloorCstat.x) 
      ? sector.ceilingFloorShade.x 
      : sector.ceilingFloorShade.y;
  int pal = sector.ceilingFloorPal.y != SPRITE_TYPE_FACE ? int(sector.ceilingFloorPal.y) : int(sprite.pal);
#endif
  return ivec2(shade, pal);
}

void main() {
  sprite_t sprite = loadSprite(sprites, aSpriteId_u16);
  uint type = sprite_cstat_type(sprite);
  if ((type == SPRITE_TYPE_FACE || sprite_cstat_onesided(sprite)) && gl_VertexID > 3) {
    gl_Position = vec4(0.0);
    return;
  }
  sector_t sector = loadSector(sectors, sprite.sec);
  picInfo = loadPicInfo(infos, sprite.picnum, float(aSpriteId_u16));
  ivec2 shadePal = getShadePal(type, sprite, sector);
  bool noSectorShade = sprite_cstat_noshade(sprite);
  int shade = noSectorShade ? sprite.shade : shadePal.x;
  trans = sprite_cstat_translucent(sprite) ? (sprite_cstat_translucentReversed(sprite) ? TRANS1 : TRANS2) : 1.0;
  params = ivec4(shade, shadePal.y, int(sector.visibility), -uint(16) -(aSpriteId_u16 % uint(16)));
  tc = getTc(sprite);
  if (type == SPRITE_TYPE_FACE) gl_Position = getFacePos(picInfo, sprite);
  else if (type == SPRITE_TYPE_WALL) gl_Position = getWallPos(picInfo, sprite);
  else if (type == SPRITE_TYPE_FLOOR) gl_Position = getFloorPos(picInfo, sprite);
}