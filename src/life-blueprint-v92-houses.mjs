/** v92 4차: Swiss 홀사인 하우스 — 출생 JD와 좌표가 일치해야 적용 */
export async function getSwissHouses(jd, lat, lon, {signal}={}) {
  if(!Number.isFinite(jd)||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>89.99||Math.abs(lon)>180)
    throw new Error('하우스 계산 요청 시각/좌표 오류');
  const path=`/swiss-api/houses?jd=${encodeURIComponent(jd.toFixed(8))}&lat=${encodeURIComponent(lat.toFixed(6))}&lon=${encodeURIComponent(lon.toFixed(6))}`;
  const response=await fetch(path,{signal,cache:'no-store'});
  if(!response.ok){let m=`HTTP ${response.status}`;try{const e=await response.json();m=e.error||m;}catch{}throw new Error(m);}
  return validateSwissHouses(await response.json(),jd,lat,lon);
}
const diff=(a,b)=>Math.abs(((a-b+540)%360)-180);
export function validateSwissHouses(data,jd,lat,lon){
  if(!data||Math.abs(data.jdUt-jd)>1e-6||Math.abs(data.latitude-lat)>1e-5||Math.abs(data.longitude-lon)>1e-5)
    throw new Error('Swiss 하우스 응답 JD/출생좌표 불일치');
  if(data.houseSystem!=='W'||!Number.isFinite(data.asc)||!Number.isFinite(data.mc)||data.asc<0||data.asc>=360||data.mc<0||data.mc>=360)
    throw new Error('Swiss 하우스 체계 또는 ASC·MC 오류');
  if(!Array.isArray(data.cusps)||data.cusps.length!==12)throw new Error('12하우스 경계 누락');
  const first=Math.floor(data.asc/30)*30;
  data.cusps.forEach((c,i)=>{if(!Number.isFinite(c)||c<0||c>=360||diff(c,(first+i*30)%360)>0.0002)throw new Error(`${i+1}하우스 경계 오류`);});
  if(!Number.isFinite(data.ic)||!Number.isFinite(data.dsc)||diff(data.ic,(data.mc+180)%360)>0.0002||diff(data.dsc,(data.asc+180)%360)>0.0002)
    throw new Error('IC·DSC 축 불일치');
  return data;
}
export function mergeSwissHouses(base,houses){
  if(!base?.astro||base.astro.approx||!houses)return base;
  validateSwissHouses(houses,base.astro.J0,base.astro.geoLat,base.astro.geoLon);
  return {...base,astro:{...base.astro,asc:houses.asc,mc:houses.mc,
    houseCusps:[...houses.cusps],houseSystem:'W',angleSource:'swiss-houses'}};
}
