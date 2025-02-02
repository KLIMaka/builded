precision highp float;

uniform Matrices {
  mat4 P;
  mat4 V;
  mat4 IV;
};

// gl_VertexID mapping
// 1----0 
// |\   |
// | \  |
// |  \ |
// |   \|
// 3----2 

uniform highp usampler2D infos;

in vec3 aPos_i32;
in uvec4 aPicnumAngCstat_u16; 
in ivec4 aPluShadowVisTrans_i8;

out vec3 tc;
flat out ivec4 params;
flat out uvec4 picInfo;

int ubyte2byte(uint x) { return int(x) <= 0x7f ? int(x) : int(x) - 0xff; }
int ushort2short(uint x) { return int(x) <= 0x7fff ? int(x) : int(x) - 0xffff; }
int uint2int(uint x) { return int(x) <= 0x7fffffff ? int(x) : int(x) - 0xffffffff; }

#define PI (3.1415926535897932384626433832795)
#define ATLAS_X (picInfo.y & uint(0xffff))
#define ATLAS_Y ((picInfo.y >> 16) & uint(0xffff))
#define ATLAS_Z (picInfo.z)
#define PIC_W (picInfo.x & uint(0xffff))
#define PIC_H ((picInfo.x >> 16) & uint(0xffff))
#define PIC_FRAMES (picInfo.w & uint(0x3f))
#define PIC_ANIM_TYPE ((picInfo.w >> 6) & uint(0x3))
#define PIC_X (ubyte2byte((picInfo.w >> 8) & uint(0xff)))
#define PIC_Y (ubyte2byte((picInfo.w >> 16) & uint(0xff)))
#define PIC_ANIM_SPEED ((picInfo.w >> 24) & uint(0xf))
#define PIC_TYPE ((picInfo.w >> 28) & uint(0xf))

#define TYPE ((aPicnumAngCstat_u16.z >> 4) & uint(0x3))
#define IS_FACE (TYPE == uint(0))
#define IS_WALL (TYPE == uint(1))
#define IS_FLOOR (TYPE == uint(2))


uvec4 loadPicInfo() {
  uint lo = aPicnumAngCstat_u16.x & uint(0xff);
  uint hi = (aPicnumAngCstat_u16.x >> 8) & uint(0xff);
  return texelFetch(infos, ivec2(lo, hi), 0);
}

vec3 tcs[4] = vec3[](
  vec3(1.0, 0.0, 1.0), 
  vec3(0.0, 0.0, 1.0), 
  vec3(1.0, 1.0, 1.0), 
  vec3(0.0, 1.0, 1.0));

vec3 getTc() { 
  return tcs[gl_VertexID];
}

vec2 wallPos[4] = vec2[](
  vec2(-1.0, 1.0),
  vec2(1.0, 1.0),
  vec2(-1.0, -1.0),
  vec2(1.0, -1.0));

vec4 getWallPos(uvec4 picInfo) {
  float radAng = -float(aPicnumAngCstat_u16.y) * PI / 1024.0;
  vec2 angVec = vec2(sin(radAng), cos(radAng));
  vec2 center = vec2(PIC_W >> 1, PIC_H >> 1);
  vec2 off = vec2(PIC_X, PIC_Y);
  vec2 c = wallPos[gl_VertexID] * center + off;
  vec3 pos = vec3(angVec * c.x, c.y) + aPos_i32;
  return  P * V * vec4(pos.xzy, 1.0);
}

vec2 floorPos[4] = vec2[](
  vec2(0.0, 0.0),
  vec2(1.0, 0.0),
  vec2(0.0, 1.0),
  vec2(1.0, 1.0));

vec4 getFloorPos(uvec4 picInfo) {
  float radAng = float(aPicnumAngCstat_u16.y) * PI / 1024.0;
  vec4 vec = vec4(cos(radAng), sin(radAng), -sin(radAng), cos(radAng));
  vec2 center = vec2(int(PIC_W >> 1) + PIC_X, int(PIC_H >> 1) + PIC_Y);
  vec2 size = vec2(PIC_W, PIC_H);
  vec2 c = center - size * floorPos[gl_VertexID];
  vec3 pos = vec3(vec.xy * c.y + vec.zw * c.x, 0.0) + aPos_i32;
  return P * V * vec4(pos.xzy, 1.0);
}

vec2 facePos[4] = vec2[](
  vec2(1.0, 1.0),
  vec2(-1.0, 1.0),
  vec2(1.0, 0.0),
  vec2(-1.0, 0.0));

vec4 getFacePos(uvec4 picInfo) {
  vec3 eyedir = (IV * vec4(0.0, 0.0, -1.0, 0.0)).xyz;
  vec2 normal = normalize(eyedir.xz);
  float hw = float(PIC_W >> 1);
  float h = float(PIC_H);
  vec2 c = facePos[gl_VertexID];
  vec4 pos = vec4((aPos_i32 + vec3(0.0, 0.0, c.y * h)).xzy, 1.0);
  return P * (V * pos + vec4(c.x * hw, 0.0, 0.0, 0.0));
}

void main() {
  picInfo = loadPicInfo();
  params = aPluShadowVisTrans_i8;
  tc = getTc();
  if (IS_FACE) gl_Position = getFacePos(picInfo);
  else if (IS_WALL) gl_Position = getWallPos(picInfo);
  else if (IS_FLOOR) gl_Position = getFloorPos(picInfo);
}