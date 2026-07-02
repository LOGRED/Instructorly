/**
 * 흰 배경의 검정 라인아트 PNG를 '투명 배경 + 검정 선'으로 바꾼다.
 * 명도(luminance)를 알파로 환산한다: 검정 선=불투명, 흰 배경=투명, 회색 경계=반투명(안티에일리어싱 유지).
 * 사용법: node scripts/png-line-to-alpha.cjs <input.png> <output.png> [trimPad]
 */
const sharp = require("sharp");

// 입력 PNG를 명도→알파 변환해 투명 라인아트로 저장한다.
async function lineToAlpha(input, output, trimPad) {
    // 흰 배경으로 평탄화한 원본(검정 선 + 흰 바탕)을 RGB로 쓰고, 명도→알파를 마스크로 쓴다.
    // 투명 영역의 RGB가 '흰색'이라, 캡처 시 생길 수 있는 옅은 매트가 흰 카드 위에서 보이지 않는다.
    const flat = sharp(input).flatten({ background: "#ffffff" });

    // RGB: 검정 선이 그대로 남은 원본(흰 바탕).
    const rgb = await flat
        .clone()
        .removeAlpha()
        .toColourspace("srgb")
        .raw()
        .toBuffer({ resolveWithObject: true });
    const { width, height } = rgb.info;

    // 알파 마스크: 흑백·반전 후 levels로 옅은 잔상을 제거(LO 이하 컷)하고 선은 또렷하게.
    const LO = 46;
    const slope = 255 / (255 - LO);
    const intercept = -LO * slope;
    const mask = await flat
        .clone()
        .greyscale()
        .negate()
        .linear(slope, intercept)
        .toColourspace("b-w")
        .raw()
        .toBuffer();

    // RGB(흰 바탕·검정 선) + 알파 결합 → 투명 배경 라인아트.
    let pipe = sharp(rgb.data, { raw: { width, height, channels: 3 } })
        .joinChannel(mask, { raw: { width, height, channels: 1 } });

    // 3) 여백 정리(선택): 투명 영역을 잘라내고 균일 패딩을 다시 준다.
    if (trimPad && Number(trimPad) > 0) {
        const pad = Number(trimPad);
        const trimmed = await pipe.png().trim({ threshold: 1 }).toBuffer();
        const meta = await sharp(trimmed).metadata();
        const side = Math.max(meta.width, meta.height);
        pipe = sharp(trimmed).extend({
            top: Math.round((side - meta.height) / 2) + pad,
            bottom: Math.round((side - meta.height) / 2) + pad,
            left: Math.round((side - meta.width) / 2) + pad,
            right: Math.round((side - meta.width) / 2) + pad,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
    }

    await pipe.png().toFile(output);
}

const [, , input, output, trimPad] = process.argv;
if (!input || !output) {
    console.error("usage: node png-line-to-alpha.cjs <input.png> <output.png> [trimPad]");
    process.exit(1);
}
lineToAlpha(input, output, trimPad)
    .then(() => console.log(`✓ alpha → ${output}`))
    .catch((e) => {
        console.error("✗", e.message);
        process.exit(1);
    });
