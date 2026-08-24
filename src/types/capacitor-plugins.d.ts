declare module "@capacitor-community/apple-sign-in" {
  export const SignInWithApple: {
    authorize(options: {
      clientId: string;
      redirectURI: string;
      scopes: string;
      nonce: string;
    }): Promise<{
      response: {
        identityToken?: string;
        user: string;
        email?: string;
        givenName?: string;
        familyName?: string;
      };
    }>;
  };
}

declare module "@capgo/capacitor-native-biometric" {
  export const NativeBiometric: {
    isAvailable(): Promise<{ isAvailable: boolean }>;
    verifyIdentity(options: {
      reason: string;
      title: string;
      subtitle: string;
      useFallback: boolean;
    }): Promise<void>;
  };
}

declare module "capacitor-secure-storage-plugin" {
  export const SecureStoragePlugin: {
    set(options: { key: string; value: string }): Promise<void>;
    get(options: { key: string }): Promise<{ value?: string }>;
    remove(options: { key: string }): Promise<void>;
  };
}

declare module "@capacitor/cli" {
  export type CapacitorConfig = {
    appId: string;
    appName: string;
    webDir: string;
    server?: { androidScheme?: string; iosScheme?: string; url?: string };
    ios?: {
      contentInset?: string;
      preferredContentMode?: string;
      limitsNavigationsToAppBoundDomains?: boolean;
    };
    plugins?: Record<string, object>;
  };
}
