precision highp float;
precision highp int;

#include "engine-uniforms.fsh"
#include "structs.vsh"
#include "voxel-inc.vsh"

uniform highp usampler2D voxel;

in vec4 aPlu;

flat out ivec4 params;
flat out uint color;

void main() {
  voxel_info_t voxelInfo = getVoxelInfo(voxel, uint(gl_VertexID));
  vec3 pos = voxelInfo.pos - voxelInfo.off;
  gl_Position = P * V * vec4(pos.xzy, 1.0);
  color = voxelInfo.color;
  params = ivec4(0, aPlu.x, 0, 0);
}