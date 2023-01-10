precision highp float;

uniform mat4 P;
uniform mat4 V;
uniform mat4 IV;
uniform mat4 GT;
uniform vec4 sys;

in vec3 aNorm;
in vec3 aPos;
in vec4 aTcps;
in vec4 aLm;

out vec4 tcps;
out vec2 gridtc;
out vec3 wpos;
out vec3 wnormal;
out vec4 lm;

void main() {
  wpos = aPos;
  tcps = aTcps;
  lm = aLm;
#ifdef SPRITE
  vec3 p = aPos + vec3(0.0, aNorm.y, 0.0);
  vec4 epos = V * vec4(p, 1.0) + vec4(aNorm.x, 0.0, 0.0, 0.0);
  gl_Position = P * epos;
  wnormal = (IV * vec4(0.0, 0.0, 1.0, 0.0)).xyz;
  gridtc = (GT * vec4(aNorm.x, aNorm.y, 0.0, 1.0)).xy;
#elif defined SPRITE_FACE
  vec4 epos = P * V * vec4(aPos, 1.0);
  epos /= epos.w;
  vec2 halfscreen = sys.yz / 2.0;
  vec2 screenPos = trunc(halfscreen + epos.xy * halfscreen + aNorm.xy);
  vec2 pos = (screenPos - halfscreen) / halfscreen;
  gl_Position = vec4(pos.x, pos.y, epos.z, epos.w);
#else
  gl_Position = P * V * vec4(aPos, 1.0);
  wnormal = aNorm;
  gridtc = (GT * vec4(aPos, 1.0)).xy;
#endif
}
