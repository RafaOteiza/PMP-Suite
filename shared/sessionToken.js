// Firebase getIdToken renews near-expiry tokens. Collapse concurrent SDK requests per identity.
export function createSessionToken(getUser) {
 let pending=null,owner=null,forced=null,forcedOwner=null;
 return async function token(force=false) {
  const user=getUser();
  if(!user)return null;
  if(forced&&forcedOwner===user)return forced;
  if(pending&&owner===user&&!force)return pending;
  if(force) {
   const before=pending&&owner===user?pending:Promise.resolve();
   const job=before.then(()=>getUser()===user?user.getIdToken(true):null).then(value=>getUser()===user?value:null);
   forcedOwner=user;forced=job;
   try{return await job;}finally{if(forced===job){forced=null;forcedOwner=null;}}
  }
  const job=Promise.resolve().then(()=>user.getIdToken(force));owner=user;pending=job;
  try {const value=await job;return getUser()===user?value:null;}
  finally {if(pending===job){pending=null;owner=null;}}
 };
}
export function sessionErrorKind(error) {
 const status=error?.response?.status,code=error?.response?.data?.code||error?.code;
 if(['TOKEN_REVOKED','INVALID_TOKEN','USER_DISABLED','AUTH_REQUIRED','USER_INACTIVE','IDENTITY_CONFLICT','auth/user-token-expired','auth/user-disabled','auth/invalid-user-token'].includes(code))return 'session';
 if(status===401)return 'expired';
 if(status===403)return 'permission';
 if(!error?.response)return 'network';
 return 'server';
}
