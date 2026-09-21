# 나의 진로포트폴리오 (Digital Career Portfolio Lab)

Home 화면이 3D "연구실" 씬으로 되어 있는 정적 웹사이트입니다.
GitHub Pages로 무료 배포하고, VS Code로 계속 수정해나가면 됩니다.

## 폴더 구성

```
career-portfolio/
├── index.html          Home — 3D 연구실 씬 (로봇/플라스크/트로피/모니터 + 홀로그램)
├── about.html          내 소개 (소개 / 강점 / 가치관)
├── career.html         진로활동 (관심분야 / 관심 진로·학과·전공)
├── activities.html     주요 활동 (교과 / 대회 / 동아리 / 사용 프로그램)
├── projects.html       프로젝트 (교과·진로 프로젝트 / 개인 프로젝트)
├── style.css            공통 스타일 (다크 랩 테마)
├── script.js            모바일 메뉴, 현재 페이지 표시
├── lab-scene.js          ★ 3D 씬 전체 (순수 WebGL, 외부 라이브러리 없음) — 아래 설명 참고
└── assets/              (필요한 이미지/파일을 여기에 추가)
```

## 3D 연구실 씬 (lab-scene.js) 구조

외부 라이브러리(Three.js 등)나 3D 모델 파일(.glb 등) 없이, 브라우저에 기본으로
있는 WebGL API만 직접 사용해서 만들었습니다 (절차적 모델링). 그래서 인터넷 연결이
전혀 필요 없고, VS Code에서 숫자·색상만 바꿔도 바로 형태가 달라져요.

| 오브젝트 | 의미하는 메뉴 | 만드는 함수 | 이동하는 페이지 |
|---|---|---|---|
| 🤖 로봇 | 내 소개 | `robotParts()` | about.html |
| 🧪 플라스크 | 진로활동 | `flaskParts()` | career.html |
| 🏆 트로피 | 주요 활동 | `trophyParts()` | activities.html |
| 🖥️ 모니터 | 프로젝트 | `monitorParts()` | projects.html |
| 💠 중앙 홀로그램 | (장식용, 클릭 안 됨) | `hologramRings` / `HOLOGRAM_POS` | — |

**동작 방식**
- 마우스를 움직이면 카메라가 살짝 따라오는 패럴랙스 효과가 있습니다.
- 오브젝트에 마우스를 올리면 살짝 커지고 발광이 강해집니다 (호버).
- 오브젝트를 클릭하면 오른쪽 위에 유리판 느낌의 패널이 뜨고, 설명 글자가
  **왼쪽부터 한 글자씩 투명 → 선명**하게 나타납니다. "자세히 보기" 버튼을 누르면
  해당 페이지로 이동합니다.
- 모바일/터치에서도 동일하게 탭으로 클릭 인터랙션이 동작합니다.
- WebGL을 지원하지 않는 아주 오래된 브라우저에서는 자동으로 안내 문구
  (`lab-fallback`)가 나오고, 아래 5개 카드형 메뉴(`quick-links`)로 동일하게
  이동할 수 있습니다.

**자주 수정하게 될 부분** (모두 `lab-scene.js` 안에 있어요)
- 오브젝트 위치: `OBJECTS` 배열의 `basePos: [x, y, z]`
- 색상: 파일 중간의 `COLOR` 객체, 그리고 각 `...Parts()` 함수 안 `color:` / `emissive:` 값
- 클릭 시 나오는 문구: 파일 맨 위 `OBJECT_DATA` 객체 (tag / title / desc / href)
- 둥실거리는 속도/폭: `frame()` 함수 안의 `Math.sin(t * 1.1 + i * 1.7) * 0.06`
- 새 도형이 필요하면: 이미 있는 `buildBox` / `buildSphere` / `buildCylinder` /
  `buildTorus` / `buildOctahedron` 중 하나를 골라 `...Parts()` 함수 안에 부품으로
  추가하면 됩니다.

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

## 내용 더 다듬는 법

각 HTML 파일에 지금 들어있는 글은 실제 활동 내용을 바탕으로 이미 채워둔
완성본입니다. 나중에 활동이 더 생기거나 표현을 바꾸고 싶으면 VS Code에서
해당 페이지의 `<section>` 안 텍스트만 원하는 대로 고치면 됩니다.

수정할 때마다 아래 명령으로 GitHub에 다시 올리면 사이트에 바로 반영됩니다.
```bash
git add .
git commit -m "내용 업데이트"
git push
```

## 로컬에서 미리보기

`lab-scene.js`는 외부 파일을 전혀 불러오지 않는 일반 스크립트라서, `index.html`을
더블클릭해서 `file://`로 직접 열어도 3D 씬이 그대로 동작합니다. 다만 캐시 문제를
피하고 실제 배포 환경과 가장 비슷하게 확인하려면 로컬 서버로 여는 걸 추천해요.

- VS Code 확장 프로그램 `Live Server` 설치 → `index.html` 우클릭 →
  `Open with Live Server`
- 또는 터미널에서: `python -m http.server 5500` 실행 후
  `http://localhost:5500` 접속
