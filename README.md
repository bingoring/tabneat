# TabNeat 🎨📋

**Smart Tab Organization & New Tab Experience Chrome Extension**

TabNeat은 크롬 브라우저의 탭을 스마트하게 정리하고 그룹핑하는 확장프로그램입니다. 각 사이트의 favicon 색상을 자동으로 추출하여 최적의 색상으로 탭 그룹을 꾸며주며, 동시에 아름다운 새탭 페이지 경험을 제공합니다.

## 다운로드 📦

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/mmcddpjlkgbflhcfchenbjebkbhhfepa?style=for-the-badge&logo=googlechrome&logoColor=white&label=CHROME%20WEB%20STORE)](https://chromewebstore.google.com/detail/tabneat/mmcddpjlkgbflhcfchenbjebkbhhfepa)

**👆 Chrome Web Store에서 바로 설치하기**

🔗 **직접 링크**: [https://chromewebstore.google.com/detail/tabneat/mmcddpjlkgbflhcfchenbjebkbhhfepa](https://chromewebstore.google.com/detail/tabneat/mmcddpjlkgbflhcfchenbjebkbhhfepa)

## 주요 기능 ✨

### 🆕 새탭 페이지 경험
- **사용자 정의 새탭 페이지**: 아름답고 기능적인 새탭 페이지 제공
- **Chrome 테마 완전 통합**: 사용자의 Chrome 테마에 자동으로 맞춰지는 UI
- **다크/라이트 모드 지원**: 시스템 설정과 Chrome 테마에 따른 자동 적응
- **새탭 오버라이드 옵션**: 설정에서 TabNeat 새탭 vs Chrome 기본 새탭 선택 가능

### 🔍 통합 검색 기능
- **Google 검색 통합**: 검색창에서 바로 Google 검색 또는 URL 입력
- **검색 기록**: 이전 검색어 기록 및 자동완성
- **실시간 검색 제안**: 입력하는 동안 검색 제안 표시

### 🌐 바로가기 및 메뉴
- **자주 방문하는 사이트**: Chrome TopSites API 기반 개인화된 바로가기
- **Google Apps 메뉴**: Gmail, Drive, YouTube 등 주요 Google 서비스 빠른 접근
- **파비콘 자동 로드**: 각 사이트의 파비콘으로 시각적 식별성 향상

### 📋 세션 관리
- **Recently Closed Sessions**: 최근 닫힌 탭과 탭 그룹 복원
- **Auto-Saved Sessions**: 자동으로 세션을 저장하고 복원
- **개별/그룹 복원**: 탭 단위 또는 그룹 단위로 선택적 복원 가능

### 🔄 스마트 탭 정렬
- 웹사이트별 자동 그룹핑
- 도메인 기반 탭 조직화
- **다양한 정렬 옵션**: 알파벳순, 최근 방문순, 사용자 지정 순서
- 드래그 앤 드롭으로 도메인 순서 커스터마이징

### 🎨 지능형 색상 추출
- **Favicon 색상 분석**: 각 사이트의 favicon에서 주요 색상을 추출
- **최적 색상 선택**: 추출된 색상 중 가장 적합한 색상을 자동 선택
- **탭 그룹 색상 적용**: 선택된 색상을 탭 그룹에 자동 적용하여 시각적 구분

### 🎨 테마 시스템
- **완전한 테마 적응**: 모든 UI 요소가 Chrome 테마에 맞춰 자동 조정
- **깜빡임 방지**: 페이지 로드 시 흰 화면 깜빡임 완전 제거
- **색상 자동 계산**: 테마 색상 기반으로 최적의 UI 색상 자동 생성

### 📱 사용자 친화적 인터페이스
- 직관적인 팝업 UI
- 간편한 원클릭 정리
- 종합적인 설정 옵션

## 설치 방법 📥

### 🌟 권장 방법: Chrome Web Store에서 설치
1. [Chrome Web Store 링크](https://chromewebstore.google.com/detail/tabneat/mmcddpjlkgbflhcfchenbjebkbhhfepa)를 클릭
2. "Chrome에 추가" 버튼 클릭
3. 확장프로그램 권한 승인
4. 설치 완료! 🎉

### 🔧 개발자 모드로 설치 (개발자용)
1. Chrome 브라우저에서 `chrome://extensions/` 페이지로 이동
2. 오른쪽 상단의 "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 이 프로젝트 폴더 선택

## 권한 설명 🔐

TabNeat이 요청하는 권한들과 사용 목적:

- **tabs**: 탭 정보 읽기 및 그룹핑 기능
- **tabGroups**: 탭 그룹 생성 및 관리
- **storage**: 사용자 설정 및 세션 데이터 저장
- **topSites**: 자주 방문하는 사이트 바로가기 표시
- **offscreen**: 안전한 환경에서 favicon 색상 분석
- **system.display**: 윈도우 리사이징 기능
- **호스트 권한들**: 파비콘 및 검색 제안 API 접근

모든 데이터는 로컬에서만 처리되며 외부 서버로 전송되지 않습니다.

## 사용 방법 🚀

### 탭 정리
1. 확장프로그램 아이콘 클릭
2. "탭 정리" 버튼 클릭으로 자동 그룹핑
3. 설정에서 개인화 옵션 조정

### 새탭 페이지
1. 새 탭을 열면 TabNeat 페이지가 자동으로 로드
2. 검색창에서 Google 검색 또는 URL 입력
3. 바로가기 클릭으로 자주 방문하는 사이트에 빠른 접근
4. 최근 닫힌 세션에서 탭 복원

### 설정
1. 확장프로그램 아이콘 우클릭 > "옵션" 또는 새탭 페이지의 설정 버튼
2. 새탭 오버라이드 on/off 설정
3. 자동 세션 저장 옵션 조정
4. 세션 저장 범위 설정 (현재 창 vs 모든 창)

## 기술 스택 🛠️

- **JavaScript**: 메인 로직 구현
- **Chrome Extension API**: 브라우저 확장 기능
- **HTML/CSS**: 사용자 인터페이스
- **Canvas API**: 이미지 색상 분석
- **Chrome Theme API**: 테마 통합
- **Chrome TopSites API**: 바로가기 사이트
- **Chrome Storage API**: 데이터 저장

## 파일 구조 📂

```
tabneat/
├── manifest.json          # 확장프로그램 설정
├── background.js          # 백그라운드 스크립트 (세션 관리, 자동 저장)
├── popup.html            # 팝업 UI
├── popup.js              # 팝업 로직
├── newtab.html           # 새탭 페이지 UI
├── newtab.js             # 새탭 페이지 로직 (검색, 테마, 세션 복원)
├── options.html          # 설정 페이지
├── options.js            # 설정 로직
├── offscreen.html        # 오프스크린 문서
├── offscreen.js          # 색상 추출 로직
└── icons/               # 확장프로그램 아이콘들
    ├── icon-16.png      # 16x16 아이콘
    ├── icon-32.png      # 32x32 아이콘
    ├── icon-64.png      # 64x64 아이콘
    ├── icon-128.png     # 128x128 아이콘
    ├── icon-*-1.png     # 아이콘 바리에이션들
    └── google/          # Google Apps 아이콘들
```

## 주요 알고리즘 🧠

### 색상 추출 프로세스
1. **Favicon 로드**: 각 탭의 favicon 이미지 획득
2. **Canvas 분석**: 이미지를 canvas에 그려 픽셀 데이터 추출
3. **색상 클러스터링**: 주요 색상들을 그룹화하여 대표 색상 선별
4. **최적 색상 선택**: 명도, 채도, 대비를 고려한 최적 색상 결정
5. **그룹 색상 적용**: Chrome Tab Groups API를 통해 색상 적용

### 테마 적응 시스템
1. **Chrome 테마 감지**: chrome.theme.getCurrent() API로 현재 테마 정보 획득
2. **색상 분석**: 테마 색상의 밝기를 계산하여 다크/라이트 모드 판단
3. **CSS 변수 설정**: 테마에 맞는 색상 팔레트를 CSS 변수로 동적 적용
4. **실시간 적응**: 테마 변경 시 즉시 UI 업데이트

### 세션 관리 시스템
1. **자동 감지**: 탭 닫힘, 그룹 삭제, URL 변경 등을 실시간 감지
2. **지능형 저장**: 중복 제거 및 우선순위 기반 세션 데이터 관리
3. **선택적 복원**: 개별 탭 또는 전체 그룹 단위로 복원 가능

## 자동 배포 🚀

이 프로젝트는 **GitHub Actions**를 통해 자동 배포가 설정되어 있습니다.

### 배포 프로세스
- `main` 브랜치에 푸시하면 자동으로 Chrome Web Store에 배포됩니다
- 모든 파일을 자동으로 패키징하고 업로드합니다
- 배포 후 자동으로 게시됩니다

### 필요한 설정
GitHub Repository의 **Settings > Secrets and variables > Actions**에서 다음 secrets를 설정해야 합니다:

- `EXTENSION_ID`: Chrome Web Store 확장프로그램 ID
- `CLIENT_ID`: Google API 클라이언트 ID
- `CLIENT_SECRET`: Google API 클라이언트 시크릿
- `REFRESH_TOKEN`: OAuth 2.0 리프레시 토큰

### 수동 배포
```bash
npm run build    # 확장프로그램 패키징
npm run deploy   # Chrome Web Store에 배포
```

## 기여하기 🤝

1. 이 저장소를 Fork합니다
2. 새로운 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 Push합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 라이선스 📄

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 버전 히스토리 📋

- **v1.4.0**: 새탭 페이지 및 테마 시스템 대폭 개선
  - 🆕 **새탭 페이지 추가**: 완전히 새로운 새탭 경험
  - 🌙 **완전한 다크테마 지원**: Chrome 테마와 완전 통합
  - 🔍 **통합 검색 기능**: Google 검색 및 검색 기록
  - 📋 **세션 관리**: 자동 세션 저장 및 복원 기능
  - 🌐 **Google Apps 메뉴**: 주요 Google 서비스 빠른 접근
  - 🎨 **테마 적응**: 모든 UI 요소가 테마에 맞춰 자동 조정
  - ⚡ **성능 최적화**: 깜빡임 방지 및 로딩 속도 개선
  - ⚙️ **새탭 오버라이드 옵션**: 설정에서 켜고 끌 수 있는 새탭 기능

- **v1.3.1**: 깔끔한 도메인 표시 개선
  - 🧹 TLD 제거: `.com`, `.co.kr`, `.io` 등 도메인 확장자 자동 제거
  - 📋 더 깔끔한 탭 그룹 이름 표시
  - 🌍 국제 도메인 및 복합 TLD 지원

- **v1.3.0**: 고급 정렬 옵션 추가
  - 🔤 알파벳순 정렬 (기본)
  - 🕒 최근 방문순 정렬
  - ✋ 사용자 지정 순서 (드래그 앤 드롭)
  - 정렬 옵션 설정 UI 개선

- **v1.0.0**: 초기 릴리즈
  - 기본 탭 그룹핑 기능
  - Favicon 색상 추출 및 적용
  - 사용자 설정 옵션

---

**TabNeat** - Making your browser tabs as organized as your thoughts! 🎯
