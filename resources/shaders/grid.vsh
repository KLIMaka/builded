precision highp float;

uniform Matrices {
  mat4 P;
  mat4 V;
};

in vec3 aPos;
out vec3 wpos;

void main() {
  gl_Position = P * V * vec4(aPos, 1.0);
  wpos = aPos;
}