precision mediump float;

uniform mat4 P;
uniform mat4 V;
uniform mat4 IV;
uniform mat4 GT;
uniform vec4 sys;

attribute vec3 aNorm;
attribute vec3 aPos;
attribute vec2 aTc;

varying vec2 tc;
varying vec2 gridtc;
varying vec3 wpos;
varying vec3 wnormal;

void main() {
  wpos = aPos;
  tc = aTc;
#ifdef SPRITE
  vec3 p = aPos + vec3(0.0, aNorm.y, 0.0);
  vec4 epos = V * vec4(p, 1.0);
  epos.x += aNorm.x;
  gl_Position = P * epos;
  
  wnormal = (IV * vec4(0.0, 0.0, 1.0, 0.0)).xyz;
  gridtc = (GT * vec4(aNorm.x, aNorm.y, 0.0 , 1.0)).xy;
#elif defined SPRITE_FACE
  vec4 epos = P * V * vec4(aPos, 1.0);
  epos /= epos.w;
  epos.xy += aNorm.xy * sys.yz;
  gl_Position = epos;
#else
  gl_Position = P * V * vec4(aPos, 1.0);
  wnormal = aNorm;
  gridtc = (GT * vec4(aPos, 1.0)).xy;
#endif
}
