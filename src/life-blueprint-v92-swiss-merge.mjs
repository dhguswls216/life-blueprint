/** v92: Swiss 행성 경도를 기존 출생차트에 주입한다. ASC/MC는 변경하지 않는다. */
export const NATAL_BODIES = Object.freeze(['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto']);
export function mergeSwissNatal(base, response){
  if(!base?.astro || !response) return base;
  const source=base.astro;
  if(!Number.isFinite(source.J0) || !Number.isFinite(response.jdUt) || Math.abs(source.J0-response.jdUt)>1e-6){
    throw new Error('v92: Swiss 응답과 출생차트 JD 불일치');
  }
  for(const body of NATAL_BODIES){
    const record=response.bodies?.[body];
    if(!record || !Number.isFinite(record.longitude) || record.longitude<0 || record.longitude>=360 || !Number.isFinite(record.speed)){
      throw new Error(`v92: Swiss ${body} 위치/속도 검증 실패`);
    }
  }
  const planets={...source.planets};
  for(const body of NATAL_BODIES.slice(2)){
    if(!planets[body]) throw new Error(`v92: 기존 차트의 ${body} 누락`);
    planets[body]={...planets[body],lon:response.bodies[body].longitude,retro:response.bodies[body].speed<0};
  }
  return {
    ...base,
    astro:{
      ...source,
      sun:response.bodies.Sun.longitude,
      moon:response.bodies.Moon.longitude,
      planets,
      ephemerisSource:'swiss-planets',
      // 중요: 상승점 및 MC는 여전히 기존 근사 엔진 결과이다.
      angleSource:'approximate-asc-mc',
    },
  };
}
