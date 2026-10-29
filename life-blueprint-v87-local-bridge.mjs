/** Life Blueprint v87 — local-only Swiss Ephemeris bridge. Node.js 20+; no npm dependencies. */
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const ROOT = resolve(process.env.SWISSEPH_ROOT || 'C:\\Users\\SAMSUNG\\swisseph\\swisseph-master');
const EXE = resolve(process.env.SWETEST_EXE || join(ROOT, 'windows', 'programs', 'swetest.exe'));
const EPHE = resolve(process.env.SWISSEPH_EPHE || join(ROOT, 'ephe'));
const HOST = '127.0.0.1';
const PORT = Number(process.env.LB_ASTRO_PORT || 8765);
const BODIES = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const J1970 = 2440587.5;

export function parseSwetestOutput(raw) {
  const lines = String(raw).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const result = {};
  for (const line of lines) {
    const match = line.match(/^(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i);
    if (!match) continue;
    const body = BODIES.find(b=>b.toLowerCase()===match[1].toLowerCase());
    if (body in result) throw new Error(`Duplicate body: ${body}`);
    const longitude = Number(match[2]), speed = Number(match[3]);
    if (!Number.isFinite(longitude)||longitude<0||longitude>=360||!Number.isFinite(speed)) throw new Error(`Invalid value: ${body}`);
    result[body] = { longitude, speed };
  }
  if (Object.keys(result).length!==BODIES.length) {
    throw new Error(`Expected ${BODIES.length} bodies, got ${Object.keys(result).length}; program output: ${String(raw).slice(0,500)}`);
  }
  return result;
}

export function jdToUTC(jd) {
  if (!Number.isFinite(jd) || jd < 2400000 || jd > 2600000) throw new RangeError('Julian day outside supported bridge range');
  const date = new Date((jd-J1970)*86400000);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid Julian day');
  const pad = n => String(n).padStart(2,'0');
  const b = `${pad(date.getUTCDate())}.${pad(date.getUTCMonth()+1)}.${date.getUTCFullYear()}`;
  // Explicit UT with milliseconds (swetest handles decimal seconds as UT time).
  const ut = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  return { b, ut, iso:date.toISOString(), date };
}

export async function calculatePositions(jd) {
  const { b, ut, iso } = jdToUTC(jd);
  const args = [`-edir${EPHE}`,'-eswe',`-b${b}`,`-ut${ut}`,'-p0123456789','-fPls','-head'];
  const {stdout,stderr} = await execFileAsync(EXE,args,{windowsHide:true,encoding:'utf8',timeout:12000,maxBuffer:1024*1024});
  // Warning, if any, must not silently become a verified precision result.
  const notices = [stderr, ...String(stdout).split(/\r?\n/).filter(line=>/moshier|not found|cannot open|warning|error|fallback/i.test(line))].filter(Boolean);
  if (notices.length) throw new Error(`swetest diagnostic: ${notices.join(' ').slice(0,400)}`);
  return {jdUt:jd,isoUtc:iso,calculation:'Swiss Ephemeris requested (-eswe)',fileUse:'not independently verified',bodies:parseSwetestOutput(stdout)};
}

/** Parse swetest -house output (decimal longitude via -fPl). Fail closed on format drift. */
export function parseSwissHouses(raw) {
  const rows = String(raw).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const cusps = new Map();
  let asc = null, mc = null;
  for (const row of rows) {
    const h = row.match(/^house\s*(1[0-2]|[1-9])\s*[:=]?\s+(-?\d+(?:\.\d+)?)/i);
    if (h) {
      const n=Number(h[1]), v=Number(h[2]);
      if(cusps.has(n))throw new Error(`Duplicate cusp ${n}`);
      cusps.set(n,v);continue;
    }
    const a=row.match(/^Ascendant\s*[:=]?\s+(-?\d+(?:\.\d+)?)/i);
    if(a){if(asc!==null)throw new Error('Duplicate Ascendant');asc=Number(a[1]);continue;}
    const m=row.match(/^MC\s*[:=]?\s+(-?\d+(?:\.\d+)?)/i);
    if(m){if(mc!==null)throw new Error('Duplicate MC');mc=Number(m[1]);}
  }
  if(cusps.size!==12 || !Number.isFinite(asc) || !Number.isFinite(mc))
    throw new Error(`Swiss house output incomplete: ${cusps.size} cusps, ASC=${asc}, MC=${mc}. raw=${String(raw).slice(0,650)}`);
  const valid=x=>Number.isFinite(x)&&x>=0&&x<360;
  if(!valid(asc)||!valid(mc)||[...cusps.values()].some(x=>!valid(x)))throw new Error('House longitude out of range');
  const first=Math.floor(asc/30)*30;
  const expected=Array.from({length:12},(_,i)=>(first+30*i)%360);
  const actual=Array.from({length:12},(_,i)=>cusps.get(i+1));
  // Whole sign W: ASC lies inside the first house, not necessarily on its cusp.
  const diff=(a,b)=>Math.abs(((a-b+540)%360)-180);
  if(actual.some((c,i)=>diff(c,expected[i])>0.0002))throw new Error('Swiss whole-sign cusps do not match ASC sign');
  return {asc,mc,ic:(mc+180)%360,dsc:(asc+180)%360,cusps:actual,houseSystem:'W',reference:'tropical whole sign'};
}

export async function calculateHouses(jd,lat,lon) {
  if(!Number.isFinite(lat)||lat < -89.99||lat>89.99||!Number.isFinite(lon)||lon < -180||lon>180)
    throw new RangeError('Invalid geographic coordinates');
  const {b,ut,iso}=jdToUTC(jd);
  const args=[`-edir${EPHE}`,'-eswe',`-b${b}`,`-ut${ut}`,'-p0','-fPl','-head',`-house${lon},${lat},W`];
  const {stdout,stderr}=await execFileAsync(EXE,args,{windowsHide:true,encoding:'utf8',timeout:12000,maxBuffer:1024*1024});
  const notices=[stderr,...String(stdout).split(/\r?\n/).filter(line=>/moshier|not found|cannot open|warning|error|fallback/i.test(line))].filter(Boolean);
  if(notices.length)throw new Error(`swetest houses diagnostic: ${notices.join(' ').slice(0,400)}`);
  return {jdUt:jd,isoUtc:iso,latitude:lat,longitude:lon,...parseSwissHouses(stdout),source:'swetest -house lon,lat,W'};
}

function writeJson(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'http://localhost:5173','Vary':'Origin'});res.end(JSON.stringify(value));}

export function createBridgeServer() {
  let running = 0;
  const cache=new Map();
  const yearCache=new Map();
  const houseCache=new Map();
  return createServer(async(req,res)=>{
    const url=new URL(req.url||'/',`http://${HOST}:${PORT}`);
    if (req.method !== 'GET') return writeJson(res,405,{error:'GET only'});
    if(url.pathname==='/health')return writeJson(res,200,{ok:existsSync(EXE)&&existsSync(EPHE),exeExists:existsSync(EXE),epheExists:existsSync(EPHE),mode:'v92-houses-test-bridge',transitYearsAvailable:true,housesAvailable:true,connectedToLifeBlueprint:true});
    if(url.pathname==='/transit-years'){
      const start=Number(url.searchParams.get('start'));
      if(!Number.isInteger(start)||start<1901||start>2045)return writeJson(res,400,{error:'start must be an integer year between 1901 and 2045'});
      const key=String(start);
      if(yearCache.has(key))return writeJson(res,200,yearCache.get(key));
      if(running>=1)return writeJson(res,429,{error:'Calculation busy; retry'});
      running++;
      try{
        const years=[];
        for(let y=start;y<start+5;y++){
          const months=[];
          for(let m=1;m<=12;m++){
            const jd=Date.UTC(y,m-1,1,12,0,0)/86400000+J1970;
            const result=await calculatePositions(jd);
            months.push({month:m,jdUt:jd,bodies:result.bodies});
          }
          years.push({year:y,months});
        }
        const result={start,mode:'swiss-monthly-sample',scope:'first day of each month UTC 12:00',years};
        if(yearCache.size>=6)yearCache.delete(yearCache.keys().next().value);
        yearCache.set(key,result);
        writeJson(res,200,result);
      }catch(error){writeJson(res,502,{error:String(error.message||error)});}finally{running--;}
      return;
    }
    if(url.pathname==='/houses') {
      const jd=Number(url.searchParams.get('jd'));
      const lat=Number(url.searchParams.get('lat'));
      const lon=Number(url.searchParams.get('lon'));
      if(!url.searchParams.has('jd')||!url.searchParams.has('lat')||!url.searchParams.has('lon')||
        !Number.isFinite(jd)||jd<2400000||jd>2600000||!Number.isFinite(lat)||lat < -89.99||lat>89.99||!Number.isFinite(lon)||lon < -180||lon>180)
        return writeJson(res,400,{error:'jd, lat and lon must be valid numbers (latitude -89.99..89.99, longitude -180..180)'});
      const key=`${jd.toFixed(8)}:${lat.toFixed(6)}:${lon.toFixed(6)}`;
      if(houseCache.has(key))return writeJson(res,200,houseCache.get(key));
      if(running>=1)return writeJson(res,429,{error:'Calculation busy; retry'});
      running++;
      try {
        const result=await calculateHouses(jd,lat,lon);
        if(houseCache.size>=100)houseCache.delete(houseCache.keys().next().value);
        houseCache.set(key,result);writeJson(res,200,result);
      }catch(error){writeJson(res,502,{error:String(error.message||error)});}finally{running--;}
      return;
    }
    if(url.pathname!=='/positions')return writeJson(res,404,{error:'Not found'});
    const jd=Number(url.searchParams.get('jd'));
    if(!url.searchParams.has('jd')||!Number.isFinite(jd)||jd<2400000||jd>2600000)return writeJson(res,400,{error:'jd must be a Julian day between 2400000 and 2600000'});
    const key=jd.toFixed(8);
    if(cache.has(key))return writeJson(res,200,cache.get(key));
    if(running>=1)return writeJson(res,429,{error:'Calculation busy; retry'});
    running++;
    try{const result=await calculatePositions(jd);if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,result);writeJson(res,200,result);}catch(error){writeJson(res,502,{error:String(error.message||error)});}finally{running--;}
  });
}

if (process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))) {
  if(!existsSync(EXE)||!existsSync(EPHE)){
    console.error('Swiss Ephemeris files not found. EXE:',EXE,'EPHE:',EPHE);
    process.exitCode=1;
  } else {
    createBridgeServer().listen(PORT,HOST,()=>{
      console.log(`Life Blueprint Swiss test bridge: http://${HOST}:${PORT}/health`);
      console.log(`EPHE: ${EPHE}`);
      console.log('v92 house diagnostic enabled; app house UI not yet linked. Press Ctrl+C to stop.');
    });
  }
}
