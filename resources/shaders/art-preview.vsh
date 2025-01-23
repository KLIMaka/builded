precision highp float;

uniform Matrices {
  mat4 P;
  mat4 V;
  mat4 IV;
};

in vec3 aPos;
in vec3 aTc;
in float aParams;

out vec3 tc;
flat out ivec4 params;

void main() {
  tc = aTc;
  int iParams = floatBitsToInt(aParams);
  params.x = iParams & 0xff;
  params.y = (iParams >> 8) & 0xff;
  params.z = (iParams >> 16) & 0xff;
  params.w = (iParams >> 24) & 0xff;
#ifdef SPRITE
  vec3 eyedir = (IV * vec4(0.0, 0.0, -1.0, 0.0)).xyz;
  vec2 normal = normalize(eyedir.xz);
  vec4 p = vec4(normal.x * aPos.z, aPos.y, normal.y * aPos.z, 1.0);
  vec4 epos = V * p + vec4(aPos.x, 0.0, 0.0, 0.0);
  gl_Position = P * epos;
#else
  gl_Position = P * V * vec4(aPos, 1.0);
#endif
}
