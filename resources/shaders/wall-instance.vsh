precision highp float;

uniform Matrices {
  mat4 P;
  mat4 V;
  mat4 IV;
};

in vec4 aStartEnd;
in vec4 aFirstWall;
in vec4 aHeinumZ;
in vec4 aTexScaleOff;
in float aPluShadowVisTrans;

out vec3 tc;
flat out ivec4 params;

// gl_VertexID mapping
// 0,3-- 1
// |\    |
// | \   |
// |  \  |
// |   \ |
// 5----\| 2,4

vec2 getWall2dPos() {
  return gl_VertexID == 0 || gl_VertexID == 3 || gl_VertexID == 5
    ? aStartEnd.xy
    : aStartEnd.zw;
}

vec2 getHeinumZ() {
  return gl_VertexID == 0 || gl_VertexID == 3 || gl_VertexID == 1
    ? aHeinumZ.xy
    : aHeinumZ.zw;
}

vec3 getTc() {
  vec2 pos = getWall2dPos();
  if (gl_VertexID == 0 || gl_VertexID == 3) return vec3(0.0, 0.0, 1.0);
  else if (gl_VertexID == 1) return vec3(1.0, 0.0, 1.0);
  else if (gl_VertexID == 5) return vec3(0.0, 1.0, 1.0);
  else return vec3(1.0, 1.0, 1.0); 
}

float cross2d(vec2 v1, vec2 v2) {
  vec2 p =  v1.xy * v2.yx;
  return p.x - p.y;
}

vec3 getWall3dPos() {
  vec2 pos = getWall2dPos();
  vec2 d = pos - aFirstWall.xy;
  float k = -cross2d(aFirstWall.zw, d);
  vec2 heinumZ = getHeinumZ();
  float z = heinumZ.x * k + heinumZ.y;
  return vec3(pos.x, z, pos.y);
}

void main() {
  tc = getTc();
  int iParams = floatBitsToInt(aPluShadowVisTrans);
  params.x = iParams & 0xff;
  params.y = (iParams >> 8) & 0xff;
  params.z = (iParams >> 16) & 0xff;
  params.w = (iParams >> 24) & 0xff;
  gl_Position = P * V * vec4(getWall3dPos(), 1.0);
}