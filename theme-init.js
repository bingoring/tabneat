// FOUC 방지: 페이지 로드 즉시 저장된 테마 적용
(function() {
    try {
        const savedTheme = localStorage.getItem('tabneat-theme');
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else if (savedTheme === 'light') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            // 저장된 테마가 없으면 시스템 설정 즉시 확인
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.setAttribute('data-theme', 'dark');
            }
        }
    } catch (error) {
        // 로컬 스토리지 접근 실패 시 시스템 설정 사용
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }
})();
