/* 천체 계산 모듈 v86: JPL 근사값 기본 제공. 정밀 공급자를 연결하기 전에는 정확도 보증이 없다. */
const rad=Math.PI/180;
function julianDay(y,m,d,ut){
  if(m<=2){y-=1;m+=12;}
  const A=Math.floor(y/100),B=2-A+Math.floor(A/4);
  return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+B-1524.5+ut/24;
}
function approximateSunLon(J){
  const T=(J-2451545)/36525;
  const L0=280.46646+36000.76983*T+0.0003032*T*T;
  const M=357.52911+35999.05029*T-0.0001537*T*T;
  const C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(M*rad)
    +(0.019993-0.000101*T)*Math.sin(2*M*rad)+0.000289*Math.sin(3*M*rad);
  return((L0+C)%360+360)%360;
}
function approximateMoonLon(J){
  const T=(J-2451545)/36525;
  const Lp=218.3164477+481267.88123421*T-0.0015786*T*T+T*T*T/538841;
  const D=297.8501921+445267.1114034*T-0.0018819*T*T;
  const M=357.5291092+35999.0502909*T-0.0001536*T*T;
  const Mp=134.9633964+477198.8675055*T+0.0087414*T*T;
  const F=93.272095+483202.0175233*T-0.0036539*T*T;
  const E=1-0.002516*T-0.0000074*T*T;
  const terms=[[6.288774,[0,0,1,0]],[1.274027,[2,0,-1,0]],[0.658314,[2,0,0,0]],
  [0.213618,[0,0,2,0]],[-0.185116,[0,1,0,0]],[-0.114332,[0,0,0,2]],
  [0.058793,[2,0,-2,0]],[0.057066,[2,-1,-1,0]],[0.053322,[2,0,1,0]],
  [0.045758,[2,-1,0,0]],[-0.040923,[0,1,-1,0]],[-0.034720,[1,0,0,0]],
  [-0.030383,[0,1,1,0]],[0.015327,[2,0,0,-2]],[-0.012528,[0,0,1,2]],
  [0.010980,[0,0,1,-2]],[0.010675,[4,0,-1,0]],[0.010034,[0,0,3,0]],
  [0.008548,[4,0,-2,0]],[-0.007888,[2,1,-1,0]],[-0.006766,[2,1,0,0]],[-0.005163,[1,0,-1,0]]];
  let sum=0;
  for(const[coef,[cd,cm,cmp,cf]]of terms){
    let c=coef;
    if(Math.abs(cm)===1)c*=E;if(Math.abs(cm)===2)c*=E*E;
    sum+=c*Math.sin((cd*D+cm*M+cmp*Mp+cf*F)*rad);
  }
  return((Lp+sum)%360+360)%360;
}
function gmst(J){
  const T=(J-2451545)/36525;
  return(((280.46061837+360.98564736629*(J-2451545)+0.000387933*T*T-T*T*T/38710000)%360)+360)%360;
}
function ascMc(J,lat,lon){
  const T=(J-2451545)/36525;
  const eps=(23.439291-0.0130042*T)*rad;
  const ramc=(((gmst(J)+lon)%360+360)%360)*rad;
  let mc=Math.atan2(Math.sin(ramc),Math.cos(ramc)*Math.cos(eps))/rad;mc=(mc+360)%360;
  const phi=lat*rad;
  let asc=Math.atan2(Math.cos(ramc),-(Math.sin(ramc)*Math.cos(eps)+Math.tan(phi)*Math.sin(eps)))/rad;
  asc=(asc+360)%360;
  return{asc,mc};
}
/* JPL 근사 궤도요소 (1800–2050 유효) */
const EL={
Mercury:[0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593,0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081],
Venus:[0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255,0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418],
Earth:[1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0.0,0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0.0],
Mars:[1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891,0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343],
Jupiter:[5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909,-0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106],
Saturn:[9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448,-0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794],
Uranus:[19.18916464,0.04725744,0.77263783,313.23810451,170.95427630,74.01692503,-0.00196176,-0.00004397,-0.00242939,428.48202785,0.40805281,0.04240589],
Neptune:[30.06992276,0.00859048,1.77004347,-55.12002969,44.96476227,131.78422574,0.00026291,0.00005105,0.00035372,218.45945325,-0.32241464,-0.00508664],
Pluto:[39.48211675,0.24882730,17.14001206,238.92903833,224.06891629,110.30393684,-0.00031596,0.00005170,0.00004818,145.20780515,-0.04062942,-0.01183482],
};
function helio(name,T){
  const e0=EL[name];
  const a=e0[0]+e0[6]*T,e=e0[1]+e0[7]*T,I=(e0[2]+e0[8]*T)*rad;
  const L=e0[3]+e0[9]*T,peri=e0[4]+e0[10]*T,node=e0[5]+e0[11]*T;
  const w=(peri-node)*rad,W=node*rad;
  let M=((L-peri)%360+360)%360;if(M>180)M-=360;M*=rad;
  let E=M+e*Math.sin(M);
  for(let i=0;i<8;i++){const dE=(M-(E-e*Math.sin(E)))/(1-e*Math.cos(E));E+=dE;}
  const xp=a*(Math.cos(E)-e),yp=a*Math.sqrt(1-e*e)*Math.sin(E);
  const x=(Math.cos(w)*Math.cos(W)-Math.sin(w)*Math.sin(W)*Math.cos(I))*xp+(-Math.sin(w)*Math.cos(W)-Math.cos(w)*Math.sin(W)*Math.cos(I))*yp;
  const y=(Math.cos(w)*Math.sin(W)+Math.sin(w)*Math.cos(W)*Math.cos(I))*xp+(-Math.sin(w)*Math.sin(W)+Math.cos(w)*Math.cos(W)*Math.cos(I))*yp;
  return[x,y];
}
function planetLonRaw(name,J){
  const T=(J-2451545)/36525;
  const p=helio(name,T),e=helio("Earth",T);
  return((Math.atan2(p[1]-e[1],p[0]-e[0])/rad)%360+360)%360;
}
function approximateRetro(name,J){
  const a=planetLonRaw(name,J),b=planetLonRaw(name,J+1);
  let d=b-a;if(d>180)d-=360;if(d<-180)d+=360;
  return d<0;
}

/* ═══ 정확도 패치 (감사 반영) — 세차 보정 + 한국 표준시 ═══ */
/* planetLon: J2000 → 그 해 황도로 세차 보정. 기존 7개 호출부가 자동 적용됨 */
function approximatePlanetLon(name,J){
  const raw=planetLonRaw(name,J);
  const T=(J-2451545)/36525;
  const prec=(5028.796195*T+1.1054348*T*T)/3600; // 일반세차(도)
  return((raw+prec)%360+360)%360;
}


// 교체 가능한 정밀 천문력 인터페이스. 제공되지 않으면 기존 근사 계산임을 명시한다.
// provider.getLongitude(body, jdUT): {longitude, speed?} (body: Sun, Moon, Mercury ... Pluto)
let precisionProvider=null;
export function registerPrecisionEphemeris(provider){
  if(provider!==null && (typeof provider.getLongitude!=="function"))throw new TypeError("getLongitude 필요");
  precisionProvider=provider;
}
export const ephemerisStatus=()=>({mode:precisionProvider?"external-precision":"approximate-jpl",verified:false});
function bodyAt(body,J){
  if(!precisionProvider)return null;
  const v=precisionProvider.getLongitude(body,J);
  if(!v||!Number.isFinite(v.longitude))throw new Error(`${body} 정밀 위치 계산 실패`);
  return v;
}
export function sunLon(J){const v=bodyAt("Sun",J);return v?((v.longitude%360)+360)%360:approximateSunLon(J);}
export function moonLon(J){const v=bodyAt("Moon",J);return v?((v.longitude%360)+360)%360:approximateMoonLon(J);}
export function planetLon(name,J){const v=bodyAt(name,J);return v?((v.longitude%360)+360)%360:approximatePlanetLon(name,J);}
export function isRetro(name,J){
  const v=bodyAt(name,J);
  if(v){if(Number.isFinite(v.speed))return v.speed<0;
    const later=bodyAt(name,J+0.5);
    let delta=later.longitude-v.longitude;if(delta>180)delta-=360;if(delta< -180)delta+=360;
    return delta<0;
  }
  return approximateRetro(name,J);
}
export {julianDay,ascMc,planetLonRaw};

// IANA Asia/Seoul: 날짜뿐 아니라 현지 시각까지 고려해 UTC로 바꾼다.
const SEOUL_FORMAT=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
function localParts(utcMs){const p=Object.fromEntries(SEOUL_FORMAT.formatToParts(new Date(utcMs)).filter(x=>x.type!=="literal").map(x=>[x.type,Number(x.value)]));return p;}
function offsetMinutesAt(utcMs){const p=localParts(utcMs);return (Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-Math.floor(utcMs/1000)*1000)/60000;}
export function seoulLocalToUtc(y,mo,d,hh=0,mm=0){
  if(![y,mo,d,hh,mm].every(Number.isInteger)||hh<0||hh>23||mm<0||mm>59)return {status:"invalid",instants:[]};
  const naive=Date.UTC(y,mo-1,d,hh,mm);
  const check=new Date(naive);
  if(check.getUTCFullYear()!==y||check.getUTCMonth()+1!==mo||check.getUTCDate()!==d)return {status:"invalid",instants:[]};
  const offsets=new Set();
  for(let h=-24;h<=24;h+=3)offsets.add(offsetMinutesAt(naive+h*3600000));
  const instants=[...offsets].map(offset=>naive-offset*60000).filter(t=>{const p=localParts(t);return p.year===y&&p.month===mo&&p.day===d&&p.hour===hh&&p.minute===mm;}).sort((a,b)=>a-b);
  return {status:instants.length===0?"nonexistent":instants.length>1?"ambiguous":"valid",instants:[...new Set(instants)],offsetHours:instants.length?offsetMinutesAt(instants[0])/60:null};
}
export function koreaOffset(y,mo,d){const r=seoulLocalToUtc(y,mo,d,12,0);return r.offsetHours??9;}
export function addLocalMinutes(y,mo,d,min){const dt=new Date(Date.UTC(y,mo-1,d,0,min));return {y:dt.getUTCFullYear(),mo:dt.getUTCMonth()+1,d:dt.getUTCDate(),hh:dt.getUTCHours(),mm:dt.getUTCMinutes()};}
