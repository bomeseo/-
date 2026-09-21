/* ==========================================================================
   lab-scene.js — 순수 WebGL로 직접 만든 "연구실" 3D 씬 (외부 라이브러리 없음)
   ------------------------------------------------------------------------
   이전 버전은 three.js를 CDN에서 불러왔는데, 네트워크/파일 열기 방식에 따라
   화면이 안 뜨는 문제가 있었습니다. 이번 버전은 어떤 외부 파일도 불러오지
   않는 일반 스크립트(type="module" 아님)라서, 인터넷 연결 없이도, file://로
   직접 열어도 동작합니다. (단, 로컬 서버로 여는 걸 그래도 권장합니다 —
   README 참고)

   구조
   1) 아주 작은 행렬/벡터 유틸
   2) 도형 생성 함수 (박스/구/원기둥/원환/정팔면체)
   3) WebGL 셰이더 + 렌더러 초기화
   4) 오브젝트(로봇/플라스크/트로피/모니터/홀로그램) 조립
   5) 마우스 패럴랙스 / 호버 / 클릭 → 텍스트 페이드인 패널
   6) 애니메이션 루프
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------- */
  /* 0. 클릭했을 때 패널에 보여줄 내용                                             */
  /* ---------------------------------------------------------------------- */
  const OBJECT_DATA = {
    robot: {
      tag: "02. ABOUT ME",
      title: "내 소개",
      desc: "나를 소개하는 글과 강점, 가치관을 정리한 공간이에요. 클릭해서 자세히 확인해보세요.",
      href: "about.html",
    },
    flask: {
      tag: "03. CAREER ACTIVITY",
      title: "진로활동",
      desc: "관심 분야와 희망 진로 · 학과를 실험하듯 기록해두는 공간이에요.",
      href: "career.html",
    },
    trophy: {
      tag: "04. MAIN ACTIVITIES",
      title: "주요 활동",
      desc: "교과, 대회, 동아리 활동과 그동안 쌓은 스킬을 모아뒀어요.",
      href: "activities.html",
    },
    monitor: {
      tag: "05. PROJECTS",
      title: "프로젝트",
      desc: "직접 만든 결과물과 보고서, 프로젝트 기록을 볼 수 있어요.",
      href: "projects.html",
    },
  };

  /* ---------------------------------------------------------------------- */
  /* 1. 행렬 / 벡터 유틸 (column-major, WebGL 표준 방식)                          */
  /* ---------------------------------------------------------------------- */
  function m4identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  function m4multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
        out[c * 4 + r] = sum;
      }
    }
    return out;
  }
  function m4translate(x, y, z) {
    const m = m4identity();
    m[12] = x; m[13] = y; m[14] = z;
    return m;
  }
  function m4rotY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = m4identity();
    m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
    return m;
  }
  function m4rotX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = m4identity();
    m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
    return m;
  }
  function m4rotZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = m4identity();
    m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
    return m;
  }
  function m4scale(x, y, z) {
    const m = m4identity();
    m[0] = x; m[5] = y; m[10] = z;
    return m;
  }
  function m4perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const out = new Float32Array(16);
    out[0] = f / aspect; out[5] = f;
    out[10] = (far + near) / (near - far); out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    return out;
  }
  function m4lookAt(eye, target, up) {
    let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
    let zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    let xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
    let yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    const out = new Float32Array(16);
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }
  // 위치 + 회전(Y,X,Z) + 스케일을 하나의 모델 행렬로 합성
  function composeModel(p, rotY, rotX, rotZ, s) {
    let m = m4translate(p[0], p[1], p[2]);
    if (rotY) m = m4multiply(m, m4rotY(rotY));
    if (rotX) m = m4multiply(m, m4rotX(rotX));
    if (rotZ) m = m4multiply(m, m4rotZ(rotZ));
    m = m4multiply(m, m4scale(s[0], s[1], s[2]));
    return m;
  }
  function vlerp(a, b, t) { return a + (b - a) * t; }

  /* ---------------------------------------------------------------------- */
  /* 2. 도형(geometry) 생성 함수들 — 모두 {positions, normals, indices} 반환      */
  /* ---------------------------------------------------------------------- */
  function buildBox(w, h, d) {
    const x = w / 2, y = h / 2, z = d / 2;
    const faces = [
      { n: [0, 0, 1], v: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]] },
      { n: [0, 0, -1], v: [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]] },
      { n: [0, 1, 0], v: [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]] },
      { n: [0, -1, 0], v: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]] },
      { n: [1, 0, 0], v: [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]] },
      { n: [-1, 0, 0], v: [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]] },
    ];
    const positions = [], normals = [], indices = [];
    faces.forEach((f, fi) => {
      const base = fi * 4;
      f.v.forEach((p) => { positions.push(p[0], p[1], p[2]); normals.push(f.n[0], f.n[1], f.n[2]); });
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
  }

  function buildSphere(radius, wSeg, hSeg, thetaLength) {
    thetaLength = thetaLength || Math.PI;
    const positions = [], normals = [], indices = [];
    for (let y = 0; y <= hSeg; y++) {
      const v = y / hSeg, theta = v * thetaLength;
      for (let x = 0; x <= wSeg; x++) {
        const u = x / wSeg, phi = u * Math.PI * 2;
        const px = -radius * Math.cos(phi) * Math.sin(theta);
        const py = radius * Math.cos(theta);
        const pz = radius * Math.sin(phi) * Math.sin(theta);
        positions.push(px, py, pz);
        const l = Math.hypot(px, py, pz) || 1;
        normals.push(px / l, py / l, pz / l);
      }
    }
    for (let y = 0; y < hSeg; y++) {
      for (let x = 0; x < wSeg; x++) {
        const a = y * (wSeg + 1) + x, b = a + wSeg + 1, c = a + 1, d = b + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
  }

  function buildCylinder(radiusTop, radiusBottom, height, seg, openEnded) {
    const positions = [], normals = [], indices = [];
    const halfH = height / 2;
    const slope = (radiusBottom - radiusTop) / height;
    for (let y = 0; y <= 1; y++) {
      const radius = y === 0 ? radiusTop : radiusBottom;
      const py = y === 0 ? halfH : -halfH;
      for (let x = 0; x <= seg; x++) {
        const theta = (x / seg) * Math.PI * 2;
        const sinT = Math.sin(theta), cosT = Math.cos(theta);
        positions.push(radius * sinT, py, radius * cosT);
        const nl = Math.hypot(sinT, slope, cosT) || 1;
        normals.push(sinT / nl, slope / nl, cosT / nl);
      }
    }
    const rowLen = seg + 1;
    for (let x = 0; x < seg; x++) {
      const a = x, b = x + rowLen, c = x + 1, d = x + 1 + rowLen;
      indices.push(a, b, c, b, d, c);
    }
    function addCap(radius, py, top) {
      if (radius <= 0.0001) return;
      const centerIndex = positions.length / 3;
      positions.push(0, py, 0); normals.push(0, top ? 1 : -1, 0);
      const startIndex = positions.length / 3;
      for (let x = 0; x <= seg; x++) {
        const theta = (x / seg) * Math.PI * 2;
        positions.push(radius * Math.sin(theta), py, radius * Math.cos(theta));
        normals.push(0, top ? 1 : -1, 0);
      }
      for (let x = 0; x < seg; x++) {
        if (top) indices.push(centerIndex, startIndex + x, startIndex + x + 1);
        else indices.push(centerIndex, startIndex + x + 1, startIndex + x);
      }
    }
    if (!openEnded) { addCap(radiusTop, halfH, true); addCap(radiusBottom, -halfH, false); }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
  }

  function buildTorus(radius, tube, radialSeg, tubularSeg, arc) {
    arc = arc || Math.PI * 2;
    const positions = [], normals = [], indices = [];
    for (let j = 0; j <= radialSeg; j++) {
      for (let i = 0; i <= tubularSeg; i++) {
        const u = (i / tubularSeg) * arc;
        const v = (j / radialSeg) * Math.PI * 2;
        const cx = radius * Math.cos(u), cz = radius * Math.sin(u);
        const px = (radius + tube * Math.cos(v)) * Math.cos(u);
        const py = tube * Math.sin(v);
        const pz = (radius + tube * Math.cos(v)) * Math.sin(u);
        positions.push(px, py, pz);
        const nx = px - cx, ny = py, nz = pz - cz;
        const nl = Math.hypot(nx, ny, nz) || 1;
        normals.push(nx / nl, ny / nl, nz / nl);
      }
    }
    const rowLen = tubularSeg + 1;
    for (let j = 0; j < radialSeg; j++) {
      for (let i = 0; i < tubularSeg; i++) {
        const a = j * rowLen + i, b = a + rowLen, c = a + 1, d = b + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
  }

  function buildOctahedron(radius) {
    const v = [[radius, 0, 0], [-radius, 0, 0], [0, radius, 0], [0, -radius, 0], [0, 0, radius], [0, 0, -radius]];
    const faces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
    const positions = [], normals = [], indices = [];
    faces.forEach((f) => {
      const a = v[f[0]], b = v[f[1]], c = v[f[2]];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const base = positions.length / 3;
      [a, b, c].forEach((p) => { positions.push(p[0], p[1], p[2]); normals.push(nx, ny, nz); });
      indices.push(base, base + 1, base + 2);
    });
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
  }

  /* ---------------------------------------------------------------------- */
  /* 3. WebGL 초기화                                                          */
  /* ---------------------------------------------------------------------- */
  const stageWrap = document.getElementById("lab-canvas-wrap");
  const canvas = document.getElementById("lab-canvas");
  const panel = document.getElementById("lab-panel");
  const panelTag = panel.querySelector(".lab-panel-tag");
  const panelTitle = panel.querySelector("h3");
  const panelDesc = panel.querySelector("p");
  const panelLink = panel.querySelector(".lab-panel-link");
  const panelClose = panel.querySelector(".lab-panel-close");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let gl = null;
  try {
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  } catch (e) {
    gl = null;
  }

  if (!gl) {
    stageWrap.classList.add("no-webgl");
    return;
  }

  const VERTEX_SRC =
    "attribute vec3 aPosition;" +
    "attribute vec3 aNormal;" +
    "uniform mat4 uModel;" +
    "uniform mat4 uView;" +
    "uniform mat4 uProjection;" +
    "varying vec3 vNormal;" +
    "varying vec3 vWorldPos;" +
    "void main() {" +
    "  vec4 worldPos = uModel * vec4(aPosition, 1.0);" +
    "  vWorldPos = worldPos.xyz;" +
    "  vNormal = mat3(uModel) * aNormal;" +
    "  gl_Position = uProjection * uView * worldPos;" +
    "}";

  const FRAGMENT_SRC =
    "precision mediump float;" +
    "varying vec3 vNormal;" +
    "varying vec3 vWorldPos;" +
    "uniform vec3 uColor;" +
    "uniform vec3 uEmissive;" +
    "uniform vec3 uCameraPos;" +
    "uniform vec3 uLightPos0;" + "uniform vec3 uLightColor0;" +
    "uniform vec3 uLightPos1;" + "uniform vec3 uLightColor1;" +
    "uniform vec3 uLightPos2;" + "uniform vec3 uLightColor2;" +
    "uniform float uOpacity;" +
    "void main() {" +
    "  vec3 N = normalize(vNormal);" +
    "  vec3 ambient = uColor * 0.38;" +
    "  vec3 diffuse = vec3(0.0);" +
    "  vec3 lp[3]; lp[0]=uLightPos0; lp[1]=uLightPos1; lp[2]=uLightPos2;" +
    "  vec3 lc[3]; lc[0]=uLightColor0; lc[1]=uLightColor1; lc[2]=uLightColor2;" +
    "  for (int i = 0; i < 3; i++) {" +
    "    vec3 L = lp[i] - vWorldPos;" +
    "    float dist = length(L);" +
    "    L = normalize(L);" +
    "    float diff = max(dot(N, L), 0.0);" +
    "    float atten = 1.0 / (1.0 + 0.06 * dist + 0.015 * dist * dist);" +
    "    diffuse += uColor * lc[i] * diff * atten;" +
    "  }" +
    "  vec3 V = normalize(uCameraPos - vWorldPos);" +
    "  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);" +
    "  vec3 rim = uColor * fres * 0.3;" +
    "  vec3 color = ambient + diffuse + uEmissive + rim;" +
    "  gl_FragColor = vec4(color, uOpacity);" +
    "}";

  function compileShader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(sh));
    }
    return sh;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, VERTEX_SRC));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SRC));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  const attribs = {
    position: gl.getAttribLocation(program, "aPosition"),
    normal: gl.getAttribLocation(program, "aNormal"),
  };
  const uniforms = {};
  ["uModel", "uView", "uProjection", "uColor", "uEmissive", "uCameraPos", "uOpacity",
    "uLightPos0", "uLightColor0", "uLightPos1", "uLightColor1", "uLightPos2", "uLightColor2"
  ].forEach((name) => { uniforms[name] = gl.getUniformLocation(program, name); });

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.012, 0.016, 0.039, 1);

  // geometry → GPU 버퍼로 업로드
  function uploadMesh(geo) {
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);

    const normBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);

    return { posBuf, normBuf, idxBuf, count: geo.indices.length };
  }

  // 자주 쓰는 도형은 한 번만 만들어서 재사용
  const MESH = {
    box1: uploadMesh(buildBox(1, 1, 1)),
    sphereFull: uploadMesh(buildSphere(1, 16, 12)),
    sphereDome: uploadMesh(buildSphere(1, 16, 10, Math.PI / 1.7)),
    cylinder: uploadMesh(buildCylinder(1, 1, 1, 20, false)),
    coneOpen: uploadMesh(buildCylinder(0.001, 1, 1, 20, true)),
    torusHalf: uploadMesh(buildTorus(1, 0.16, 8, 20, Math.PI)),
    torusFull: uploadMesh(buildTorus(1, 0.1, 8, 60, Math.PI * 2)),
    octa: uploadMesh(buildOctahedron(1)),
  };

  function drawMesh(mesh, modelMatrix, color, emissive, opacity) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuf);
    gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribs.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuf);
    gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribs.normal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuf);

    gl.uniformMatrix4fv(uniforms.uModel, false, modelMatrix);
    gl.uniform3fv(uniforms.uColor, color);
    gl.uniform3fv(uniforms.uEmissive, emissive || [0, 0, 0]);
    gl.uniform1f(uniforms.uOpacity, opacity === undefined ? 1 : opacity);

    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  function drawLines(mesh, modelMatrix, color) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuf);
    gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribs.position);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuf);
    gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribs.normal);
    gl.uniformMatrix4fv(uniforms.uModel, false, modelMatrix);
    gl.uniform3fv(uniforms.uColor, [0, 0, 0]);
    gl.uniform3fv(uniforms.uEmissive, color);
    gl.uniform1f(uniforms.uOpacity, 1);
    gl.drawArrays(gl.LINES, 0, mesh.vertCount);
  }

  // 바닥 그리드 (GL_LINES) — 조명 영향 없이 은은하게 발광만
  function buildGridLines(size, divisions) {
    const step = size / divisions, half = size / 2;
    const positions = [], normals = [];
    for (let i = 0; i <= divisions; i++) {
      const p = -half + i * step;
      positions.push(-half, 0, p, half, 0, p);
      positions.push(p, 0, -half, p, 0, half);
      for (let k = 0; k < 4; k++) normals.push(0, 0, 0);
    }
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    const normBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    return { posBuf, normBuf, vertCount: positions.length / 3 };
  }
  const gridMesh = buildGridLines(30, 15);

  /* ---------------------------------------------------------------------- */
  /* 4. 색상 팔레트 + 오브젝트 조립                                               */
  /* ---------------------------------------------------------------------- */
  const COLOR = {
    primary: [0.486, 0.361, 1.0],
    shell: [0.44, 0.35, 0.86],
    darkPurple: [0.204, 0.165, 0.388],
    accent: [0.208, 0.949, 0.769],
    magenta: [1.0, 0.373, 0.82],
    gold: [1.0, 0.82, 0.4],
    darkNeutral: [0.11, 0.125, 0.216],
    frameDark: [0.078, 0.102, 0.18],
    floor: [0.04, 0.045, 0.075],
  };

  // 각 그룹은 "부품 목록"으로 구성. 부품 = { mesh, pos, rotY, rotX, rotZ, scale, color, emissive, opacity }
  function robotParts() {
    return [
      { mesh: MESH.box1, pos: [0, 0.62, 0], scale: [0.52, 0.42, 0.42], color: COLOR.shell, emissive: [0.05, 0.03, 0.14] },
      { mesh: MESH.sphereFull, pos: [-0.13, 0.64, 0.21], scale: [0.055, 0.055, 0.055], color: COLOR.accent, emissive: [0.15, 0.7, 0.57] },
      { mesh: MESH.sphereFull, pos: [0.13, 0.64, 0.21], scale: [0.055, 0.055, 0.055], color: COLOR.accent, emissive: [0.15, 0.7, 0.57] },
      { mesh: MESH.cylinder, pos: [0, 0.98, 0], scale: [0.02, 0.28, 0.02], color: COLOR.darkPurple },
      { mesh: MESH.sphereFull, pos: [0, 1.14, 0], scale: [0.06, 0.06, 0.06], color: COLOR.accent, emissive: [0.1, 0.5, 0.4] },
      { mesh: MESH.box1, pos: [0, 0.12, 0], scale: [0.64, 0.6, 0.4], color: COLOR.darkPurple },
      { mesh: MESH.box1, pos: [0, 0.12, 0.21], scale: [0.3, 0.3, 0.02], color: COLOR.accent, emissive: [0.1, 0.45, 0.36] },
      { mesh: MESH.cylinder, pos: [-0.42, 0.14, 0], rotZ: 0.25, scale: [0.06, 0.5, 0.06], color: COLOR.shell },
      { mesh: MESH.cylinder, pos: [0.42, 0.14, 0], rotZ: -0.25, scale: [0.06, 0.5, 0.06], color: COLOR.shell },
      { mesh: MESH.box1, pos: [-0.16, -0.32, 0], scale: [0.16, 0.32, 0.18], color: COLOR.darkPurple },
      { mesh: MESH.box1, pos: [0.16, -0.32, 0], scale: [0.16, 0.32, 0.18], color: COLOR.darkPurple },
    ];
  }

  function flaskParts() {
    return [
      { mesh: MESH.cylinder, pos: [0, -0.55, 0], scale: [0.34, 0.08, 0.34], color: COLOR.darkNeutral },
      { mesh: MESH.cylinder, pos: [0, 0.05, 0], scale: [0.08, 0.4, 0.08], color: COLOR.accent, opacity: 0.35 },
      { mesh: MESH.sphereFull, pos: [0, -0.32, 0], scale: [0.34, 0.31, 0.34], color: COLOR.accent, opacity: 0.32 },
      { mesh: MESH.sphereFull, pos: [0, -0.4, 0], scale: [0.26, 0.18, 0.26], color: COLOR.magenta, emissive: [0.6, 0.16, 0.45] },
    ];
  }

  function trophyParts() {
    return [
      { mesh: MESH.cylinder, pos: [0, -0.58, 0], scale: [0.3, 0.1, 0.3], color: COLOR.darkNeutral },
      { mesh: MESH.cylinder, pos: [0, -0.4, 0], scale: [0.065, 0.28, 0.065], color: COLOR.gold, emissive: [0.15, 0.1, 0.02] },
      { mesh: MESH.coneOpen, pos: [0, -0.17, 0], scale: [0.18, 0.22, 0.18], color: COLOR.gold, emissive: [0.15, 0.1, 0.02] },
      { mesh: MESH.sphereDome, pos: [0, 0.05, 0], scale: [0.26, 0.26, 0.26], color: COLOR.gold, emissive: [0.15, 0.1, 0.02] },
      { mesh: MESH.torusHalf, pos: [-0.24, 0.02, 0], rotZ: Math.PI / 2, scale: [0.13, 0.13, 0.13], color: COLOR.gold },
      { mesh: MESH.torusHalf, pos: [0.24, 0.02, 0], rotZ: -Math.PI / 2, scale: [0.13, 0.13, 0.13], color: COLOR.gold },
    ];
  }

  function monitorParts() {
    const lines = [];
    const lineColors = [COLOR.primary, COLOR.accent, COLOR.magenta, COLOR.shell];
    const widths = [0.5, 0.32, 0.62, 0.4, 0.55, 0.28, 0.46];
    let y = 0.19;
    widths.forEach((w, i) => {
      lines.push({
        mesh: MESH.box1, pos: [-0.4 + w / 2, y, 0.045], scale: [w, 0.03, 0.006],
        color: lineColors[i % lineColors.length], emissive: lineColors[i % lineColors.length].map((c) => c * 0.5),
      });
      y -= 0.065;
    });
    return [
      { mesh: MESH.box1, pos: [0, 0, 0], scale: [0.92, 0.6, 0.05], color: COLOR.frameDark },
      { mesh: MESH.box1, pos: [0, 0, 0.03], scale: [0.82, 0.5, 0.02], color: COLOR.darkNeutral, emissive: [0.03, 0.09, 0.08] },
      ...lines,
      { mesh: MESH.cylinder, pos: [0, -0.44, 0], scale: [0.04, 0.28, 0.04], color: COLOR.darkNeutral },
      { mesh: MESH.cylinder, pos: [0, -0.58, 0], scale: [0.22, 0.05, 0.22], color: COLOR.darkNeutral },
    ];
  }

  const OBJECTS = [
    { id: "robot", parts: robotParts(), basePos: [-3.1, -0.55, 0.4], hitOffset: [0, 0.2, 0], hitRadius: 0.85 },
    { id: "flask", parts: flaskParts(), basePos: [-1.15, -0.6, -1.1], hitOffset: [0, 0, 0], hitRadius: 0.6 },
    { id: "trophy", parts: trophyParts(), basePos: [1.25, -0.55, -1.1], hitOffset: [0, -0.05, 0], hitRadius: 0.65 },
    { id: "monitor", parts: monitorParts(), basePos: [3.15, -0.35, 0.3], baseRotY: -0.35, hitOffset: [0, 0, 0], hitRadius: 0.65 },
  ];

  // 중앙 장식 홀로그램 (클릭 대상 아님)
  const HOLOGRAM_POS = [0, 1.35, -2.4];
  const hologramRings = [
    { radius: 0.7, color: COLOR.primary, tilt: Math.PI / 2.4, spin: 0.55 },
    { radius: 0.86, color: COLOR.accent, tilt: Math.PI / 2.4 + 0.35, spin: -0.4 },
    { radius: 1.02, color: COLOR.magenta, tilt: Math.PI / 2.4 + 0.7, spin: 0.32 },
  ];

  /* ---------------------------------------------------------------------- */
  /* 5. 마우스 / 터치 인터랙션                                                    */
  /* ---------------------------------------------------------------------- */
  let hovered = null;
  const mouseNDC = { x: 0, y: 0 };
  const targetOffset = { x: 0, y: 0 };
  const currentOffset = { x: 0, y: 0 };
  const basePos = [0, 1.3, 7.6];
  const fovY = 45 * (Math.PI / 180);
  let aspect = 1;

  function updatePointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    targetOffset.x = mouseNDC.x;
    targetOffset.y = mouseNDC.y;
  }

  // 카메라 기저벡터로부터 클릭 레이를 만들고, 각 오브젝트의 히트 구와 교차 검사
  function pickObject(eye, forward, right, camUp) {
    const tanF = Math.tan(fovY / 2);
    const dx = mouseNDC.x * tanF * aspect;
    const dy = mouseNDC.y * tanF;
    let dirX = forward[0] + right[0] * dx + camUp[0] * dy;
    let dirY = forward[1] + right[1] * dx + camUp[1] * dy;
    let dirZ = forward[2] + right[2] * dx + camUp[2] * dy;
    const dl = Math.hypot(dirX, dirY, dirZ) || 1;
    dirX /= dl; dirY /= dl; dirZ /= dl;

    let bestId = null, bestT = Infinity;
    for (const obj of OBJECTS) {
      const c = obj._worldHitCenter;
      const ox = c[0] - eye[0], oy = c[1] - eye[1], oz = c[2] - eye[2];
      const b = ox * dirX + oy * dirY + oz * dirZ;
      const cc = ox * ox + oy * oy + oz * oz - obj.hitRadius * obj.hitRadius;
      const disc = b * b - cc;
      if (disc < 0) continue;
      const t = b - Math.sqrt(disc);
      if (t > 0 && t < bestT) { bestT = t; bestId = obj.id; }
    }
    return bestId;
  }

  canvas.addEventListener("pointermove", (e) => { updatePointer(e.clientX, e.clientY); });
  canvas.addEventListener("pointerleave", () => { targetOffset.x = 0; targetOffset.y = 0; });
  canvas.addEventListener("click", (e) => {
    updatePointer(e.clientX, e.clientY);
    const id = lastPickedId;
    if (id) showPanel(id); else hidePanel();
  });

  function showPanel(id) {
    const data = OBJECT_DATA[id];
    if (!data) return;
    panelTag.textContent = data.tag;
    panelTitle.textContent = data.title;
    panelLink.href = data.href;
    panelDesc.classList.remove("revealed");
    panelDesc.innerHTML = "";
    Array.prototype.forEach.call(data.desc, function (ch, i) {
      const span = document.createElement("span");
      span.className = "ch";
      span.textContent = ch;
      span.style.transitionDelay = (i * 16) + "ms";
      panelDesc.appendChild(span);
    });
    panel.classList.add("visible");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { panelDesc.classList.add("revealed"); });
    });
  }
  function hidePanel() { panel.classList.remove("visible"); }
  panelClose.addEventListener("click", hidePanel);

  /* ---------------------------------------------------------------------- */
  /* 6. 리사이즈 + 애니메이션 루프                                                 */
  /* ---------------------------------------------------------------------- */
  function resize() {
    const w = stageWrap.clientWidth, h = stageWrap.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = w / h;
  }
  new ResizeObserver(resize).observe(stageWrap);
  resize();

  const motion = reduceMotion ? 0 : 1;
  const startTime = performance.now();
  let lastPickedId = null;

  function frame() {
    requestAnimationFrame(frame);
    const t = (performance.now() - startTime) / 1000;

    currentOffset.x = vlerp(currentOffset.x, targetOffset.x, 0.04);
    currentOffset.y = vlerp(currentOffset.y, targetOffset.y, 0.04);

    const eye = [basePos[0] + currentOffset.x * 0.8, basePos[1] + currentOffset.y * 0.4, basePos[2]];
    const target = [-currentOffset.x * 0.6, 0.5 - currentOffset.y * 0.2, 0];
    const up = [0, 1, 0];

    const view = m4lookAt(eye, target, up);
    const proj = m4perspective(fovY, aspect, 0.1, 100);

    // 카메라 기저벡터 (피킹용)
    let fx = target[0] - eye[0], fy = target[1] - eye[1], fz = target[2] - eye[2];
    const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    let rx = fy * up[2] - fz * up[1], ry = fz * up[0] - fx * up[2], rz = fx * up[1] - fy * up[0];
    const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    const cux = ry * fz - rz * fy, cuy = rz * fx - rx * fz, cuz = rx * fy - ry * fx;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(uniforms.uView, false, view);
    gl.uniformMatrix4fv(uniforms.uProjection, false, proj);
    gl.uniform3fv(uniforms.uCameraPos, eye);
    gl.uniform3fv(uniforms.uLightPos0, [3.5, 4.5, 3.5]);
    gl.uniform3fv(uniforms.uLightColor0, [0.85, 0.72, 1.25]);
    gl.uniform3fv(uniforms.uLightPos1, [-4.5, 3, -2]);
    gl.uniform3fv(uniforms.uLightColor1, [0.32, 1.05, 0.92]);
    gl.uniform3fv(uniforms.uLightPos2, [0, 2, 5]);
    gl.uniform3fv(uniforms.uLightColor2, [0.55, 0.2, 0.42]);

    // 바닥 + 그리드
    drawMesh(MESH.box1, composeModel([0, -1.63, 0], 0, 0, 0, [30, 0.04, 30]), COLOR.floor, [0, 0, 0], 1);
    drawLines(gridMesh, composeModel([0, -1.6, 0], 0, 0, 0, [1, 1, 1]), [0.13, 0.1, 0.3]);

    // 인터랙션 오브젝트
    OBJECTS.forEach(function (obj, i) {
      const bob = Math.sin(t * 1.1 + i * 1.7) * 0.06 * motion;
      const idleRotY = (obj.baseRotY || 0) + t * 0.0022 * motion;
      const groupPos = [obj.basePos[0], obj.basePos[1] + bob, obj.basePos[2]];

      obj._worldHitCenter = [
        groupPos[0] + obj.hitOffset[0],
        groupPos[1] + obj.hitOffset[1],
        groupPos[2] + obj.hitOffset[2],
      ];

      const isHover = hovered === obj.id;
      const targetScale = isHover ? 1.12 : 1;
      obj._scale = vlerp(obj._scale === undefined ? 1 : obj._scale, targetScale, 0.15);
      const hoverBoost = isHover ? 1.9 : 1;

      const groupMatrix = composeModel(groupPos, idleRotY, 0, 0, [obj._scale, obj._scale, obj._scale]);

      obj.parts.forEach(function (part) {
        const local = composeModel(part.pos, part.rotY || 0, part.rotX || 0, part.rotZ || 0, part.scale);
        const model = m4multiply(groupMatrix, local);
        const emissive = (part.emissive || [0, 0, 0]).map(function (v) { return v * hoverBoost; });
        drawMesh(part.mesh, model, part.color, emissive, part.opacity === undefined ? 1 : part.opacity);
      });
    });

    // 트로피 별(장식) 회전 — trophy 그룹의 마지막 부품 위치에 별도 옥타헤드론 추가로 그려줌
    const trophyObj = OBJECTS[2];
    const starBase = composeModel(
      [trophyObj.basePos[0], trophyObj.basePos[1] + Math.sin(t * 1.1 + 2 * 1.7) * 0.06 * motion + 0.55, trophyObj.basePos[2]],
      t * 1.4 * motion, t * 0.9 * motion, 0, [0.11, 0.11, 0.11]
    );
    drawMesh(MESH.octa, starBase, COLOR.accent, [0.25 * (hovered === "trophy" ? 1.9 : 1), 0.9, 0.75], 1);

    // 중앙 홀로그램
    const coreMatrix = composeModel(HOLOGRAM_POS, t * 0.6 * motion, t * 0.3 * motion, 0, [0.42, 0.42, 0.42]);
    drawMesh(MESH.octa, coreMatrix, [0.62, 0.71, 1.0], [0.2, 0.24, 0.4], 0.55);
    hologramRings.forEach(function (ring) {
      const rm = composeModel(HOLOGRAM_POS, ring.tilt, 0, t * ring.spin * motion, [ring.radius, ring.radius, ring.radius]);
      drawMesh(MESH.torusFull, rm, [0, 0, 0], ring.color, 0.55);
    });

    // 이번 프레임 기준으로 호버/클릭 대상 갱신
    const eyeArr = [eye[0], eye[1], eye[2]];
    const pickedId = pickObject(eyeArr, [fx, fy, fz], [rx, ry, rz], [cux, cuy, cuz]);
    lastPickedId = pickedId;
    if (hovered !== pickedId) {
      hovered = pickedId;
      canvas.classList.toggle("is-hovering", !!hovered);
    }
  }

  requestAnimationFrame(frame);
})();
