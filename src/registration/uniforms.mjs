// The official look for each group (office, 19 Nov), taken from the edited
// portraits already on the roll. Used to edit the photo of a new bishop or
// pastor we have no photo for. A group with no entry is left unedited.
export const UNIFORMS = {
  'pastor-male-firstlove': 'a grey suit jacket, a white shirt and a red tie',
  'pastor-male-ud': 'a black suit jacket, a white shirt and a black tie',
  'pastor-male-flow': 'a navy blue suit jacket, a white shirt and an orange-red tie',
  'pastor-female-firstlove': 'a plain red top or dress and a red fascinator worn on the side of the head',
  'pastor-female-ud': 'a plain yellow top or dress and a black fascinator worn on the side of the head',
  'pastor-female-flow': 'a plain red top or dress and a small red flower fascinator on the side of the head',
  'rev-male-firstlove': 'a navy blue blazer over a black clerical shirt with a white clerical collar tab',
  'rev-male-ud': 'a black suit jacket over a grey clerical shirt with a white clerical collar tab',
  'rev-female-firstlove': 'a navy blue blazer over a black clerical shirt with a white clerical collar tab, and a black hat',
  'rev-female-ud': 'a black jacket over a grey clerical shirt with a white clerical collar tab, and a black hat',
  'bishop-male': 'a red bishop’s cassock jacket with gold buttons down the front, a white clerical collar tab and a gold chain',
  'bishop-mother': 'a red bishop’s cassock jacket with gold buttons down the front, a white clerical collar tab, and a large red hat',
  'bishop-sister': 'a red bishop’s cassock jacket with gold buttons down the front, a white clerical collar tab, and a black hat',
};
const ORG = { 'First Love': 'firstlove', 'United Denominations': 'ud', FLOW: 'flow' };
// Which group a person's details fall in, or '' when we have no official look for it yet.
export function uniformGroup({ role, title = '', gender = '', organization = '' } = {}) {
  const t = String(title).toLowerCase();
  if (role === 'bishop') {
    if (gender !== 'female') return 'bishop-male';
    return /episcopal sister/.test(t) ? 'bishop-sister' : 'bishop-mother';
  }
  const org = ORG[organization];
  if (!org || !['male', 'female'].includes(gender)) return '';
  const rev = /rev/.test(t);
  const key = rev ? `rev-${gender}-${org}` : `pastor-${gender}-${org}`;
  return UNIFORMS[key] ? key : '';
}
export const uniformPrompt = (group) => `Edit the LAST photo. It shows the person whose portrait this is.
Keep this exact person: the same face, facial features, skin tone, age, hairline and hairstyle, glasses if any, and expression. Do not change who they are.
Make it an official head-and-shoulders portrait: the person centred and facing the camera, a pure white background, soft even studio lighting, sharp focus, framed from just above the head to the middle of the chest, portrait orientation.
Dress them in ${UNIFORMS[group]}.
The other photos are examples of the required style, framing and uniform. They show other people: never copy their faces.
Remove any other people, objects, text or watermarks.`;
