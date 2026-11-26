const test = require('node:test');
const assert = require('node:assert/strict');
const api = () => import('../../src/components/Character/referenceExpression.ts');

const boxes = {
  head: [25,20,175,155], left_eye: [58,62,77,82], right_eye: [123,62,142,82],
  left_eyebrow: [54,48,80,54], right_eyebrow: [120,48,146,54], mouth: [80,107,120,119],
  left_arm: [12,160,44,230], torso: [45,145,150,235],
};
function rig(id, width, height, layout, transform = (x,y)=>({x,y})) {
  return { id, name:id, canvas:{width,height}, parts:[], expressions:{}, mesh:{ src:id+'.png', regions:Object.entries(layout).map(([id,[x0,y0,x1,y1]]) => {
    const convert = (x,y)=>{ const p=transform(x,y); return {x:p.x/width,y:p.y/height}; };
    return { id, points:[convert(x0,y0),convert(x1,y0),convert(x1,y1),convert(x0,y1)], pivot:convert((x0+x1)/2,(y0+y1)/2), mode:'region' };
  }) } };
}
const primary = rig('main',200,300,boxes);
const shifted = (x,y)=>({x:180+1.7*(x*Math.cos(.3)-y*Math.sin(.3)),y:40+1.7*(x*Math.sin(.3)+y*Math.cos(.3))});

test('compare reference face independently of crop, resolution and head roll', async () => {
  const { getReferenceExpression } = await api();
  const same = rig('reference',600,650,boxes,shifted);
  assert.deepEqual(getReferenceExpression(primary,same),{});
});

test('a changed reference transfers only facial geometry; differently posed body cannot replace the main asset', async () => {
  const { getReferenceExpression } = await api();
  const changed = {...boxes, left_eye:[58,68,77,76],right_eye:[123,68,142,76],mouth:[74,102,126,124],left_arm:[10,110,70,150],torso:[38,170,162,260]};
  const reference = rig('different-image',600,650,changed,shifted);
  const result = getReferenceExpression(primary,reference);
  assert.ok(Math.abs(result.left_eye.sy-.4)<1e-6);
  assert.ok(Math.abs(result.mouth.sx-1.3)<1e-6);
  assert.ok(result.mouth.sy>1.7);
  assert.equal(result.left_arm,undefined);
  assert.equal(result.torso,undefined);
  assert.equal(result.head,undefined);
  assert.equal(primary.mesh.src,'main.png');
  assert.equal(reference.mesh.src,'different-image.png');
  assert.deepEqual(getReferenceExpression(primary,{...reference,mesh:{...reference.mesh,regions:[]}}),{});
});

test('reference geometry influences mesh targets while blink and talking remain independent', async () => {
  const { getReferenceExpression } = await api();
  const { createRigMesh, meshMotion } = await import('../../src/components/Character/meshDeformation.ts');
  const reference = rig('reference',200,300,{...boxes,left_eye:[58,68,77,76],right_eye:[123,68,142,76],mouth:[75,103,125,123]});
  const result = getReferenceExpression(primary,reference);
  const mesh = createRigMesh(primary.mesh.regions,2/3);
  const eye=mesh.controls.find(c=>c.region.id==='left_eye'), mouth=mesh.controls.find(c=>c.region.id==='mouth');
  const reaction={emotion:'surprised',intensity:1,action:'idle'};
  const pose=meshMotion(eye,'surprised',reaction,1,false,false,result.left_eye);
  assert.ok(pose.sy < .75);
  assert.ok(meshMotion(eye,'surprised',reaction,3.72,false,false,result.left_eye).sy < pose.sy*.2);
  const silent=meshMotion(mouth,'surprised',reaction,1,false,false,result.mouth);
  assert.ok(meshMotion(mouth,'surprised',reaction,1,true,false,result.mouth).sy > silent.sy);
});

test('a traced smile contour supplies mouth curvature without copying its artwork', async () => {
  const { getReferenceExpression } = await api();
  const reference=rig('reference',200,300,boxes);
  const mouth=reference.mesh.regions.find(r=>r.id==='mouth');
  mouth.points=[[80,107],[90,111],[100,115],[110,111],[120,107],[120,111],[110,115],[100,119],[90,115],[80,111]].map(([x,y])=>({x:x/200,y:y/300}));
  const result=getReferenceExpression(primary,reference);
  assert.ok(result.mouth.curve<-.025);
});
