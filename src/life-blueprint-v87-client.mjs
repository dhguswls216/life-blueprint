/** Swiss Ephemeris diagnostic client; does NOT replace natal or transit calculations. */
export const SWISS_URL = '/swiss-api'; // Vite development proxy; requires server.proxy entry
export const SWISS_BODIES = Object.freeze(['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto']);
export function angularDifference(a,b){
  if(!Number.isFinite(a)||!Number.isFinite(b))throw new Error('invalid longitude');
  return Math.abs(((a-b+540)%360)-180);
}
export function validateSwissResponse(payload,expectedJd){
  if(!payload || !Number.isFinite(payload.jdUt) || Math.abs(payload.jdUt-expectedJd)>1e-6)throw new Error('요청 시각과 응답 시각이 다름');
  for(const body of SWISS_BODIES){
    const v=payload.bodies?.[body];
    if(!v||!Number.isFinite(v.longitude)||v.longitude<0||v.longitude>=360||!Number.isFinite(v.speed))throw new Error(`${body} 계산 결과가 없거나 잘못됨`);
  }
  return payload;
}
export async function getSwissPositions(jd,{signal}={}){
  if(!Number.isFinite(jd))throw new Error('유효하지 않은 출생 시각');
  const response=await fetch(`${SWISS_URL}/positions?jd=${encodeURIComponent(jd.toFixed(8))}`,{signal,cache:'no-store'});
  if(!response.ok){let message=`HTTP ${response.status}`;try{const err=await response.json();if(err.error)message=err.error;}catch{}throw new Error(message);}
  return validateSwissResponse(await response.json(),jd);
}

/** Swiss monthly positions for five years. No fallback to approximate positions. */
export async function getSwissTransitYears(start,{signal}={}){
  if(!Number.isInteger(start)||start<1901||start>2045)throw new Error('유효하지 않은 해년수 기준 연도');
  const r=await fetch(`${SWISS_URL}/transit-years?start=${start}`,{signal,cache:'no-store'});
  if(!r.ok){let msg=`HTTP ${r.status}`;try{const e=await r.json();if(e.error)msg=e.error;}catch{}throw new Error(msg);}
  const data=await r.json();
  if(data.start!==start||!Array.isArray(data.years)||data.years.length!==5)throw new Error('Swiss 연도 계산 응답 형식 오류');
  for(let i=0;i<5;i++){
    if(data.years[i].year!==start+i||data.years[i].months?.length!==12)throw new Error('Swiss 연도·월 누락');
    for(const month of data.years[i].months){
      for(const b of ['Jupiter','Saturn','Uranus','Neptune','Pluto']){
        const v=month.bodies?.[b];
        if(!v||!Number.isFinite(v.longitude)||v.longitude<0||v.longitude>=360)throw new Error('Swiss 트랜짓 천체 누락');
      }
    }
  }
  return data;
}
