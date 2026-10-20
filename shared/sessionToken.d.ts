export function createSessionToken(getUser:()=>{getIdToken:(force?:boolean)=>Promise<string>}|null): (force?:boolean)=>Promise<string|null>;
export function sessionErrorKind(error:unknown):'session'|'expired'|'permission'|'network'|'server';
