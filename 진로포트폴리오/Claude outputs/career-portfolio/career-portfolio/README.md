# 나의 진로포트폴리오 (Digital Career Portfolio Lab)

Home 화면이 3D "연구실" 씬으로 되어 있는 정적 웹사이트입니다.
GitHub Pages로 무료 배포하고, VS Code로 계속 수정해나가면 됩니다.

## 폴더 구성

```
career-portfolio/
├── index.html        Home — 3D 연구실 씬 (로봇/플라스크/트로피/모니터 + 홀로그램)
├── about.html         내 소개 (소개 / 강점 / 가치관)
├── career.html         진로활동 (관심분야 / 관심 진로·학과·전공)
├── activities.html    주요 활동 (교과 / 대회 / 동아리 / 사용 프로그램)
├── projects.html      프로젝트 (독서탐구 / 교과·진로 프로젝트 / 개인 프로젝트)
├── style.css          공통 스타일 (다크 랩 테마)
├── script.js          모바일 메뉴, 현재 페이지 표시
├── lab-scene.js        ★ 3D 씬 전체 (Three.js) — 아래 설명 참고
└── assets/            (필요한 이미지/파일을 여기에 추가)
```

## 3D 연구실 씬 (lab-scene.js) 구조

외부 3D 모델 파일(.glb 등) 없이 **Three.js 코드만으로** 오브젝트를 만들었습니다
(절차적 모델링). 그래서 VS Code에서 숫자·색상만 바꿔도 바로 형태가 달라져요.

| 오브젝트 | 의미하는 메뉴 | 만드는 함수 | 이동하는 페이지 |
|---|---|---|---|
| 🤖 로봇 | 내 소개 | `buildRobot()` | about.html |
| 🧪 플라스크 | 진로활동 | `buildFlask()` | career.html |
| 🏆 트로피 | 주요 활동 | `buildTrophy()` | activities.html |
| 🖥️ 모니터 | 프로젝트 | `buildMonitor()` | projects.html |
| 💠 중앙 홀로그램 | (장식용, 클릭 안 됨) | `buildHologram()` | — |

**동작 방식**
- 마우스를 움직이면 카메라가 살짝 따라오는 패럴랙스 효과가 있습니다.
- 오브젝트에 마우스를 올리면 살짝 커지고 발광이 강해집니다 (호버).
- 오브젝트를 클릭하면 오른쪽 위에 유리판 느낌의 패널이 뜨고, 설명 글자가
  **왼쪽부터 한 글자씩 투명 → 선명**하게 나타납니다. "자세히 보기" 버튼을 누르면
  해당 페이지로 이동합니다.
- 모바일/터치에서도 동일하게 탭으로 클릭 인터랙션이 동작합니다.
- WebGL을 지원하지 않는 브라우저에서는 자동으로 안내 문구(`lab-fallback`)가
  나오고, 아래 5개 카드형 메뉴(`quick-links`)로 동일하게 이동할 수 있습니다.

**자주 수정하게 될 부분**
- 오브젝트 위치: 파일 하단의 `robot.position.set(x, y, z)` 등
- 색상: 각 `build...()` 함수 안 `new THREE.MeshStandardMaterial({ color: 0x7c5cff, ... })`
- 클릭 시 나오는 문구: 파일 맨 위 `OBJECT_DATA` 객체 (tag / title / desc / href)
- 둥실거리는 속도/폭: `animate()` 안의 `Math.sin(t * 1.1 + i * 1.7) * 0.06`
- 파티클(먼지) 개수: `particleCount` 변수

**중요 — 인터넷 연결이 필요합니다.** `index.html`은 Three.js 라이브러리를
`https://cdn.jsdelivr.net`에서 불러옵니다(“importmap” 부분). 인터넷이 되는
곳에서는 문제없지만, 학교 네트워크에서 해당 CDN이 막혀있다면 화면이 비어
보일 수 있어요. 그럴 땐 VS Code에서 아래 "라이브러리를 폴더 안에 내려받기"
방법으로 바꿔주세요.

### 라이브러리를 폴더 안에 내려받기 (선택, CDN이 막힐 때)

1. https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js 접속 →
   전체 내용 복사 → `assets/vendor/three.module.js` 로 저장
2. `index.html`의 importmap 부분을 아래처럼 수정:
   ```html
   <script type="importmap">
   { "imports": { "three": "./assets/vendor/three.module.js" } }
   </script>
   ```

## 배포 방법 (GitHub Pages)

1. **GitHub 계정 만들기** — github.com 에서 가입 (이미 있다면 생략)
2. **새 저장소(repository) 생성**
   - github.com 우측 상단 `+` → `New repository`
   - Repository name: `career-portfolio` (원하는 이름으로 변경 가능)
   - Public 선택 → `Create repository`
3. **VS Code에서 이 폴더 열기**
   - VS Code 실행 → `File > Open Folder` → `career-portfolio` 폴더 선택
4. **GitHub에 업로드 (터미널에서)**
   ```bash
   cd career-portfolio
   git init
   git add .
   git commit -m "진로포트폴리오 초안"
   git branch -M main
   git remote add origin https://github.com/내계정이름/career-portfolio.git
   git push -u origin main
   ```
   (VS Code 왼쪽의 `Source Control` 아이콘으로도 동일한 작업을 GUI로 할 수 있어요.)
5. **GitHub Pages 켜기**
   - 방금 만든 저장소 페이지 → `Settings` → 왼쪽 메뉴 `Pages`
   - `Branch`를 `main`, 폴더는 `/ (root)`로 선택 → `Save`
   - 1~2분 후 `https://내계정이름.github.io/career-portfolio/` 링크가 생성됩니다.
6. 이 링크를 학습지 제출용 공유 링크로 사용하면 됩니다.

## 내용 채우는 법

각 HTML 파일 안의 점선 박스(placeholder)로 표시된 부분을 실제 내용으로 바꾸면 됩니다.
VS Code에서 파일을 열고 `<p class="placeholder">...</p>` 부분의 문구를 지우고
본인의 글로 바꿔주세요.

수정할 때마다 아래 명령으로 GitHub에 다시 올리면 사이트에 바로 반영됩니다.
```bash
git add .
git commit -m "내용 업데이트"
git push
```

## 로컬에서 미리보기

`lab-scene.js`는 ES 모듈(`type="module"`)이라 `file://`로 직접 열면 브라우저
보안 정책 때문에 3D 씬이 안 뜰 수 있습니다. 반드시 로컬 서버로 열어주세요.

- VS Code 확장 프로그램 `Live Server` 설치 → `index.html` 우클릭 →
  `Open with Live Server`
- 또는 터미널에서: `python -m http.server 5500` 실행 후
  `http://localhost:5500` 접속
