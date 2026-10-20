import {EmailAuthProvider,reauthenticateWithCredential,updatePassword,validatePassword} from 'firebase/auth';
import {auth} from './firebase';

function failure(code,message){const error=new Error(message);error.code=code;return error;}
export function passwordProviderAvailable(expectedUid){
 const user=auth.currentUser;
 return !!(expectedUid&&user?.uid===expectedUid&&user.email&&user.providerData.some(p=>p.providerId==='password'));
}
function currentAccount(expectedUid){
 const user=auth.currentUser;
 if(!expectedUid||!user||user.uid!==expectedUid)throw failure('pmp/session','La sesión cambió o caducó. Vuelve a iniciar sesión antes de cambiar tu contraseña.');
 if(!passwordProviderAvailable(expectedUid))throw failure('pmp/provider','Esta cuenta utiliza otro proveedor de acceso. La contraseña debe gestionarse con ese proveedor.');
 return user;
}
function policyMessage(status){
 const requirements=[],strength=status.passwordPolicy?.customStrengthOptions;
 if(status.meetsMinPasswordLength===false)requirements.push(`al menos ${strength?.minPasswordLength} caracteres`);
 if(status.meetsMaxPasswordLength===false)requirements.push(`como máximo ${strength?.maxPasswordLength} caracteres`);
 if(status.containsLowercaseLetter===false)requirements.push('una letra minúscula');
 if(status.containsUppercaseLetter===false)requirements.push('una letra mayúscula');
 if(status.containsNumericCharacter===false)requirements.push('un número');
 if(status.containsNonAlphanumericCharacter===false)requirements.push('un símbolo permitido');
 return requirements.length?`La nueva contraseña debe incluir ${requirements.join(', ')}.`:'La nueva contraseña no cumple la política de seguridad vigente.';
}
export function passwordErrorMessage(error){
 if(['pmp/required','pmp/mismatch','pmp/policy','pmp/session','pmp/provider'].includes(error?.code))return error.message;
 return ({
  'auth/wrong-password':'La contraseña actual es incorrecta. Revísala e intenta nuevamente.',
  'auth/invalid-credential':'No se pudo verificar la contraseña actual. Revísala e intenta nuevamente.',
  'auth/invalid-login-credentials':'No se pudo verificar la contraseña actual. Revísala e intenta nuevamente.',
  'auth/network-request-failed':'No hay conexión con el servicio de seguridad. Revisa tu conexión e intenta nuevamente.',
  'auth/too-many-requests':'Hay demasiados intentos. Espera unos minutos antes de reintentar.',
  'auth/requires-recent-login':'La sesión necesita verificarse nuevamente. Vuelve a iniciar sesión.',
  'auth/user-token-expired':'La sesión caducó. Vuelve a iniciar sesión.',
  'auth/invalid-user-token':'La sesión ya no es válida. Vuelve a iniciar sesión.',
  'auth/user-disabled':'La cuenta está deshabilitada. Contacta al administrador.',
  'auth/user-not-found':'La cuenta ya no está disponible. Vuelve a iniciar sesión.',
  'auth/user-mismatch':'La sesión cambió. Vuelve a iniciar sesión con tu cuenta.',
  'auth/weak-password':'La nueva contraseña no cumple la política de seguridad vigente.',
  'auth/password-does-not-meet-requirements':'La nueva contraseña no cumple la política de seguridad vigente.',
  'auth/operation-not-allowed':'El proveedor de esta cuenta no permite cambiar la contraseña desde PMP.',
  'auth/multi-factor-auth-required':'La cuenta requiere verificación adicional. Este formulario no admite ese factor; utiliza el mecanismo autorizado de tu organización.',
 })[error?.code]||'No se pudo confirmar el cambio de contraseña. Intenta nuevamente; si el problema continúa, contacta al administrador.';
}

// No API own/backend calls, persistence, logging or alternate account selection.
// Passwords exist only in the form and the official Firebase credential/update calls.
export async function changeOwnPassword({expectedUid,currentPassword,newPassword,confirmation}){
 if(!currentPassword||!newPassword||!confirmation)throw failure('pmp/required','Completa los tres campos de contraseña.');
 if(newPassword!==confirmation)throw failure('pmp/mismatch','La nueva contraseña y su confirmación no coinciden.');
 const user=currentAccount(expectedUid);
 const policy=await validatePassword(auth,newPassword);
 if(!policy.isValid)throw failure('pmp/policy',policyMessage(policy));
 if(currentAccount(expectedUid)!==user)throw failure('pmp/session','La sesión cambió. Vuelve a iniciar sesión.');
 await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,currentPassword));
 if(currentAccount(expectedUid)!==user)throw failure('pmp/session','La sesión cambió. Vuelve a iniciar sesión.');
 await updatePassword(user,newPassword);
}
