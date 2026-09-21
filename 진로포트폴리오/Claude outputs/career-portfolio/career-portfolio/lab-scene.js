/* ==========================================================================
   lab-scene.js
   ------------------------------------------------------------------------
   Home 화면의 3D "연구실" 씬입니다. 외부 3D 모델(.glb 등)을 쓰지 않고
   Three.js 코드만으로 오브젝트를 만들었습니다 (절차적 모델링) — VS Code에서
   숫자/색상만 바꿔도 형태와 애니메이션이 바로 달라집니다.

   구조:
   1) 초기 설정 (scene / camera / renderer / lights / fog / floor)
   2) 오브젝트 4종 생성 (로봇=내 소개, 플라스크=진로활동, 트로피=주요활동, 모니터=프로젝트)
   3) 중앙 홀로그램 장식
   4) 마우스 인터랙션 (parallax / hover / click → 텍스트 페이드인 패널)
   5) 애니메이션 루프
   ========================================================================== */

import * as THREE from "three";

/* ---------------------------------------------------------------------- */
/* 0. 각 오브젝트가 클릭됐을 때 패널에 보여줄 내용                                */
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
/* 1. 기본 설정                                                              */
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

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (err) {
  renderer = null;
}

if (!renderer || !window.WebGLRenderingContext) {
  stageWrap.classList.add("no-webgl");
} else {
  initLabScene();
}

function initLabScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070d, 0.05);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const basePos = new THREE.Vector3(0, 1.3, 7.6);
  camera.position.copy(basePos);
  camera.lookAt(0, 0.5, 0);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  /* ---------------- lights ---------------- */
  scene.add(new THREE.AmbientLight(0x8892ff, 0.45));

  const keyLight = new THREE.PointLight(0x7c5cff, 3.2, 22);
  keyLight.position.set(3.5, 4.5, 3.5);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0x35f2c4, 2.4, 22);
  rimLight.position.set(-4.5, 3, -2);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(0xff5fd1, 1.1, 18);
  fillLight.position.set(0, 2, 5);
  scene.add(fillLight);

  /* ---------------- floor ---------------- */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x0a0d16, metalness: 0.4, roughness: 0.75 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.6;
  scene.add(floor);

  const grid = new THREE.GridHelper(40, 40, 0x7c5cff, 0x11162a);
  grid.position.y = -1.58;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  scene.add(grid);

  /* ---------------- 떠다니는 랩 파티클 ---------------- */
  const particleCount = 160;
  const particlePos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    particlePos[i * 3] = (Math.random() - 0.5) * 14;
    particlePos[i * 3 + 1] = Math.random() * 5 - 1;
    particlePos[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ color: 0x8fa3ff, size: 0.025, transparent: true, opacity: 0.55 })
  );
  scene.add(particles);

  /* ---------------------------------------------------------------------- */
  /* 2. 오브젝트 만들기 — 각 함수는 THREE.Group을 반환합니다                        */
  /* ---------------------------------------------------------------------- */

  function makeHitbox(radius) {
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
    );
    return hit;
  }

  // ---- 로봇 (내 소개) ----
  function buildRobot() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x342a63, metalness: 0.5, roughness: 0.35 });
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x7c5cff, metalness: 0.6, roughness: 0.25, emissive: 0x2a1c66, emissiveIntensity: 0.5,
    });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x35f2c4, emissive: 0x35f2c4, emissiveIntensity: 1.4 });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.42), shellMat);
    head.position.y = 0.62;
    g.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.055, 12, 12);
    const eyeL = new THREE.Mesh(eyeGeo, glowMat); eyeL.position.set(-0.13, 0.64, 0.21);
    const eyeR = new THREE.Mesh(eyeGeo, glowMat); eyeR.position.set(0.13, 0.64, 0.21);
    g.add(eyeL, eyeR);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), bodyMat);
    antenna.position.y = 0.98;
    g.add(antenna);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), glowMat);
    antennaTip.position.y = 1.14;
    g.add(antennaTip);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.6, 0.4), bodyMat);
    torso.position.y = 0.12;
    g.add(torso);

    const chipGeo = new THREE.BoxGeometry(0.3, 0.3, 0.02);
    const chip = new THREE.Mesh(chipGeo, glowMat);
    chip.position.set(0, 0.12, 0.21);
    g.add(chip);

    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8);
    const armL = new THREE.Mesh(armGeo, shellMat); armL.position.set(-0.42, 0.14, 0); armL.rotation.z = 0.25;
    const armR = new THREE.Mesh(armGeo, shellMat); armR.position.set(0.42, 0.14, 0); armR.rotation.z = -0.25;
    g.add(armL, armR);

    const legGeo = new THREE.BoxGeometry(0.16, 0.32, 0.18);
    const legL = new THREE.Mesh(legGeo, bodyMat); legL.position.set(-0.16, -0.32, 0);
    const legR = new THREE.Mesh(legGeo, bodyMat); legR.position.set(0.16, -0.32, 0);
    g.add(legL, legR);

    const hit = makeHitbox(0.85);
    hit.position.y = 0.2;
    hit.userData.id = "robot";
    g.add(hit);
    g.userData.hit = hit;
    g.userData.glowParts = [eyeL, eyeR, antennaTip, chip];
    return g;
  }

  // ---- 플라스크 (진로활동) ----
  function buildFlask() {
    const g = new THREE.Group();
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x35f2c4, transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0, transmission: 0.4,
    });
    const liquidMat = new THREE.MeshStandardMaterial({ color: 0xff5fd1, emissive: 0xff5fd1, emissiveIntensity: 0.9 });
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1c2038, metalness: 0.6, roughness: 0.4 });

    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.08, 20), standMat);
    stand.position.y = -0.55;
    g.add(stand);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 16), glassMat);
    neck.position.y = 0.05;
    g.add(neck);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 20), glassMat);
    body.position.y = -0.32;
    body.scale.y = 0.9;
    g.add(body);

    const liquid = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), liquidMat);
    liquid.position.y = -0.4;
    liquid.scale.y = 0.7;
    g.add(liquid);

    // 기포 파티클
    const bubbleGeo = new THREE.BufferGeometry();
    const bubbleCount = 14;
    const bubblePos = new Float32Array(bubbleCount * 3);
    for (let i = 0; i < bubbleCount; i++) {
      bubblePos[i * 3] = (Math.random() - 0.5) * 0.3;
      bubblePos[i * 3 + 1] = Math.random() * 0.5 - 0.5;
      bubblePos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    bubbleGeo.setAttribute("position", new THREE.BufferAttribute(bubblePos, 3));
    const bubbles = new THREE.Points(
      bubbleGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.8 })
    );
    g.add(bubbles);
    g.userData.bubbles = bubbles;

    const flaskLight = new THREE.PointLight(0xff5fd1, 0.8, 3);
    flaskLight.position.y = -0.35;
    g.add(flaskLight);

    const hit = makeHitbox(0.6);
    hit.userData.id = "flask";
    g.add(hit);
    g.userData.hit = hit;
    g.userData.glowParts = [liquid];
    return g;
  }

  // ---- 트로피 (주요 활동) ----
  function buildTrophy() {
    const g = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd166, metalness: 0.85, roughness: 0.25, emissive: 0x664400, emissiveIntensity: 0.3,
    });
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1c2038, metalness: 0.6, roughness: 0.4 });
    const starMat = new THREE.MeshStandardMaterial({ color: 0x35f2c4, emissive: 0x35f2c4, emissiveIntensity: 1.2 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.1, 20), standMat);
    base.position.y = -0.58;
    g.add(base);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.28, 12), goldMat);
    stem.position.y = -0.4;
    g.add(stem);

    const cupBottom = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.22, 20, 1, true), goldMat);
    cupBottom.position.y = -0.17;
    g.add(cupBottom);

    const cupTop = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 20, 0, Math.PI * 2, 0, Math.PI / 1.7), goldMat);
    cupTop.position.y = 0.05;
    g.add(cupTop);

    const handleGeo = new THREE.TorusGeometry(0.13, 0.02, 8, 20, Math.PI);
    const handleL = new THREE.Mesh(handleGeo, goldMat);
    handleL.position.set(-0.24, 0.02, 0);
    handleL.rotation.z = Math.PI / 2;
    const handleR = handleL.clone();
    handleR.position.x = 0.24;
    handleR.rotation.z = -Math.PI / 2;
    g.add(handleL, handleR);

    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), starMat);
    star.position.y = 0.55;
    g.add(star);
    g.userData.star = star;

    const hit = makeHitbox(0.65);
    hit.position.y = -0.05;
    hit.userData.id = "trophy";
    g.add(hit);
    g.userData.hit = hit;
    g.userData.glowParts = [star];
    return g;
  }

  // ---- 모니터 (프로젝트) : 캔버스 텍스처로 "코드 화면" 느낌 ----
  function buildScreenTexture() {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 160;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0a0d1a";
    ctx.fillRect(0, 0, c.width, c.height);
    const colors = ["#7c5cff", "#35f2c4", "#ff5fd1", "#4d5a9e"];
    let y = 14;
    while (y < c.height - 10) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      const w = 30 + Math.random() * 160;
      const indent = Math.random() < 0.3 ? 30 : Math.random() < 0.5 ? 15 : 0;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(14 + indent, y, w, 6);
      y += 14;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function buildMonitor() {
    const g = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x141a2e, metalness: 0.5, roughness: 0.5 });
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1c2038, metalness: 0.6, roughness: 0.4 });

    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.6, 0.05), frameMat);
    g.add(screenFrame);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 0.5),
      new THREE.MeshBasicMaterial({ map: buildScreenTexture() })
    );
    screen.position.z = 0.03;
    g.add(screen);
    g.userData.screen = screen;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 10), standMat);
    neck.position.y = -0.44;
    g.add(neck);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 20), standMat);
    base.position.y = -0.58;
    g.add(base);

    const screenLight = new THREE.PointLight(0x35f2c4, 1.1, 2.2);
    screenLight.position.z = 0.4;
    g.add(screenLight);

    const hit = makeHitbox(0.65);
    hit.userData.id = "monitor";
    g.add(hit);
    g.userData.hit = hit;
    g.userData.glowParts = [];
    return g;
  }

  // ---- 중앙 홀로그램 장식 (클릭 대상 아님) ----
  function buildHologram() {
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshBasicMaterial({ color: 0x9db4ff, wireframe: true, transparent: true, opacity: 0.6 })
    );
    g.add(core);
    g.userData.core = core;

    const ringColors = [0x7c5cff, 0x35f2c4, 0xff5fd1];
    const rings = ringColors.map((color, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.7 + i * 0.16, 0.012, 8, 80),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 })
      );
      ring.rotation.x = Math.PI / 2.4 + i * 0.35;
      ring.rotation.y = i * 0.6;
      g.add(ring);
      return ring;
    });
    g.userData.rings = rings;
    return g;
  }

  /* --------------- 배치 --------------- */
  const robot = buildRobot();
  robot.position.set(-3.1, -0.55, 0.4);
  scene.add(robot);

  const flask = buildFlask();
  flask.position.set(-1.15, -0.6, -1.1);
  scene.add(flask);

  const trophy = buildTrophy();
  trophy.position.set(1.25, -0.55, -1.1);
  scene.add(trophy);

  const monitor = buildMonitor();
  monitor.position.set(3.15, -0.35, 0.3);
  monitor.rotation.y = -0.35;
  scene.add(monitor);

  const hologram = buildHologram();
  hologram.position.set(0, 1.35, -2.4);
  scene.add(hologram);

  const clickable = [robot, flask, trophy, monitor];
  const raycastTargets = clickable.map((g) => g.userData.hit);

  /* ---------------------------------------------------------------------- */
  /* 4. 마우스 / 터치 인터랙션                                                    */
  /* ---------------------------------------------------------------------- */
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2(0, 0);
  const targetOffset = new THREE.Vector2(0, 0); // parallax 목표값
  let hovered = null;

  function updatePointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    targetOffset.set(mouseNDC.x, mouseNDC.y);
  }

  function findHit() {
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(raycastTargets, false);
    return hits.length ? hits[0].object.userData.id : null;
  }

  function setHovered(id) {
    if (hovered === id) return;
    hovered = id;
    canvas.classList.toggle("is-hovering", !!id);
  }

  canvas.addEventListener("pointermove", (e) => {
    updatePointer(e.clientX, e.clientY);
    if (!reduceMotion) setHovered(findHit());
  });

  canvas.addEventListener("pointerleave", () => {
    targetOffset.set(0, 0);
    setHovered(null);
  });

  canvas.addEventListener("click", (e) => {
    updatePointer(e.clientX, e.clientY);
    const id = findHit();
    if (id) {
      showPanel(id);
    } else {
      hidePanel();
    }
  });

  /* ---- 클릭 → 글자가 투명에서 서서히 나타나는 패널 ---- */
  function showPanel(id) {
    const data = OBJECT_DATA[id];
    if (!data) return;

    panelTag.textContent = data.tag;
    panelTitle.textContent = data.title;
    panelLink.href = data.href;

    panelDesc.classList.remove("revealed");
    panelDesc.innerHTML = "";
    [...data.desc].forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "ch";
      span.textContent = ch === " " ? " " : ch;
      span.style.transitionDelay = `${i * 16}ms`;
      panelDesc.appendChild(span);
    });

    panel.classList.add("visible");
    // 두 프레임 뒤에 revealed를 켜야 transition이 확실히 재생됩니다.
    requestAnimationFrame(() => requestAnimationFrame(() => panelDesc.classList.add("revealed")));
  }

  function hidePanel() {
    panel.classList.remove("visible");
  }

  panelClose.addEventListener("click", hidePanel);

  /* ---------------------------------------------------------------------- */
  /* 5. 리사이즈 & 애니메이션 루프                                                 */
  /* ---------------------------------------------------------------------- */
  function resize() {
    const w = stageWrap.clientWidth;
    const h = stageWrap.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  new ResizeObserver(resize).observe(stageWrap);
  resize();

  const clock = new THREE.Clock();
  const currentOffset = new THREE.Vector2(0, 0);

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // parallax: 카메라가 마우스를 향해 부드럽게 따라감
    currentOffset.lerp(targetOffset, 0.04);
    camera.position.x = basePos.x + currentOffset.x * 0.8;
    camera.position.y = basePos.y + currentOffset.y * 0.4;
    camera.lookAt(-currentOffset.x * 0.6, 0.5 - currentOffset.y * 0.2, 0);

    // 각 오브젝트 둥실둥실 애니메이션
    [robot, flask, trophy, monitor].forEach((g, i) => {
      g.position.y = g.userData.baseY ?? (g.userData.baseY = g.position.y);
      g.position.y += Math.sin(t * 1.1 + i * 1.7) * 0.06;
      g.rotation.y += 0.0022;

      const isHover = hovered === g.userData.hit.userData.id;
      const targetScale = isHover ? 1.12 : 1;
      g.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);

      (g.userData.glowParts || []).forEach((mesh) => {
        const base = 1;
        mesh.material.emissiveIntensity = isHover ? base * 1.8 : base;
      });
    });

    // 플라스크 기포 상승
    const bubblePosAttr = flask.userData.bubbles.geometry.attributes.position;
    for (let i = 0; i < bubblePosAttr.count; i++) {
      let y = bubblePosAttr.getY(i) + 0.006;
      if (y > 0.25) y = -0.55;
      bubblePosAttr.setY(i, y);
    }
    bubblePosAttr.needsUpdate = true;

    // 트로피 별 회전
    trophy.userData.star.rotation.y += 0.02;
    trophy.userData.star.rotation.x += 0.01;

    // 홀로그램 회전
    hologram.userData.core.rotation.y += 0.006;
    hologram.userData.core.rotation.x += 0.003;
    hologram.userData.rings.forEach((ring, i) => {
      ring.rotation.z += 0.004 * (i % 2 === 0 ? 1 : -1);
    });

    // 파티클 천천히 부유
    const pPos = particles.geometry.attributes.position;
    for (let i = 0; i < pPos.count; i++) {
      let y = pPos.getY(i) + 0.0025;
      if (y > 4) y = -1.5;
      pPos.setY(i, y);
    }
    pPos.needsUpdate = true;

    renderer.render(scene, camera);
  }

  if (reduceMotion) {
    resize();
    renderer.render(scene, camera);
  } else {
    animate();
  }
}
