precision highp float;

uniform mat4 P;
uniform mat4 V;
uniform vec4 size;
uniform vec4 options;

#define SCALE (options.z)
#define SIZE (size.xy)
#define OFF (size.zw)

in vec3 aPos;
in vec2 aTc;

out vec2 tc;

vec4 toXZ(vec2 vec,float w) {
  return vec4(vec.x, 0.0, vec.y, w);
}

void main() {
  vec2 halfoff = fract(SIZE / 2.0);
  vec4 pos = vec4(aPos, 1.0) * toXZ(SIZE * SCALE, 1.0) - toXZ(OFF - halfoff, 0.0);
  gl_Position = P * V * pos;
  tc = aTc * vec2(SCALE);
}
