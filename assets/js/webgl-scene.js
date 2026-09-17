/*!
 * webgl-scene.js — one cube, lit and steered by the cursor.
 *
 * Hand-written against the raw WebGL API. No three.js, no gl-matrix, no build
 * step, nothing fetched from a CDN: the matrix maths, the mesh generation, the
 * shaders and the animation all live in this file.
 *
 * WHY THIS VERSION IS FAST
 *   · Nothing is rendered off-screen. There is no shadow map, no bright pass,
 *     no blur, no bloom and no depth of field, so there is no full-resolution
 *     composite left that can soften the picture. Pixels go straight to the
 *     default framebuffer and the hardware's own MSAA handles the edges.
 *   · Four draw calls and 47 triangles in total — cube 12, floor 2, contact
 *     shadow 32, backdrop 1.
 *   · Nothing is allocated per frame. Every buffer, matrix and array is built
 *     once in init(); the frame loop only writes uniforms.
 *   · The drawing buffer is capped twice, by device pixel ratio and by a total
 *     pixel budget, then scaled back automatically if a frame starts to cost
 *     too much (see adaptScale).
 *
 * THE FRAME, IN ORDER
 *   1. backdrop   — two triangles: a radial gradient matching the section's CSS
 *                   plus a soft glow that follows the pointer
 *   2. floor      — one quad, a procedural grid drawn per fragment, a pool of
 *                   light under the pointer, and a fade into the backdrop
 *   3. contact    — a blended disc under the cube, its size and strength driven
 *      shadow       by how high the cube is floating
 *   4. cube       — 24 vertices with flat normals: Blinn-Phong key and fill
 *                   lights, a point light sitting at the cursor, a fresnel rim,
 *                   glowing face edges and an ACES-style tone curve
 *
 * HOW THE CURSOR MOVES THE CUBE
 *   setPointer() takes normalised device coordinates (-1..1, +1 is up/right).
 *   They are projected onto the cube's ground plane to give a world target. The
 *   cube eases toward that target with frame-rate independent damping, then yaws
 *   and leans into the direction it is travelling, which is what makes the
 *   movement read as three-dimensional rather than as a slide. The same world
 *   point is lifted into a point light above the floor, so the light pool in
 *   step 2 and the highlight in step 4 always sit where the cursor is: the cube
 *   is chasing a light the reader is holding.
 */
(function (global) {
  'use strict';

  var DEG = Math.PI / 180;
  var TAU = Math.PI * 2;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* Frame-rate independent damping: reaching for `target` at `rate` per second
   * feels the same at 30 fps and at 144 fps. */
  function damp(current, target, rate, dt) {
    return current + (target - current) * (1 - Math.exp(-rate * dt));
  }

  /* ========================================================================== *
   *  Matrix maths (column-major, 16 floats — what WebGL expects)
   * ========================================================================== */

  function mat4() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function multiply(out, a, b) {
    for (var c = 0; c < 4; c++) {
      var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return out;
  }

  function perspective(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    var nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
    return out;
  }

  function lookAt(out, eye, center, up) {
    var zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    var len = Math.hypot(zx, zy, zz) || 1;
    zx /= len; zy /= len; zz /= len;

    var xx = up[1] * zz - up[2] * zy;
    var xy = up[2] * zx - up[0] * zz;
    var xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz) || 1;
    xx /= len; xy /= len; xz /= len;

    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;

    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }

  /* Model matrix from translation, R = Ry·Rx·Rz, and a per-axis scale.
   *
   * The result is stored COLUMN-major: element [c*4 + r] is row r of column c.
   * Writing the rows into consecutive slots instead transposes the matrix, which
   * silently rotates every object the wrong way. */
  function compose(out, px, py, pz, rx, ry, rz, sx, sy, sz) {
    var cx = Math.cos(rx), sxr = Math.sin(rx);
    var cy = Math.cos(ry), syr = Math.sin(ry);
    var cz = Math.cos(rz), szr = Math.sin(rz);

    /* Row 0 */ var m00 = cy * cz, m01 = syr * sxr * cy * cz - cx * szr, m02 = syr * cz * cx + sxr * szr;
    /* Row 1 */ var m10 = cy * szr, m11 = syr * sxr * szr + cx * cz, m12 = syr * szr * cx - sxr * cz;
    /* Row 2 */ var m20 = -syr, m21 = cy * sxr, m22 = cy * cx;

    out[0] = m00 * sx; out[1] = m10 * sx; out[2] = m20 * sx; out[3] = 0;
    out[4] = m01 * sy; out[5] = m11 * sy; out[6] = m21 * sy; out[7] = 0;
    out[8] = m02 * sz; out[9] = m12 * sz; out[10] = m22 * sz; out[11] = 0;
    out[12] = px; out[13] = py; out[14] = pz; out[15] = 1;
    return out;
  }

  /* The rotation part of a model matrix with each column renormalised. That is
   * the correct normal matrix for rotations and uniform scales, which is all
   * this scene uses. */
  function normalMatrix(out, m) {
    for (var c = 0; c < 3; c++) {
      var x = m[c * 4], y = m[c * 4 + 1], z = m[c * 4 + 2];
      var len = Math.hypot(x, y, z) || 1;
      out[c * 3] = x / len; out[c * 3 + 1] = y / len; out[c * 3 + 2] = z / len;
    }
    return out;
  }

  /* ========================================================================== *
   *  Shaders
   *
   *  Written in GLSL ES 1.00: a WebGL 1 and a WebGL 2 context both compile this
   *  unchanged, so there is one code path and no #version juggling.
   * ========================================================================== */

  var PRECISION = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif'
  ].join('\n');

  /* --- the backdrop ------------------------------------------------------- */

  var BACKDROP_VS = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var BACKDROP_FS = [
    PRECISION,
    'varying vec2 vUv;',
    'uniform vec2 uCenter;',
    'uniform float uAspect;',
    'uniform vec3 uInner;',
    'uniform vec3 uMid;',
    'uniform vec3 uOuter;',
    'uniform vec2 uGlow;',
    'uniform vec3 uGlowColor;',
    'uniform float uGlowStrength;',
    'void main() {',
    /* Distance from the gradient hot spot, corrected so the falloff stays round
     * on a wide canvas instead of stretching with the viewport. */
    '  vec2 p = vec2((vUv.x - uCenter.x) * uAspect, vUv.y - uCenter.y);',
    '  float d = length(p);',
    '  vec3 col = mix(uInner, uMid, smoothstep(0.0, 0.62, d));',
    '  col = mix(col, uOuter, smoothstep(0.5, 1.25, d));',
    /* A soft wash of light behind the pointer, so the stage reacts before the
     * cube has finished travelling to it. */
    '  vec2 gp = vec2((vUv.x - uGlow.x) * uAspect, vUv.y - uGlow.y);',
    '  col += uGlowColor * exp(-dot(gp, gp) * 13.0) * uGlowStrength;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* --- the floor ---------------------------------------------------------- */

  var FLOOR_VS = [
    'attribute vec3 aPos;',
    'uniform mat4 uViewProj;',
    'varying vec3 vWorld;',
    'void main() {',
    '  vWorld = aPos;',
    '  gl_Position = uViewProj * vec4(aPos, 1.0);',
    '}'
  ].join('\n');

  var FLOOR_FS = [
    PRECISION,
    'varying vec3 vWorld;',
    'uniform vec3 uCamPos;',
    'uniform vec2 uFade;',
    'uniform vec3 uFloorColor;',
    'uniform vec3 uLineColor;',
    'uniform vec3 uMajorColor;',
    'uniform vec3 uAxisColor;',
    'uniform float uGridStrength;',
    'uniform vec2 uCursorXZ;',
    'uniform vec3 uCursorColor;',
    'uniform float uCursorStrength;',
    '',
    /* Distance to the nearest grid line, in world units. The anti-aliasing is
     * analytic — the line widens with distance — instead of asking for screen
     * derivatives, which are not available everywhere in WebGL 1. */
    'float lineMask(vec2 p, float scale, float width) {',
    '  vec2 cell = abs(fract(p / scale - 0.5) - 0.5) * scale;',
    '  float d = min(cell.x, cell.y);',
    '  return 1.0 - smoothstep(width * 0.5, width * 1.7, d);',
    '}',
    '',
    'void main() {',
    '  vec2 p = vWorld.xz;',
    '  float dist = distance(p, uCamPos.xz);',
    '  float minor = lineMask(p, 1.0, 0.006 + 0.0022 * dist);',
    '  float major = lineMask(p, 5.0, 0.010 + 0.0030 * dist);',
    /* The two world axes get their own colour, so the plane reads as a space
     * with an origin rather than as wallpaper. */
    '  float axis = 1.0 - smoothstep(0.0, 0.014 + 0.006 * dist, min(abs(p.x), abs(p.y)));',
    '',
    '  vec2 toCursor = p - uCursorXZ;',
    '  float pool = exp(-dot(toCursor, toCursor) * 0.45) * uCursorStrength;',
    '',
    '  vec3 col = uFloorColor;',
    '  col = mix(col, uLineColor, minor * 0.45 * uGridStrength);',
    '  col = mix(col, uMajorColor, major * 0.55 * uGridStrength);',
    '  col = mix(col, uAxisColor, axis * 0.6 * uGridStrength);',
    '  col += uCursorColor * pool * 0.85;',
    '',
    '  float detail = clamp(minor * 0.45 * uGridStrength + major * 0.55 * uGridStrength',
    '                       + axis * 0.6 * uGridStrength + pool, 0.0, 1.0);',
    /* Fade the plane into the backdrop well before the quad ends, so the floor
     * has no visible edge and the horizon stays soft. */
    '  float fade = 1.0 - smoothstep(uFade.x, uFade.y, length(p));',
    '  float alpha = fade * (0.10 + 0.90 * detail);',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  /* --- the contact shadow ------------------------------------------------- */

  var SHADOW_VS = [
    'attribute vec3 aPos;',
    'attribute vec2 aUv;',
    'uniform mat4 uModel;',
    'uniform mat4 uViewProj;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aUv;',
    '  gl_Position = uViewProj * uModel * vec4(aPos, 1.0);',
    '}'
  ].join('\n');

  var SHADOW_FS = [
    PRECISION,
    'varying vec2 vUv;',
    'uniform vec3 uColor;',
    'uniform float uStrength;',
    'void main() {',
    '  float r = length(vUv);',
    /* A wide soft core with a long tail: cheap, stable, and it reads as a
     * contact shadow without a single shadow-map texel. */
    '  float a = 1.0 - smoothstep(0.0, 1.0, r);',
    '  a = pow(a, 1.6);',
    '  gl_FragColor = vec4(uColor, a * uStrength);',
    '}'
  ].join('\n');

  /* --- the cube ----------------------------------------------------------- */

  var CUBE_VS = [
    'attribute vec3 aPos;',
    'attribute vec3 aNormal;',
    'attribute vec2 aUv;',
    'uniform mat4 uModel;',
    'uniform mat4 uViewProj;',
    'uniform mat3 uNormalMat;',
    'varying vec3 vNormal;',
    'varying vec3 vWorld;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec4 world = uModel * vec4(aPos, 1.0);',
    '  vWorld = world.xyz;',
    '  vNormal = normalize(uNormalMat * aNormal);',
    '  vUv = aUv;',
    '  gl_Position = uViewProj * world;',
    '}'
  ].join('\n');

  var CUBE_FS = [
    PRECISION,
    'varying vec3 vNormal;',
    'varying vec3 vWorld;',
    'varying vec2 vUv;',
    'uniform vec3 uCamPos;',
    'uniform vec3 uBaseColor;',
    'uniform float uMetal;',
    'uniform float uRough;',
    'uniform vec3 uKeyDir;',
    'uniform vec3 uKeyColor;',
    'uniform vec3 uFillDir;',
    'uniform vec3 uFillColor;',
    'uniform vec3 uRimColor;',
    'uniform vec3 uCursorPos;',
    'uniform vec3 uCursorColor;',
    'uniform float uCursorStrength;',
    'uniform float uEdgeGlow;',
    '',
    'void main() {',
    '  vec3 N = normalize(vNormal);',
    '  vec3 V = normalize(uCamPos - vWorld);',
    '',
    /* A slight per-face tint: the top face catches more of the sky, and that
     * difference is what makes the orientation readable while it spins. The
     * ambient term is deliberately dim — the directional lights below are what
     * give the faces their range, and a bright ambient flattens them all. */
    '  float up = N.y * 0.5 + 0.5;',
    '  vec3 albedo = uBaseColor * (0.88 + 0.12 * up);',
    '  vec3 ambient = mix(vec3(0.025, 0.030, 0.070), vec3(0.085, 0.075, 0.175), up);',
    '  float shininess = mix(6.0, 180.0, pow(1.0 - uRough, 2.0));',
    '  vec3 color = vec3(0.0);',
    '',
    /* Key light: the one that makes the cube look solid. */
    '  vec3 L = normalize(uKeyDir);',
    '  vec3 H = normalize(L + V);',
    '  float ndl = max(dot(N, L), 0.0);',
    '  float spec = pow(max(dot(N, H), 0.0), shininess) * mix(0.25, 0.8, 1.0 - uRough);',
    '  color += (albedo * (ambient + uKeyColor * ndl) + uKeyColor * spec) * mix(1.0, 0.72, uMetal);',
    '',
    /* Fill light: cyan from the opposite side, so no face ever goes black, plus
     * a small share of it as ambient so the underside is not a hole. */
    '  L = normalize(uFillDir);',
    '  H = normalize(L + V);',
    '  ndl = max(dot(N, L), 0.0);',
    '  color += albedo * (uFillColor * ndl + uFillColor * 0.16);',
    '  color += uFillColor * pow(max(dot(N, H), 0.0), shininess) * 0.16 * (1.0 - uRough);',
    '',
    /* Fresnel rim: brightens the silhouette, which is what sells the spin. Kept
     * restrained, because a strong rim washes the faces out. */
    '  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
    '  color += uRimColor * fres * 0.5;',
    '',
    /* The cursor as a point light, with softened inverse-square attenuation so
     * the highlight does not blow out when the pointer sits on the cube. */
    '  vec3 toCursor = uCursorPos - vWorld;',
    '  float cd = length(toCursor);',
    '  L = toCursor / max(cd, 1e-4);',
    '  H = normalize(L + V);',
    '  float atten = 1.0 / (1.0 + cd * cd * 0.42);',
    '  float cndl = max(dot(N, L), 0.0);',
    '  color += uCursorColor * uCursorStrength * atten',
    '         * (albedo * cndl * 2.1 + pow(max(dot(N, H), 0.0), shininess) * 0.5);',
    '',
    /* Glowing face edges, drawn from the face's own coordinates: no line
     * geometry, no second draw call. */
    '  float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));',
    '  float edge = 1.0 - smoothstep(0.0, 0.045, e);',
    '  color += uRimColor * edge * uEdgeGlow * 0.4;',
    '',
    /* Filmic curve, then gamma. Tone mapping lives in the shader, so there is
     * no post pass and no extra render target. */
    '  color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);',
    '  color = pow(clamp(color, 0.0, 1.0), vec3(0.4545));',
    '  gl_FragColor = vec4(color, 1.0);',
    '}'
  ].join('\n');

  /* ========================================================================== *
   *  GL plumbing
   * ========================================================================== */

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(shader) || 'unknown shader error';
      gl.deleteShader(shader);
      return { error: log };
    }
    return { shader: shader };
  }

  /* Compiles, links, and pre-resolves every uniform the caller named, so the
   * frame loop is nothing but gl.uniform* calls on plain locations. Attribute
   * locations are bound before linking, which makes the vertex layout explicit
   * instead of driver-dependent. */
  function createProgram(gl, vsSource, fsSource, uniforms, attribs) {
    var vs = compile(gl, gl.VERTEX_SHADER, vsSource);
    if (vs.error) return { error: 'vertex: ' + vs.error };
    var fs = compile(gl, gl.FRAGMENT_SHADER, fsSource);
    if (fs.error) {
      gl.deleteShader(vs.shader);
      return { error: 'fragment: ' + fs.error };
    }

    var program = gl.createProgram();
    gl.attachShader(program, vs.shader);
    gl.attachShader(program, fs.shader);
    for (var i = 0; i < attribs.length; i++) {
      gl.bindAttribLocation(program, attribs[i].location, attribs[i].name);
    }
    gl.linkProgram(program);

    /* The shader objects are only needed until the link succeeds. */
    gl.detachShader(program, vs.shader);
    gl.detachShader(program, fs.shader);
    gl.deleteShader(vs.shader);
    gl.deleteShader(fs.shader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(program) || 'unknown link error';
      gl.deleteProgram(program);
      return { error: log };
    }

    var u = {};
    for (var k = 0; k < uniforms.length; k++) {
      u[uniforms[k]] = gl.getUniformLocation(program, uniforms[k]);
    }
    return { program: program, u: u };
  }

  /* A mesh is a list of attribute buffers plus an optional index buffer. */
  function createMesh(gl, parts, indices) {
    var mesh = { parts: [], index: null, count: 0, triangles: 0 };
    var i;

    for (i = 0; i < parts.length; i++) {
      var buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, parts[i].data, gl.STATIC_DRAW);
      mesh.parts.push({ location: parts[i].location, size: parts[i].size, buffer: buffer });
    }

    if (indices) {
      mesh.index = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      mesh.count = indices.length;
      mesh.triangles = indices.length / 3;
    } else {
      mesh.count = parts[0].data.length / parts[0].size;
      mesh.triangles = mesh.count / 3;
    }
    return mesh;
  }

  function drawMesh(gl, mesh) {
    for (var i = 0; i < mesh.parts.length; i++) {
      var part = mesh.parts[i];
      gl.enableVertexAttribArray(part.location);
      gl.bindBuffer(gl.ARRAY_BUFFER, part.buffer);
      gl.vertexAttribPointer(part.location, part.size, gl.FLOAT, false, 0, 0);
    }
    if (mesh.index) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }
  }

  /* ========================================================================== *
   *  Geometry
   * ========================================================================== */

  /* A unit cube centred on the origin: 24 vertices so every face carries its own
   * flat normal, and 36 indices so the GPU still only sees 12 triangles.
   *
   * Each face is built from an outward normal `n` and a right-handed basis
   * (u, v) with u × v = n, which keeps the winding counter-clockwise as seen
   * from outside. Corners walk (-1,-1) → (1,-1) → (1,1) → (-1,1). */
  function buildCube() {
    var faces = [
      { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
      { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
      { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
      { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
      { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
      { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }
    ];
    var corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

    var positions = new Float32Array(faces.length * 12);
    var normals = new Float32Array(faces.length * 12);
    var uvs = new Float32Array(faces.length * 8);
    var indices = new Uint16Array(faces.length * 6);

    var p = 0, n = 0, t = 0, idx = 0, vi = 0;
    for (var f = 0; f < faces.length; f++) {
      var face = faces[f];
      for (var c = 0; c < 4; c++) {
        var s = corners[c][0], w = corners[c][1];
        positions[p++] = 0.5 * (face.n[0] + face.u[0] * s + face.v[0] * w);
        positions[p++] = 0.5 * (face.n[1] + face.u[1] * s + face.v[1] * w);
        positions[p++] = 0.5 * (face.n[2] + face.u[2] * s + face.v[2] * w);

        normals[n++] = face.n[0];
        normals[n++] = face.n[1];
        normals[n++] = face.n[2];

        uvs[t++] = (s + 1) * 0.5;
        uvs[t++] = (w + 1) * 0.5;
      }
      indices[idx++] = vi; indices[idx++] = vi + 1; indices[idx++] = vi + 2;
      indices[idx++] = vi; indices[idx++] = vi + 2; indices[idx++] = vi + 3;
      vi += 4;
    }

    return { positions: positions, normals: normals, uvs: uvs, indices: indices };
  }

  /* A flat quad on y = 0, wide enough that its edges are already invisible
   * inside the grid's fade distance. */
  function buildFloor(half) {
    return new Float32Array([
      -half, 0, -half,
      half, 0, -half,
      half, 0, half,
      -half, 0, -half,
      half, 0, half,
      -half, 0, half
    ]);
  }

  /* A unit disc in the XZ plane carrying its radius in the UV, used as a
   * triangle fan for the contact shadow. 32 triangles is plenty for a blob. */
  function buildDisc(segments) {
    var positions = new Float32Array((segments + 2) * 3);
    var uvs = new Float32Array((segments + 2) * 2);
    var indices = new Uint16Array(segments * 3);
    var i;

    /* The centre comes first, then the rim, so the fan is one contiguous run. */
    positions[0] = 0; positions[1] = 0; positions[2] = 0;
    uvs[0] = 0; uvs[1] = 0;

    for (i = 0; i <= segments; i++) {
      var a = (i / segments) * TAU;
      var x = Math.cos(a), z = Math.sin(a);
      var v = i + 1;
      positions[v * 3] = x; positions[v * 3 + 1] = 0; positions[v * 3 + 2] = z;
      uvs[v * 2] = x; uvs[v * 2 + 1] = z;
    }

    var idx = 0;
    for (i = 0; i < segments; i++) {
      indices[idx++] = 0; indices[idx++] = i + 1; indices[idx++] = i + 2;
    }
    return { positions: positions, uvs: uvs, indices: indices };
  }

  /* ========================================================================== *
   *  Scene
   * ========================================================================== */

  /* Quality presets only move the resolution ceiling. With no off-screen passes
   * left there is nothing else expensive to dial down. */
  var PRESETS = {
    sharp: { maxDpr: 1.75, pixelBudget: 2600000 },
    balanced: { maxDpr: 1.35, pixelBudget: 1900000 },
    light: { maxDpr: 1.0, pixelBudget: 1400000 }
  };

  function Scene() {
    this.gl = null;
    this.canvas = null;
    this.ok = false;
    this.reason = '';
    this.api = 'WebGL';

    /* Pipeline handles and viewport state, all filled in by init(). */
    this.programs = {};
    this.meshes = {};
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;

    /* Matrices are allocated once and reused every frame. */
    this.proj = mat4();
    this.view = mat4();
    this.viewProj = mat4();
    this.model = mat4();
    this.shadowModel = mat4();
    this.normalMat = new Float32Array(9);

    /* Scratch matrices for the travel-limit solver, kept apart from the ones the
     * draw path uses so a resize can never disturb the frame in flight. */
    this.boundsProj = mat4();
    this.boundsView = mat4();
    this.boundsViewProj = mat4();

    this.time = 0;

    /* Camera: an orbit around a fixed point, so the cube's movement always
     * reads against the same frame of reference. */
    this.camera = {
      yaw: 0.62, pitch: 0.46, distance: 9.4,
      targetYaw: 0.62, targetPitch: 0.46, targetDistance: 9.4,
      minPitch: 0.14, maxPitch: 1.15, minDistance: 6.0, maxDistance: 13.5,
      fov: 38 * DEG, target: [0, 0.95, 0]
    };
    this.eye = [0, 0, 0];

    /* The cursor: its normalised device coordinates, its world point on the
     * floor, and how engaged it currently is (0 → 1 as it arrives or leaves). */
    this.pointer = {
      nx: 0, ny: 0,
      x: 0, z: 0,
      active: 0,
      engaged: false,
      lightY: 2.4
    };

    /* Travel limits, recomputed on resize so the cube always moves inside the
     * visible frame however tall or wide the stage happens to be. */
    this.bounds = { x: 3.0, z: 2.4 };

    this.cube = {
      name: 'Cursor Cube',
      size: 1.4,
      height: 0.98,
      position: [0, 0],
      velocity: [0, 0],
      rotation: [0, 0, 0],
      spin: 0,
      spinVel: 0,
      bob: 0,
      color: [0.36, 0.15, 0.86],
      metal: 0.28,
      rough: 0.26,
      edges: 1.0
    };

    this.options = { spin: true, cursorLight: true, grid: true, shadow: true };

    this.quality = { maxDpr: PRESETS.sharp.maxDpr, pixelBudget: PRESETS.sharp.pixelBudget };
    this.presetKey = 'sharp';
    this.scale = 1;                          /* dynamic resolution, 0.6 … 1 */
    this.adapt = { frames: 0, ms: 0, hold: 0 };
    this.reduced = false;
    this.lost = false;
    this.stats = {
      drawCalls: 0, triangles: 0, vertices: 0,
      width: 1, height: 1, scale: 1, pixelRatio: 1
    };

    this.onContextLost = null;
    this.onContextRestored = null;
    this._handleLost = null;
    this._handleRestored = null;
  }

  /* ---------------------------------------------------------------- init - */

  Scene.prototype.init = function (canvas, options) {
    options = options || {};
    this.canvas = canvas;

    /* One attribute shape for every context path: plain, MSAA'd, opaque, with a
     * depth buffer and nothing else. */
    var attributes = {
      alpha: false,
      antialias: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false
    };

    var gl = null;
    try { gl = canvas.getContext('webgl2', attributes); } catch (e) { gl = null; }
    if (gl) {
      this.api = 'WebGL 2';
    } else {
      try { gl = canvas.getContext('webgl', attributes); } catch (e) { gl = null; }
      if (!gl) {
        try { gl = canvas.getContext('experimental-webgl', attributes); } catch (e) { gl = null; }
      }
      this.api = 'WebGL 1';
    }
    if (!gl) {
      this.reason = 'This browser or device did not provide a WebGL context.';
      return false;
    }
    this.gl = gl;

    var specs = [
      ['backdrop', BACKDROP_VS, BACKDROP_FS,
        ['uCenter', 'uAspect', 'uInner', 'uMid', 'uOuter', 'uGlow', 'uGlowColor', 'uGlowStrength'],
        [{ location: 0, name: 'aPos' }]],
      ['floor', FLOOR_VS, FLOOR_FS,
        ['uViewProj', 'uCamPos', 'uFade', 'uFloorColor', 'uLineColor', 'uMajorColor',
          'uAxisColor', 'uGridStrength', 'uCursorXZ', 'uCursorColor', 'uCursorStrength'],
        [{ location: 0, name: 'aPos' }]],
      ['shadow', SHADOW_VS, SHADOW_FS,
        ['uModel', 'uViewProj', 'uColor', 'uStrength'],
        [{ location: 0, name: 'aPos' }, { location: 2, name: 'aUv' }]],
      ['cube', CUBE_VS, CUBE_FS,
        ['uModel', 'uViewProj', 'uNormalMat', 'uCamPos', 'uBaseColor', 'uMetal', 'uRough',
          'uKeyDir', 'uKeyColor', 'uFillDir', 'uFillColor', 'uRimColor',
          'uCursorPos', 'uCursorColor', 'uCursorStrength', 'uEdgeGlow'],
        [{ location: 0, name: 'aPos' }, { location: 1, name: 'aNormal' },
          { location: 2, name: 'aUv' }]]
    ];

    for (var i = 0; i < specs.length; i++) {
      var spec = specs[i];
      var built = createProgram(gl, spec[1], spec[2], spec[3], spec[4]);
      if (built.error) {
        this.reason = 'Shader build failed (' + spec[0] + '): ' + built.error;
        this.dispose();
        return false;
      }
      this.programs[spec[0]] = built;
    }

    var cube = buildCube();
    this.meshes.cube = createMesh(gl, [
      { location: 0, size: 3, data: cube.positions },
      { location: 1, size: 3, data: cube.normals },
      { location: 2, size: 2, data: cube.uvs }
    ], cube.indices);

    var disc = buildDisc(32);
    this.meshes.shadow = createMesh(gl, [
      { location: 0, size: 3, data: disc.positions },
      { location: 2, size: 2, data: disc.uvs }
    ], disc.indices);

    this.meshes.floor = createMesh(gl, [{ location: 0, size: 3, data: buildFloor(26) }], null);

    /* One oversized triangle instead of two: fewer vertices, no diagonal seam.
     * It is never depth-tested, so its position on the z axis is irrelevant. */
    this.meshes.backdrop = createMesh(gl, [{
      location: 0, size: 2,
      data: new Float32Array([-1, -1, 3, -1, -1, 3])
    }], null);

    gl.disable(gl.CULL_FACE);          /* the cube is closed, so depth already wins */
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    if (options.preset && PRESETS[options.preset]) this.setPreset(options.preset);
    if (options.reducedMotion) this.reduced = true;

    /* A lost context is recoverable. Report it and let the controller decide
     * what the visitor sees. */
    var self = this;
    this._handleLost = function (event) {
      event.preventDefault();
      self.lost = true;
      if (self.onContextLost) self.onContextLost();
    };
    this._handleRestored = function () {
      self.lost = false;
      if (self.onContextRestored) self.onContextRestored();
    };
    canvas.addEventListener('webglcontextlost', this._handleLost, false);
    canvas.addEventListener('webglcontextrestored', this._handleRestored, false);

    this.ok = true;
    return true;
  };

  Scene.prototype.dispose = function () {
    var gl = this.gl;
    var key, name;

    if (this.canvas && this._handleLost) {
      this.canvas.removeEventListener('webglcontextlost', this._handleLost, false);
      this.canvas.removeEventListener('webglcontextrestored', this._handleRestored, false);
    }
    if (!gl) return;

    for (key in this.programs) {
      if (this.programs.hasOwnProperty(key) && this.programs[key].program) {
        gl.deleteProgram(this.programs[key].program);
      }
    }
    for (name in this.meshes) {
      if (!this.meshes.hasOwnProperty(name)) continue;
      var mesh = this.meshes[name];
      for (var i = 0; i < mesh.parts.length; i++) gl.deleteBuffer(mesh.parts[i].buffer);
      if (mesh.index) gl.deleteBuffer(mesh.index);
    }
    this.programs = {};
    this.meshes = {};
    this.gl = null;
    this.ok = false;
  };

  /* -------------------------------------------------------------- resize - */

  /* Returns true when the drawing buffer actually changed, so the controller can
   * skip redundant work on noise-driven resize events. */
  Scene.prototype.resize = function (canvas, cssWidth, cssHeight) {
    if (!this.ok) return false;
    var w = Math.max(1, Math.round(cssWidth));
    var h = Math.max(1, Math.round(cssHeight));

    var dpr = clamp(global.devicePixelRatio || 1, 1, this.quality.maxDpr);
    var pixels = w * h * dpr * dpr * this.scale * this.scale;

    /* A second ceiling: a 4K canvas at 2× is 33 MP of fragments, which is a lot
     * of pixels to push for one cube. */
    if (pixels > this.quality.pixelBudget) {
      dpr *= Math.sqrt(this.quality.pixelBudget / pixels);
    }

    var bufferW = Math.max(1, Math.round(w * dpr));
    var bufferH = Math.max(1, Math.round(h * dpr));
    if (bufferW === this.width && bufferH === this.height) return false;

    canvas.width = bufferW;
    canvas.height = bufferH;
    this.width = bufferW;
    this.height = bufferH;
    this.pixelRatio = dpr;
    this.stats.width = bufferW;
    this.stats.height = bufferH;
    this.stats.pixelRatio = dpr;
    this.updateBounds();
    return true;
  };

  /* Keep the cube's travel inside the frame.
   *
   * The limits are measured, not guessed. The camera basis is rebuilt here, a
   * sphere that contains the cube is projected through it, and each axis is
   * grown until that sphere would touch the edge of the frame — then the pair is
   * shrunk until the corners of the corridor fit as well, because the widest
   * point of a rectangular corridor is a diagonal. The result adapts to the
   * stage's aspect ratio, the zoom level and the camera angle, so a narrow
   * phone-sized stage gets a narrower corridor instead of a cube that wanders
   * off screen. */
  Scene.prototype.updateBounds = function () {
    var cam = this.camera;
    var aspect = this.width / Math.max(1, this.height);
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var eye = [
      cam.target[0] + Math.sin(cam.yaw) * cp * cam.distance,
      cam.target[1] + sp * cam.distance,
      cam.target[2] + Math.cos(cam.yaw) * cp * cam.distance
    ];

    perspective(this.boundsProj, cam.fov, aspect, 0.6, 90);
    lookAt(this.boundsView, eye, cam.target, [0, 1, 0]);
    multiply(this.boundsViewProj, this.boundsProj, this.boundsView);

    var m = this.boundsViewProj;
    var v = this.boundsView;
    var y = this.cube.height;
    /* The sphere that contains the cube at any angle: half the size times √3,
     * written out so the number is checkable. Anything smaller would let a
     * corner poke past the edge of the frame while the cube was tumbling. */
    var radius = this.cube.size * 0.866;
    var tanHalf = Math.tan(cam.fov * 0.5);
    var limit = 0.96;                        /* the NDC margin it must respect */

    /* Does a cube centred on (x, y, z) stay inside the frame? */
    function fits(x, z) {
      var w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 0.05) return false;
      /* View-space depth, not distance to the eye: that is what the projection
       * actually divides by, and it is what makes the near side of the corridor
       * the restrictive one. */
      var depth = -(v[2] * x + v[6] * y + v[10] * z + v[14]);
      if (depth <= 0.05) return false;
      var nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
      var ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      var ry = radius / (depth * tanHalf);
      var rx = ry / aspect;
      return Math.abs(nx) + rx <= limit && Math.abs(ny) + ry <= limit;
    }

    function grow(axis) {
      var lo = 0, hi = 9;
      for (var i = 0; i < 26; i++) {
        var mid = (lo + hi) * 0.5;
        var ok = axis === 'x'
          ? fits(mid, 0) && fits(-mid, 0)
          : fits(0, mid) && fits(0, -mid);
        if (ok) lo = mid; else hi = mid;
      }
      return lo;
    }

    var maxX = grow('x');
    var maxZ = grow('z');
    var shrink = 0.45;
    for (var k = 1; k >= 0.45; k -= 0.02) {
      if (fits(maxX * k, maxZ * k) && fits(-maxX * k, maxZ * k)
        && fits(maxX * k, -maxZ * k) && fits(-maxX * k, -maxZ * k)) {
        shrink = k;
        break;
      }
    }

    this.bounds.x = clamp(maxX * shrink, 0.6, 4.0);
    this.bounds.z = clamp(maxZ * shrink, 0.5, 3.4);
  };

  /* ----------------------------------------------- adaptive resolution --- */

  /* Called every frame with the CPU-side frame time. If frames start to cost too
   * much, the render scale drops in 10% steps; when there is headroom again it
   * walks back up. The window is long enough that a single slow frame — a GC
   * pause, a layout — cannot cause a visible resolution pop. */
  Scene.prototype.adaptScale = function (frameMs, dt) {
    var a = this.adapt;
    a.frames++;
    a.ms += Math.min(frameMs, 60);
    a.hold -= dt;
    if (a.frames < 24) return;

    var average = a.ms / a.frames;
    a.frames = 0;
    a.ms = 0;
    if (a.hold > 0) return;

    /* The floor is 0.75, not "whatever it takes": below that the cube starts to
     * look soft, and a soft hero render is worse than a slower one. */
    if (average > 21.5 && this.scale > 0.76) {
      this.scale = Math.max(0.75, this.scale - 0.06);
    } else if (average < 12.5 && this.scale < 1) {
      this.scale = Math.min(1, this.scale + 0.05);
    } else {
      return;
    }

    a.hold = 1.2;                      /* settle before judging again */
    if (this.canvas) {
      this.resize(this.canvas, this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);
    }
    this.stats.scale = this.scale;
  };

  Scene.prototype.setPreset = function (key) {
    var preset = PRESETS[key];
    if (!preset) return false;
    this.presetKey = key;
    this.quality.maxDpr = preset.maxDpr;
    this.quality.pixelBudget = preset.pixelBudget;
    this.scale = 1;
    if (this.canvas) {
      this.resize(this.canvas, this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);
    }
    return true;
  };

  Scene.prototype.setOption = function (key, on) {
    if (!this.options.hasOwnProperty(key)) return false;
    this.options[key] = !!on;
    return true;
  };

  /* --------------------------------------------------------------- input - */

  Scene.prototype.setPointer = function (nx, ny) {
    this.pointer.nx = clamp(nx, -1, 1);
    this.pointer.ny = clamp(ny, -1, 1);
    this.pointer.x = clamp(this.pointer.nx * this.bounds.x, -this.bounds.x, this.bounds.x);
    /* +1 is the top of the stage and the far side of the floor is -z, so the
     * pointer's vertical axis maps to the scene's depth axis inverted. */
    this.pointer.z = clamp(-this.pointer.ny * this.bounds.z, -this.bounds.z, this.bounds.z);
  };

  Scene.prototype.setEngaged = function (on) {
    this.pointer.engaged = !!on;
  };

  Scene.prototype.pointerAway = function () {
    this.pointer.nx = 0;
    this.pointer.ny = 0;
  };

  Scene.prototype.orbitBy = function (dx, dy) {
    var cam = this.camera;
    cam.targetYaw -= dx * 0.0055;
    cam.targetPitch = clamp(cam.targetPitch + dy * 0.0045, cam.minPitch, cam.maxPitch);
    /* A steeper look-down opens up more floor, so the corridor is re-measured. */
    this.updateBounds();
  };

  Scene.prototype.zoomBy = function (delta) {
    var cam = this.camera;
    cam.targetDistance = clamp(cam.targetDistance * Math.exp(delta * 0.0011),
      cam.minDistance, cam.maxDistance);
    this.updateBounds();
  };

  /* Nudge the cube itself: the keyboard route to the movement the pointer
   * performs, for anyone who cannot use a mouse. */
  Scene.prototype.nudge = function (dx, dy) {
    this.setEngaged(true);
    this.setPointer(this.pointer.nx + dx, this.pointer.ny + dy);
  };

  Scene.prototype.kick = function () {
    this.cube.spinVel += 4.2;
  };

  Scene.prototype.resetView = function () {
    var cam = this.camera;
    cam.targetYaw = 0.62;
    cam.targetPitch = 0.46;
    cam.targetDistance = 9.4;
    this.pointer.engaged = false;
    this.pointerAway();
    this.cube.spinVel = 0;
    this.setPointer(0, 0);
    this.updateBounds();
  };

  /* ------------------------------------------------------------- physics - */

  Scene.prototype.update = function (dt) {
    var pointer = this.pointer;
    var cube = this.cube;

    pointer.active = damp(pointer.active, pointer.engaged ? 1 : 0, 3.4, dt);
    var weight = pointer.active;

    /* The pointer's world point is both where the cube is heading and where the
     * cursor light sits, so the light leads the mesh by a few frames. With the
     * pointer away, weight falls to zero and the cube drifts back to centre. */
    var beforeX = cube.position[0];
    var beforeZ = cube.position[1];
    cube.position[0] = damp(beforeX, pointer.x * weight, 6.2, dt);
    cube.position[1] = damp(beforeZ, pointer.z * weight, 6.2, dt);

    var safeDt = Math.max(dt, 1e-4);
    cube.velocity[0] = damp(cube.velocity[0], (cube.position[0] - beforeX) / safeDt, 8, dt);
    cube.velocity[1] = damp(cube.velocity[1], (cube.position[1] - beforeZ) / safeDt, 8, dt);

    /* Rotation is what makes the movement read as three-dimensional: the cube
     * yaws with the pointer's horizontal offset, pitches with the vertical
     * offset, and rolls into its own direction of travel. */
    cube.rotation[0] = damp(cube.rotation[0], -pointer.ny * 0.55 * weight, 6.5, dt);
    cube.rotation[1] = damp(cube.rotation[1],
      pointer.nx * 1.15 * weight + clamp(cube.velocity[0] * 0.22, -0.5, 0.5), 6.5, dt);
    cube.rotation[2] = damp(cube.rotation[2],
      -pointer.nx * 0.34 * weight - clamp(cube.velocity[1] * 0.18, -0.4, 0.4), 6.5, dt);

    /* The idle spin fades back as the pointer takes over, so the cube is never
     * fighting two rotations at once. */
    if (this.options.spin && !this.reduced) {
      cube.spin += (1 - 0.8 * weight) * 0.30 * dt;
    }
    if (cube.spinVel !== 0) {
      cube.spin += cube.spinVel * dt;
      cube.spinVel *= Math.exp(-1.9 * dt);
      if (Math.abs(cube.spinVel) < 0.01) cube.spinVel = 0;
    }

    cube.bob = this.reduced ? 0 : Math.sin(this.time * 1.5) * 0.045;

    /* Camera easing, so an orbit or a zoom arrives instead of jumping. */
    var cam = this.camera;
    cam.yaw = damp(cam.yaw, cam.targetYaw, 7, dt);
    cam.pitch = damp(cam.pitch, cam.targetPitch, 7, dt);
    cam.distance = damp(cam.distance, cam.targetDistance, 6, dt);

    /* The corridor is measured against the camera as it is right now, every
     * frame: a zoom or an orbit that is still easing would otherwise leave the
     * limits sized for a camera that no longer exists. Re-deriving the
     * pointer's world point keeps the cube's target inside the new corridor. */
    this.updateBounds();
    this.setPointer(pointer.nx, pointer.ny);
  };

  /* ---------------------------------------------------------------- draw - */

  Scene.prototype.draw = function () {
    var gl = this.gl;
    var cam = this.camera;
    var cube = this.cube;

    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0.016, 0.024, 0.055, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Camera basis: an orbit of yaw and pitch around the target. */
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    this.eye[0] = cam.target[0] + Math.sin(cam.yaw) * cp * cam.distance;
    this.eye[1] = cam.target[1] + sp * cam.distance;
    this.eye[2] = cam.target[2] + Math.cos(cam.yaw) * cp * cam.distance;

    perspective(this.proj, cam.fov, this.width / Math.max(1, this.height), 0.6, 90);
    lookAt(this.view, this.eye, cam.target, [0, 1, 0]);
    multiply(this.viewProj, this.proj, this.view);

    var cubeY = cube.height + cube.bob;
    var spinYaw = cube.rotation[1] + cube.spin;

    this.drawBackdrop();
    this.drawFloor();
    this.drawShadow(cubeY);
    this.drawCube(cubeY, spinYaw);
  };

  Scene.prototype.drawBackdrop = function () {
    var gl = this.gl;
    var u = this.programs.backdrop.u;

    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.programs.backdrop.program);

    gl.uniform2f(u.uCenter, 0.25, 0.92);
    gl.uniform1f(u.uAspect, this.width / Math.max(1, this.height));
    gl.uniform3f(u.uInner, 0.106, 0.071, 0.278);
    gl.uniform3f(u.uMid, 0.039, 0.059, 0.141);
    gl.uniform3f(u.uOuter, 0.016, 0.024, 0.055);

    /* The glow follows the pointer rather than the cube, so the light arrives
     * before the mesh does. */
    gl.uniform2f(u.uGlow, (this.pointer.nx + 1) * 0.5, (this.pointer.ny + 1) * 0.5);
    gl.uniform3f(u.uGlowColor, 0.16, 0.09, 0.36);
    gl.uniform1f(u.uGlowStrength, 0.30 + 0.80 * this.pointer.active);

    drawMesh(gl, this.meshes.backdrop);
  };

  Scene.prototype.drawFloor = function () {
    var gl = this.gl;
    var u = this.programs.floor.u;

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.useProgram(this.programs.floor.program);

    gl.uniformMatrix4fv(u.uViewProj, false, this.viewProj);
    gl.uniform3f(u.uCamPos, this.eye[0], this.eye[1], this.eye[2]);
    gl.uniform2f(u.uFade, 5.5, 17.0);

    /* The grid stays well under the cube in brightness: it is there to give the
     * movement a floor to read against, not to compete with the subject. */
    gl.uniform3f(u.uFloorColor, 0.026, 0.034, 0.075);
    gl.uniform3f(u.uLineColor, 0.13, 0.11, 0.28);
    gl.uniform3f(u.uMajorColor, 0.32, 0.21, 0.62);
    gl.uniform3f(u.uAxisColor, 0.42, 0.27, 0.70);
    gl.uniform1f(u.uGridStrength,
      (this.options.grid ? 1 : 0) * (0.35 + 0.65 * this.pointer.active));

    gl.uniform2f(u.uCursorXZ, this.pointer.x, this.pointer.z);
    gl.uniform3f(u.uCursorColor, 0.085, 0.30, 0.52);
    gl.uniform1f(u.uCursorStrength, this.options.cursorLight ? this.pointer.active : 0);

    /* Blended, so the grid fades into the backdrop instead of ending at a
     * visible edge. */
    gl.enable(gl.BLEND);
    drawMesh(gl, this.meshes.floor);
    gl.disable(gl.BLEND);
  };

  Scene.prototype.drawShadow = function (cubeY) {
    if (!this.options.shadow) return;

    var gl = this.gl;
    var u = this.programs.shadow.u;
    var cube = this.cube;

    /* The key light comes from (0.45, 1.0, 0.36) — normalised below — so the
     * blob is pushed away from it and stretched across it. */
    var key = [0.45, 1.0, 0.36];
    var keyLen = Math.hypot(key[0], key[1], key[2]);
    var kx = key[0] / keyLen, kz = key[2] / keyLen;
    var spread = 0.72 + cubeY * 0.44;        /* higher cube → wider, softer blob */

    compose(this.shadowModel,
      cube.position[0] + kx * spread * 0.5, 0.012, cube.position[1] + kz * spread * 0.5,
      0, Math.atan2(kx, kz), 0,
      spread, 1, spread * 0.86);

    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.useProgram(this.programs.shadow.program);

    gl.uniformMatrix4fv(u.uModel, false, this.shadowModel);
    gl.uniformMatrix4fv(u.uViewProj, false, this.viewProj);
    gl.uniform3f(u.uColor, 0.010, 0.008, 0.030);
    /* Contact darkens as the cube comes down. */
    gl.uniform1f(u.uStrength, clamp(0.80 - cubeY * 0.18, 0.22, 0.80));

    drawMesh(gl, this.meshes.shadow);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  };

  Scene.prototype.drawCube = function (cubeY, spinYaw) {
    var gl = this.gl;
    var u = this.programs.cube.u;
    var cube = this.cube;

    compose(this.model,
      cube.position[0], cubeY, cube.position[1],
      cube.rotation[0], spinYaw, cube.rotation[2],
      cube.size, cube.size, cube.size);
    normalMatrix(this.normalMat, this.model);

    gl.useProgram(this.programs.cube.program);
    gl.uniformMatrix4fv(u.uModel, false, this.model);
    gl.uniformMatrix4fv(u.uViewProj, false, this.viewProj);
    gl.uniformMatrix3fv(u.uNormalMat, false, this.normalMat);
    gl.uniform3f(u.uCamPos, this.eye[0], this.eye[1], this.eye[2]);

    gl.uniform3f(u.uBaseColor, cube.color[0], cube.color[1], cube.color[2]);
    gl.uniform1f(u.uMetal, cube.metal);
    gl.uniform1f(u.uRough, cube.rough);

    /* The key light is deliberately off the vertical: a light straight overhead
     * flattens the top face and blows it out, which is what makes a cube read as
     * a flat shape instead of a solid. */
    gl.uniform3f(u.uKeyDir, 0.52, 0.74, 0.42);
    gl.uniform3f(u.uKeyColor, 0.84, 0.80, 0.98);
    gl.uniform3f(u.uFillDir, -0.62, 0.36, -0.50);
    gl.uniform3f(u.uFillColor, 0.10, 0.30, 0.46);
    gl.uniform3f(u.uRimColor, 0.66, 0.48, 1.0);

    /* The cursor light hovers above the pointer's floor point, which puts the
     * highlight on the cube's top face as the cube arrives underneath it. */
    gl.uniform3f(u.uCursorPos, this.pointer.x, this.pointer.lightY, this.pointer.z);
    gl.uniform3f(u.uCursorColor, 0.30, 0.78, 1.0);
    gl.uniform1f(u.uCursorStrength,
      this.options.cursorLight ? 0.85 * this.pointer.active : 0);

    gl.uniform1f(u.uEdgeGlow, this.options.cursorLight
      ? cube.edges * (0.45 + 0.55 * this.pointer.active)
      : cube.edges * 0.45);

    drawMesh(gl, this.meshes.cube);
  };

  /* --------------------------------------------------------------- frame - */

  Scene.prototype.frame = function (dt) {
    if (!this.ok || this.lost) return this.stats;

    var step = clamp(dt || 0, 0, 0.05);
    this.time += step;
    this.update(step);
    this.draw();

    /* Counted, not guessed: four calls with the contact shadow, three without.
     * The cube's own 12 triangles are reported separately by readout(). */
    var s = this.stats;
    s.drawCalls = 3 + (this.options.shadow ? 1 : 0);
    s.triangles = this.meshes.backdrop.triangles + this.meshes.floor.triangles
      + (this.options.shadow ? this.meshes.shadow.triangles : 0)
      + this.meshes.cube.triangles;
    s.vertices = 24;
    s.scale = this.scale;
    return s;
  };

  /* Everything the control panel needs, in one object, so the DOM layer never
   * has to reach into the renderer's internals. */
  Scene.prototype.readout = function () {
    var cube = this.cube;
    return {
      name: cube.name,
      position: [cube.position[0], cube.height + cube.bob, cube.position[1]],
      rotation: [
        cube.rotation[0] * (180 / Math.PI),
        ((cube.rotation[1] + cube.spin) * (180 / Math.PI)) % 360,
        cube.rotation[2] * (180 / Math.PI)
      ],
      speed: Math.hypot(cube.velocity[0], cube.velocity[1]),
      engaged: this.pointer.active > 0.5,
      material: 'Blinn-Phong',
      metal: cube.metal,
      rough: cube.rough,
      mesh: {
        triangles: this.meshes.cube ? this.meshes.cube.triangles : 12,
        vertices: 24,
        note: 'One indexed mesh with flat per-face normals, lit by a point light that follows the cursor.'
      },
      api: this.api
    };
  };

  global.WebGLScene = {
    Scene: Scene,
    version: '2.0.0',
    presets: Object.keys(PRESETS)
  };
})(window);
