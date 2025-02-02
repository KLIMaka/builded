precision highp float;

uniform Matrices {
  mat4 P;
  mat4 V;
  mat4 IV;
};

uniform highp usampler2D infos;

in vec4 aStartEnd_i16;
in vec4 aFirstWall_i16;
in vec4 aHeinumZ_i16;
in ivec4 aPluShadowVisTrans_i8;
in uint aPicnum_u16; 

out vec3 tc;
flat out ivec4 params;
flat out uvec4 picInfo;

#define START (aStartEnd_i16.xy)
#define END (aStartEnd_i16.zw)
#define CEILING (aHeinumZ_i16.xy)
#define FLOOR (aHeinumZ_i16.zw)
#define IS_START ((gl_VertexID & 1) == 0)
#define IS_END ((gl_VertexID & 1) == 1)
#define IS_CEILING (gl_VertexID <= 1)
#define IS_FLOOR (gl_VertexID >= 2)

// gl_VertexID mapping
// zec 1----0 zsc
//     |\   |
//     | \  |
//     |  \ |
//     |   \|
// zef 3----2 zsf

vec3 getTc(vec3 pos, uvec4 picInfo) {
  vec3 base = vec3(START, FLOOR.y);
  vec3 delta = base - pos;
  float l = length(delta.xy) / float(picInfo.x & uint(0xffff));
  float dz = delta.z / float((picInfo.x >> 16) & uint(0xffff));
 return vec3(l, dz, 1.0); 
}

float calcZ(vec2 pos, vec2 heinumZ) {
  vec2 d = pos - aFirstWall_i16.xy;
  float k = -cross(vec3(aFirstWall_i16.zw, 0.0), vec3(d, 0.0)).z;
  return (heinumZ.x / 4096.0) * k + heinumZ.y;
}

vec3 getWall3dPos() {
  float zsc = calcZ(START, CEILING);
  float zec = calcZ(END, CEILING);
  float zsf = calcZ(START, FLOOR);
  float zef = calcZ(END, FLOOR);
  if (zef >= zec && zsf >= zsc) return vec3(0.0);
  vec2 dz = vec2((zsf - zsc) / (zec - zef), (zsc - zsf) / (zef - zec));
  vec2 ds = vec2(1.0) - vec2(1.0) / (dz + vec2(1.0));
  vec3 a = vec3(START, zsc);
  vec3 b = vec3(END, zec);

  if (IS_START) {
    if (zsf > zsc) return mix(a, b, ds.x);
    return vec3(START, gl_VertexID == 0 ? zsc : zsf);
  } else {
    if (zef > zec) return mix(a, b, ds.y);
    return vec3(END, gl_VertexID == 1 ? zec : zef);
  }
}

uvec4 loadPicInfo() {
  uint lo = aPicnum_u16 & uint(0xff);
  uint hi = (aPicnum_u16 >> 8) & uint(0xff);
  return texelFetch(infos, ivec2(lo, hi), 0);
}

void main() {
  vec3 pos = getWall3dPos();
  picInfo = loadPicInfo();
  tc = getTc(pos, picInfo);
  params = aPluShadowVisTrans_i8;
  gl_Position = P * V * vec4(pos.xzy, 1.0);
}