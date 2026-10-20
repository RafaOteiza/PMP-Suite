import admin from "firebase-admin";
import fs from "fs";

const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!path || !fs.existsSync(path)) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH missing or file not found");
}

const serviceAccount = JSON.parse(fs.readFileSync(path, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export default admin;