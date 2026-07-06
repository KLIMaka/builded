const uint vertexCountPerVoxel = uint(6);

const vec3[8] cubeVertices = vec3[](
  vec3(-1.0, -1.0, +1.0),
  vec3(+1.0, -1.0, +1.0),
  vec3(+1.0, +1.0, +1.0),
  vec3(-1.0, +1.0, +1.0),
  vec3(-1.0, -1.0, -1.0),
  vec3(+1.0, -1.0, -1.0),
  vec3(+1.0, +1.0, -1.0),
  vec3(-1.0, +1.0, -1.0));

const uint[6] quadOff = uint[](uint(0), uint(1), uint(2), uint(0), uint(2), uint(3));

const uint[24] cubeIndices = uint[](
  uint(3), uint(2), uint(1), uint(0), 
  uint(4), uint(5), uint(6), uint(7),
  uint(4), uint(7), uint(3), uint(0), 
  uint(2), uint(6), uint(5), uint(1),
  uint(0), uint(1), uint(5), uint(4), 
  uint(3), uint(7), uint(6), uint(2));

struct voxel_info_t {
  vec3 pos;
  vec3 off;
  uint color;
};

voxel_info_t getVoxelInfo(highp usampler2D voxelSampler, uint vertexId) {
  uint voxelId = vertexId / vertexCountPerVoxel;
  voxel_t voxel = loadVoxel(voxelSampler, voxelId);
  uint vertexInQuad = vertexId % vertexCountPerVoxel;
  vec3 posOff = cubeVertices[cubeIndices[voxel.quad * uint(4) + quadOff[vertexInQuad]]];
  vec3 voxelCenterOff = posOff / 2.0;
  vec3 off = voxel.off;
  vec3 pos = voxelCenterOff + voxel.pos;
  uint color = voxel.color;

  return voxel_info_t(pos, off, color);
}