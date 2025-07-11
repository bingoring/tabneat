const CHROME_GROUP_COLORS = {
  blue: [66, 133, 244],
  cyan: [0, 188, 212],
  green: [15, 157, 88],
  grey: [158, 158, 158],
  orange: [255, 109, 0],
  pink: [233, 30, 99],
  purple: [156, 39, 176],
  red: [219, 68, 55],
  yellow: [244, 180, 0]
};

// RGB -> HSL 변환 함수
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  let max = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // 무채색
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }

  return [h, s, l];
}

// Chrome 색상을 HSL로 변환
const CHROME_GROUP_HSL = Object.fromEntries(
  Object.entries(CHROME_GROUP_COLORS).map(([name, [r, g, b]]) => [name, rgbToHsl(r, g, b)])
);

// 가장 가까운 Chrome 그룹 색상 찾기 (HSL 기준)
function getClosestChromeColor(r, g, b) {
  let [h1, s1, l1] = rgbToHsl(r, g, b);
  let closestColor = "grey";
  let minDistance = Number.MAX_VALUE;

  for (const [colorName, [h2, s2, l2]] of Object.entries(CHROME_GROUP_HSL)) {
    let distance = Math.abs(h1 - h2); // Hue 값 차이만 비교 (가장 중요한 색상 요소)
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = colorName;
    }
  }

  return closestColor;
}

// const CORS_PROXY = "https://cors-anywhere.herokuapp.com/"; // CORS 프록시 URL
// const CORS_PROXY = "https://api.allorigins.win/raw?url="; // CORS 프록시

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fetchFavicon") {
    const domain = message.domain;
    const CORS_PROXY = "https://api.allorigins.win/raw?url=";
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}`;
    const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(faviconUrl)}`;

    fetch(proxiedUrl)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to fetch favicon for ${domain}`);
        return response.blob();
      })
      .then(blob => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(blob);
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            let r = 0, g = 0, b = 0, count = 0;

            for (let i = 0; i < data.length; i += 4) {
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
              count++;
            }

            if (count > 0) {
              r = Math.floor(r / count);
              g = Math.floor(g / count);
              b = Math.floor(b / count);
            } else {
              r = g = b = 128; // 기본 회색
            }

            URL.revokeObjectURL(url);
            resolve(getClosestChromeColor(r, g, b));
          };

          img.onerror = () => reject(new Error("Failed to load favicon image"));
          img.src = url;
        });
      })
      .then(color => {
        sendResponse({ color });
      })
      .catch(error => {
        console.error(`Error fetching favicon for ${domain}:`, error);
        sendResponse({ color: "grey" }); // 에러 발생 시에도 반드시 응답
      });

    return true; // 비동기 응답을 위해 반드시 true 반환
  }
});

