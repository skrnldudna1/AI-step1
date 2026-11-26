const test = require('node:test');
const assert = require('node:assert/strict');
const api = () => import('../../src/components/Character/expressionTransition.ts');
const sample = (id,w=630,h=630) => ({id,name:id,canvas:{width:w,height:h},parts:[],expressions:{},mesh:{src:id+'.png',regions:[]}});
const main=sample('main'); main.expressionRigs={happy:sample('happy',210,210),sad:sample('sad',551,477)};

test('actual reference artwork is selected only after loading and returns to the representative art', async () => {
  const {getArtworkSlots,selectArtworkSlot,artworkSources} = await api();
  const slots=getArtworkSlots(main), ready=new Set(['primary','happy','sad']);
  assert.equal(selectArtworkSlot(slots,'happy',false,new Set(['primary'])).rig.id,'main');
  assert.deepEqual(artworkSources(selectArtworkSlot(slots,'happy',false,ready).rig),['happy.png']);
  assert.equal(selectArtworkSlot(slots,'sad',false,ready).rig.id,'sad');
  assert.equal(selectArtworkSlot(slots,'neutral',false,ready).rig.id,'main');
  assert.equal(selectArtworkSlot(slots,'sad',true,ready).rig.id,'main');
  assert.equal(selectArtworkSlot(slots,'playful',false,ready).rig.id,'main');
});

test('different crop dimensions and transparent margins never stretch the reference or resize the outer canvas', async () => {
  const {fitArtwork,EXPRESSION_FADE_MS} = await api();
  const fit=fitArtwork(main.canvas,main.expressionRigs.sad.canvas);
  assert.equal(fit.aspectRatio,'551 / 477');
  assert.ok(Math.abs(parseFloat(fit.width)-100)<1e-6);
  assert.equal(parseFloat(fit.bottom),0);
  const padded=fitArtwork(main.canvas,main.expressionRigs.happy.canvas,undefined,{x:.15,y:.2,width:.7,height:.65});
  assert.ok(parseFloat(padded.width)>100 && parseFloat(padded.width)<=135);
  assert.ok(parseFloat(padded.bottom)<0); // visible pixels align, not the transparent padding
  assert.ok(EXPRESSION_FADE_MS>150 && EXPRESSION_FADE_MS<500);
});
