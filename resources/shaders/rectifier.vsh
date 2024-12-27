precision highp float;

uniform mat4 P;
uniform mat4 V;
uniform vec4 size;

in vec3 aPos;

out vec2 tc;

void main() {
  gl_Position = P * V * (vec4(aPos, 1.0) * vec4(size.x, 0.0, size.y, 1.0));
  tc = aPos.xz;
}
