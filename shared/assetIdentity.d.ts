export const ASSET_IDENTITIES: Readonly<{VALIDADOR:{brand:string;prefixes:Readonly<Record<string,string>>};CONSOLA:{brand:string;model:string}}>;
export function assetIdentity(type: string, series: unknown): {status:'pending'|'valid'|'invalid';modelo:string;marca:string;message:string};
