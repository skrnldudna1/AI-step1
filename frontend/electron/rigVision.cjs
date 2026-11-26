const PART_IDS = ['head', 'torso', 'left_eye', 'right_eye', 'left_eyebrow', 'right_eyebrow',
  'nose', 'mouth', 'hair', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'tail', 'accessory'];

const POINT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['x', 'y'],
  properties: { x: { type: 'number' }, y: { type: 'number' } },
};
const RIG_ANALYSIS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['parts'],
  properties: { parts: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['id', 'points', 'pivot'],
    properties: { id: { type: 'string', enum: PART_IDS }, points: { type: 'array', items: POINT_SCHEMA }, pivot: POINT_SCHEMA },
  } } },
};

function validateRigImages(images) {
  return Array.isArray(images) && images.length >= 1 && images.length <= 5 &&
    images.every(image => typeof image === 'string' && image.length <= 6000000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) &&
    images.reduce((sum, image) => sum + image.length, 0) <= 15000000;
}

function parseRigAnalysis(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data?.parts) || data.parts.length > 15) throw new Error('Invalid rig parts');
  const validPoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
  const used = new Set();
  const parts = [];
  for (const part of data.parts) {
    if (!PART_IDS.includes(part?.id) || used.has(part.id) || !Array.isArray(part.points) ||
      part.points.length < 3 || part.points.length > 32 || !part.points.every(validPoint) || !validPoint(part.pivot)) continue;
    const area = Math.abs(part.points.reduce((sum, point, index) => {
      const next = part.points[(index + 1) % part.points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0)) / 2;
    if (area < .000001) continue;
    used.add(part.id);
    parts.push({ id: part.id, points: part.points.map(({ x, y }) => ({ x, y })), pivot: { x: part.pivot.x, y: part.pivot.y }, mode: 'region' });
  }
  return parts;
}

function rigVisionInput(images) {
  return [{ role: 'user', content: [
    { type: 'input_text', text: '첫 번째 이미지는 실제 분리할 대표 캐릭터 이미지다. 이후 이미지들은 동일 캐릭터의 얼굴 구조, 색상, 관절과 다른 표정을 이해하는 참고용이다. 첫 번째 이미지에만 정규화 좌표를 반환한다.' },
    ...images.flatMap((image, index) => [
      { type: 'input_text', text: index === 0 ? '대표 이미지 (이 이미지에만 좌표 지정)' : `참조 이미지 ${index} (좌표를 여기서 직접 복사하지 말 것)` },
      { type: 'input_image', image_url: image, detail: 'high' },
    ]),
  ] }];
}

const RIG_VISION_INSTRUCTIONS = [
  '캐릭터 2D 리깅을 위한 시각 분석을 한다. 대표 이미지와 추가 참조 이미지가 같은 캐릭터인지 구조를 비교한다.',
  '실제로 보이는 대표 이미지의 파츠만 분리 윤곽 후보로 지정한다. 숨겨지거나 존재하지 않는 팔·다리·코 등을 억지로 추정하지 않는다.',
  '이미지 자체를 편집하거나 배경을 제거하지 않는다. 각 파츠의 실제 외곽에 최대한 밀착한 다각형을 시계 방향 4~24개 점으로 그린다.',
  '좌표는 대표 이미지 전체의 좌상단 (0,0), 우하단 (1,1) 기준이다. 화면에서 보이는 좌우 기준으로 left/right를 구분한다.',
  '눈은 흰자와 눈동자까지, 코·입·눈썹은 실제 특징의 윤곽만 촘촘히 표시해 피부가 포함되지 않게 한다.',
  '머리, 몸통, 머리카락, 팔, 다리, 꼬리, 장식은 보이는 경계에 맞추되 얼굴 특징은 머리에 포함되어도 된다. 서로 다른 몸통 파츠끼리 불필요하게 겹치지 않게 한다.',
  'pivot은 대표 이미지 기준의 회전 중심이다. 머리는 목 관절, 팔은 어깨, 다리는 골반에 최대한 가깝게 지정하고 눈·입은 중심을 지정한다.',
  '참조 이미지의 자세나 각도가 다르면 좌표나 파츠 이미지를 대표 이미지로 복사하지 않는다.',
].join('\n');

module.exports = { PART_IDS, RIG_ANALYSIS_SCHEMA, validateRigImages, parseRigAnalysis, rigVisionInput, RIG_VISION_INSTRUCTIONS };
