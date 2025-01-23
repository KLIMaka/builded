precision highp float;

uniform Matrices {
  mat4 P;
  mat4 V;
};

in vec3 wpos;
out vec4 fragColor;

void main() {
  vec3 coord = wpos / 16.0;
  vec3 gridDet = 1.0 - abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  fragColor = vec4(max(max(gridDet.x, gridDet.y), gridDet.z));
}
