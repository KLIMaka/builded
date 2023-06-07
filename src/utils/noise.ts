// from https://observablehq.com/@jobleonard/pseudo-blue-noise

function noise(width: number, height: number): Int32Array {
  const { random } = Math;

  const flip = () => random() < 0.5;

  // Instead of creating new arrays all the time I ping-pong
  // between two arrays of large enough size, and use a length
  // plus offset to divide indices into smaller parts
  function splitHalf(w: number, h: number, source: Int32Array, target: Int32Array, offset: number) {
    const left = w >> 1;
    const right = w - left;

    // Note that we set the denominator to the bigger half,
    // as this increases randomization of the partitions.
    let lNumerator = 0;
    let rNumerator = 0;
    const denominator = right < left ? left : right;

    let i = offset;
    let j = offset + left * h;
    let k = offset;
    const end = offset + w * h;

    while (k < end) {
      lNumerator += left;
      rNumerator += right;

      if (flip()) {
        if (lNumerator >= denominator) {
          target[i++] = source[k++];
          lNumerator -= denominator;
        }
        if (rNumerator >= denominator) {
          target[j++] = source[k++];
          rNumerator -= denominator;
        }
      } else {
        if (rNumerator >= denominator) {
          target[j++] = source[k++];
          rNumerator -= denominator;
        }
        if (lNumerator >= denominator) {
          target[i++] = source[k++];
          lNumerator -= denominator;
        }
      }
    }
    return left;
  }

  function divide(x: number, y: number, w: number, h: number, source: Int32Array, target: Int32Array, offset: number) {
    if (w === 1 && h === 1) {
      indices[x + y * width] = source[offset];
    } else if (w > h) {
      const left = splitHalf(w, h, source, target, offset);
      const right = w - left;
      // note that we swap the target and source in the recursive call
      divide(x, y, left, h, target, source, offset);
      divide(x + left, y, right, h, target, source, offset + left * h);
    } else {
      const top = splitHalf(h, w, source, target, offset);
      const bottom = h - top;
      divide(x, y, w, top, target, source, offset);
      divide(x, y + top, w, bottom, target, source, offset + top * w);
    }
  }

  const indices = new Int32Array(width * height);
  // Use a single arraybuffer for better cache locality
  // (probably premature optimization, but also harmless)
  // See also: https://devdocs.io/javascript/global_objects/typedarray/subarray
  const buffer = new Int32Array(width * height * 2);
  const source0 = buffer.subarray(0, width * height);
  const target0 = buffer.subarray(width * height, width * height * 2);
  for (let i = 0; i < width * height; i++) source0[i] = i;

  divide(0, 0, width, height, source0, target0, 0);

  return indices;
}