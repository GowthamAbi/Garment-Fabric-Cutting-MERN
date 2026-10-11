export const SESSION_IDLE_MS=30*60*1000;
export function sessionIsIdle(lastActivity,issuedAt,now=Date.now()){
 const last=lastActivity?new Date(lastActivity).getTime():Number(issuedAt)*1000;
 return !Number.isFinite(last)||last>now||now-last>=SESSION_IDLE_MS;
}
