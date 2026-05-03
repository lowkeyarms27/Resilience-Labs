import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CURL_PATH = "/nix/store/npzhmbcn6mjbf31416bc6aga1c4lp2s8-replit-runtime-path/bin/curl";

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
};

export async function executeCommand(cmd: string, timeoutMs = 12_000): Promise<CommandResult> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: timeoutMs,
      env: { ...process.env, PATH: `/nix/store/npzhmbcn6mjbf31416bc6aga1c4lp2s8-replit-runtime-path/bin:/usr/bin:/bin:${process.env.PATH ?? ""}` },
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0, durationMs: Date.now() - start };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
    return {
      stdout: (e.stdout ?? "").trim(),
      stderr: (e.stderr ?? e.message ?? "unknown error").trim(),
      exitCode: e.code ?? 1,
      durationMs: Date.now() - start,
    };
  }
}

export async function curlProbe(url: string, timeoutSec = 8): Promise<CommandResult> {
  return executeCommand(
    `${CURL_PATH} -sf --max-time ${timeoutSec} --connect-timeout 5 -w "\\nHTTP/%{http_version} %{http_code} | latency: %{time_total}s | size: %{size_download}B" "${url}"`,
    (timeoutSec + 3) * 1000
  );
}

export async function curlRetry(url: string, retries = 3): Promise<CommandResult> {
  return executeCommand(
    `${CURL_PATH} -sf --max-time 10 --retry ${retries} --retry-delay 2 --retry-connrefused -w "\\nHTTP/%{http_version} %{http_code} | latency: %{time_total}s" "${url}"`,
    60_000
  );
}

export async function dnsLookup(host: string): Promise<CommandResult> {
  return executeCommand(
    `node -e "const s=Date.now();require('dns').promises.lookup('${host}').then(r=>{console.log('resolved: '+r.address+' in '+(Date.now()-s)+'ms')}).catch(e=>process.exit(1))"`,
    8_000
  );
}

export async function tcpCheck(host: string, port: number): Promise<CommandResult> {
  return executeCommand(
    `node -e "const n=require('net'),s=Date.now();const c=n.createConnection(${port},'${host}');c.setTimeout(5000);c.on('connect',()=>{console.log('TCP connected to ${host}:${port} in '+(Date.now()-s)+'ms');c.destroy()});c.on('timeout',()=>{console.error('TCP timeout');process.exit(1)});c.on('error',e=>{console.error('TCP error: '+e.message);process.exit(1)})"`,
    8_000
  );
}

export async function systemMetrics(): Promise<CommandResult> {
  return executeCommand(
    `node -e "const o=require('os'),p=process;const load=o.loadavg();const mem=o.freemem()/o.totalmem();const pmem=p.memoryUsage();console.log(JSON.stringify({load1:load[0].toFixed(3),load5:load[1].toFixed(3),cpuCount:o.cpus().length,memFreeGB:(o.freemem()/1e9).toFixed(2),memTotalGB:(o.totalmem()/1e9).toFixed(2),memFreePct:(mem*100).toFixed(1),processMB:(pmem.rss/1024/1024).toFixed(1),heapMB:(pmem.heapUsed/1024/1024).toFixed(1),uptimeSec:o.uptime().toFixed(0)}))"`,
    6_000
  );
}

export async function fileIOCheck(path: string): Promise<CommandResult> {
  return executeCommand(
    `node -e "const fs=require('fs/promises'),s=Date.now();const p='${path}';fs.writeFile(p,'healthcheck-'+Date.now()).then(()=>fs.readFile(p,'utf8')).then(d=>{console.log('file I/O OK in '+(Date.now()-s)+'ms, read: '+d.slice(0,20))}).catch(e=>{console.error(e.message);process.exit(1)})"`,
    6_000
  );
}

export async function tlsCheck(host: string, port = 443): Promise<CommandResult> {
  return executeCommand(
    `node -e "const tls=require('tls'),s=Date.now();const c=tls.connect({host:'${host}',port:${port},servername:'${host}'});c.setTimeout(6000);c.on('secureConnect',()=>{const cert=c.getPeerCertificate();const exp=new Date(cert.valid_to);const days=Math.floor((exp-new Date())/86400000);console.log('TLS OK for ${host}: cert expires '+cert.valid_to+' ('+days+' days), cipher: '+c.getCipher().name+', latency: '+(Date.now()-s)+'ms');c.destroy()});c.on('error',e=>{console.error('TLS error: '+e.message);process.exit(1)})"`,
    10_000
  );
}

export async function eventLoopLag(): Promise<CommandResult> {
  return executeCommand(
    `node -e "const samples=[];let i=0;function measure(){const s=Date.now();setImmediate(()=>{samples.push(Date.now()-s);if(++i<10)measure();else{const avg=(samples.reduce((a,b)=>a+b,0)/samples.length).toFixed(2);const max=Math.max(...samples);console.log('event loop lag: avg='+avg+'ms max='+max+'ms samples='+JSON.stringify(samples))}})};measure()"`,
    5_000
  );
}
