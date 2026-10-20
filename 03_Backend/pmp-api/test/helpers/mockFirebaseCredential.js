import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function installMockFirebaseCredential() {
  const directory = mkdtempSync(join(tmpdir(), "pmp-firebase-test-"));
  const credentialPath = join(directory, "firebase-admin-test.json");
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" }
  });

  writeFileSync(
    credentialPath,
    JSON.stringify({
      type: "service_account",
      project_id: "pmp-suite-test",
      private_key_id: "mock-key-id",
      private_key: privateKey,
      client_email: "firebase-adminsdk-test@pmp-suite-test.iam.gserviceaccount.com",
      client_id: "000000000000000000000",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token"
    }),
    { encoding: "utf8", mode: 0o600 }
  );

  process.env.FIREBASE_SERVICE_ACCOUNT_PATH = credentialPath;

  return () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    rmSync(directory, { recursive: true, force: true });
  };
}
