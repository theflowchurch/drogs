import frames from '../../data/portrait-framing.json' with {type:'json'};
import crops from '../../data/portrait-crops.json' with {type:'json'};
// Match the exact media key, never a person's name: a replacement must not
// inherit the crop belonging to their previous, labelled photograph.
export const portraitCrop = path => crops[path] || null;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
// CSS cover preserves the original proportions. Position its crop around the
// detected face, including forehead/chin margin, instead of cropping from the top.
export function focalPosition(frame,ratio=.8){
 if(!frame?.face)return [50,25];
 const [x,y,w,h]=frame.face,sourceRatio=frame.width/frame.height;
 const visible=[Math.min(1,ratio/sourceRatio),Math.min(1,sourceRatio/ratio)];
 const bounds=[[Math.max(0,x-w*.25),Math.min(1,x+w*1.25)],[Math.max(0,y-h*.55),Math.min(1,y+h*1.3)]];
 return visible.map((size,axis)=>{
  if(size>=.9999)return 50;
  const [lo,hi]=bounds[axis];
  const center=axis?y+h*.5:x+w*.5;
  let start=clamp(center-size*(axis?.4:.5),0,1-size);
  if(hi-lo<=size)start=clamp(start,Math.max(0,hi-size),Math.min(lo,1-size));
  return Math.round(clamp(start/(1-size),0,1)*10000)/100;
 });
}
export function portraitStyle(path,ratio=.8){
 const [x,y]=focalPosition(frames[path],ratio);
 return `--portrait-x:${x}%;--portrait-y:${y}%`;
}
