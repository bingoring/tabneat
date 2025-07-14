# TabNeat 🎨📋

**Smart Tab Organization Chrome Extension**

TabNeat은 크롬 브라우저의 탭을 스마트하게 정리하고 그룹핑하는 확장프로그램입니다. 각 사이트의 favicon 색상을 자동으로 추출하여 최적의 색상으로 탭 그룹을 꾸며줍니다.

## 다운로드 📦

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/mmcddpjlkgbflhcfchenbjebkbhhfepa?style=for-the-badge&logo=googlechrome&logoColor=white&label=CHROME%20WEB%20STORE)](https://chromewebstore.google.com/detail/tabneat/mmcddpjlkgbflhcfchenbjebkbhhfepa)

**👆 Chrome Web Store에서 바로 설치하기**

🔗 **직접 링크**: [https://chromewebstore.google.com/detail/tabneat/mmcddpjlkgbflhcfchenbjebkbhhfepa](https://chromewebstore.google.com/detail/tabneat/mmcddpjlkgbflhcfchenbjebkbhhfepa)

## 주요 기능 ✨

### 🔄 스마트 탭 정렬
- 웹사이트별 자동 그룹핑
- 도메인 기반 탭 조직화
- **다양한 정렬 옵션**: 알파벳순, 최근 방문순, 사용자 지정 순서
- 드래그 앤 드롭으로 도메인 순서 커스터마이징

### 🎨 지능형 색상 추출
- **Favicon 색상 분석**: 각 사이트의 favicon에서 주요 색상을 추출
- **최적 색상 선택**: 추출된 색상 중 가장 적합한 색상을 자동 선택
- **탭 그룹 색상 적용**: 선택된 색상을 탭 그룹에 자동 적용하여 시각적 구분

### 📱 사용자 친화적 인터페이스
- 직관적인 팝업 UI
- 간편한 원클릭 정리
- 사용자 설정 옵션

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

## 사용 방법 🚀

1. 확장프로그램 아이콘 클릭
2. "탭 정리" 버튼 클릭으로 자동 그룹핑
3. 설정에서 개인화 옵션 조정

## 기술 스택 🛠️

- **JavaScript**: 메인 로직 구현
- **Chrome Extension API**: 브라우저 확장 기능
- **HTML/CSS**: 사용자 인터페이스
- **Canvas API**: 이미지 색상 분석

## 파일 구조 📂

```
tabneat/
├── manifest.json          # 확장프로그램 설정
├── background.js          # 백그라운드 스크립트
├── popup.html            # 팝업 UI
├── popup.js              # 팝업 로직
├── options.html          # 설정 페이지
├── options.js            # 설정 로직
├── offscreen.html        # 오프스크린 문서
├── offscreen.js          # 색상 추출 로직
└── icons/               # 확장프로그램 아이콘들
    ├── icon-16.png      # 16x16 아이콘
    ├── icon-32.png      # 32x32 아이콘
    ├── icon-64.png      # 64x64 아이콘
    ├── icon-128.png     # 128x128 아이콘
    └── icon-*-1.png     # 아이콘 바리에이션들
```

## 주요 알고리즘 🧠

### 색상 추출 프로세스
1. **Favicon 로드**: 각 탭의 favicon 이미지 획득
2. **Canvas 분석**: 이미지를 canvas에 그려 픽셀 데이터 추출
3. **색상 클러스터링**: 주요 색상들을 그룹화하여 대표 색상 선별
4. **최적 색상 선택**: 명도, 채도, 대비를 고려한 최적 색상 결정
5. **그룹 색상 적용**: Chrome Tab Groups API를 통해 색상 적용

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
