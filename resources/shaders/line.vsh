precision highp float;
precision highp int;

#include "engine-uniforms.fsh"

in vec3 aStart;
in vec3 aEnd;

vec3 getPos() {
  return gl_VertexID == 0 ? aStart : aEnd;
}

void main() {
  gl_Position =  P * V * vec4(getPos(), 1.0);
}