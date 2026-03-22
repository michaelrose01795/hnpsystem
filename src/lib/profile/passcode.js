import crypto from "crypto";

const PASSCODE_PATTERN = /^\d{4}$/;
const HASH_PREFIX = "scrypt";

export function isValidPasscode(passcode) {
  return PASSCODE_PATTERN.test(String(passcode || ""));
}

export function hashPasscode(passcode) {
  if (!isValidPasscode(passcode)) {
    throw new Error("Passcode must be exactly 4 digits.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(passcode), salt, 64).toString("hex");
  return `${HASH_PREFIX}$${salt}$${derived}`;
}

export function verifyPasscode(passcode, storedHash) {
  if (!isValidPasscode(passcode) || typeof storedHash !== "string") {
    return false;
  }

  const [prefix, salt, expectedHash] = storedHash.split("$");
  if (prefix !== HASH_PREFIX || !salt || !expectedHash) {
    return false;
  }

  const actualHash = crypto.scryptSync(String(passcode), salt, 64).toString("hex");
  const actualBuffer = Buffer.from(actualHash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
