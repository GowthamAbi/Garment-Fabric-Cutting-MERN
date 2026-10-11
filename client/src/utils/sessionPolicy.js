export const IDLE_TIMEOUT_MS=30*60*1000;
export function idleExpired(lastActivity,now=Date.now()){
 return !Number.isFinite(lastActivity)||lastActivity>now||now-lastActivity>=IDLE_TIMEOUT_MS;
}
