import { isNativeIos } from "@/lib/native/platform";

export type AppleSignInResult = {
  identityToken: string;
  user: string;
  email?: string;
  givenName?: string;
  familyName?: string;
};

export async function signInWithAppleNative(): Promise<AppleSignInResult> {
  if (!isNativeIos()) {
    throw new Error("Sign in with Apple native is only available in the iOS app");
  }
  const mod = await import("@capacitor-community/apple-sign-in");
  const response = await mod.SignInWithApple.authorize({
    clientId: process.env.NEXT_PUBLIC_APPLE_SERVICE_ID || "com.estrellita.management",
    redirectURI: `${window.location.origin}/api/auth/apple`,
    scopes: "email name",
    nonce: crypto.randomUUID(),
  });
  const identityToken = response.response.identityToken;
  if (!identityToken) throw new Error("Apple did not return an identity token");
  return {
    identityToken,
    user: response.response.user,
    email: response.response.email,
    givenName: response.response.givenName,
    familyName: response.response.familyName,
  };
}

export async function signInWithAppleWeb(): Promise<AppleSignInResult> {
  if (typeof window === "undefined" || !("AppleID" in window)) {
    throw new Error("Apple JS SDK is not loaded");
  }
  const AppleID = (window as unknown as { AppleID: { auth: { signIn: () => Promise<{ authorization?: { id_token?: string; code?: string }; user?: { email?: string; name?: { firstName?: string; lastName?: string } } }> } } }).AppleID;
  const response = await AppleID.auth.signIn();
  const identityToken = response.authorization?.id_token;
  if (!identityToken) throw new Error("Apple web sign-in returned no identity token");
  return {
    identityToken,
    user: "",
    email: response.user?.email,
    givenName: response.user?.name?.firstName,
    familyName: response.user?.name?.lastName,
  };
}
