precision highp float;
precision highp int;

#include "engine-uniforms.fsh"

uniform Local {
  uint type;
};

in vec3 aPos1;
in vec3 aPos2;
in vec3 aPos3;
in vec3 aPos4;

out vec2 gridPos;

void main() {
  vec3 poss[6] = vec3[](aPos1, aPos2, aPos3, aPos1, aPos3, aPos4);
  vec3 pos = poss[gl_VertexID];
  gl_Position = P * V * vec4(pos, 1.0);
  gridPos = pos.xz;
}