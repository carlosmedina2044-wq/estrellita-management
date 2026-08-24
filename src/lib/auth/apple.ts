import { createRemoteJWKSet, jwtVerify } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export type AppleIdentity = {
  appleUserId: string;
  email?: string;
  emailHidden: boolean;
};

export async function verifyAppleIdentityToken(identityToken: string): Promise<AppleIdentity> {
  const audiences = [process.env.APPLE_BUNDLE_ID, process.env.APPLE_SERVICE_ID].filter(
    (value): value is string => Boolean(value),
  );
  if (audiences.length === 0) {
    throw new Error("APPLE_BUNDLE_ID or APPLE_SERVICE_ID is not configured");
  }
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    issuer: APPLE_ISSUER,
    audience: audiences,
  });
  const appleUserId = typeof payload.sub === "string" ? payload.sub : "";
  if (!appleUserId) throw new Error("Apple token missing sub");
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const emailHidden = payload.email_verified === true && Boolean(email?.endsWith("@privaterelay.appleid.com"));
  return { appleUserId, email, emailHidden };
}
