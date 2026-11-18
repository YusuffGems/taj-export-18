export interface SyncConfig {
  workspace: string;
  firebase: {
    apiKey: string;
    projectId: string;
    appId: string;
    authDomain?: string;
    storageBucket?: string;
    messagingSenderId?: string;
  };
}

export interface SyncEnv {
  apiKey?: string;
  projectId?: string;
  appId?: string;
  workspace?: string;
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

export interface SyncSetup {
  config: SyncConfig | null;
  /** Names of required environment variables that are empty. */
  missing: string[];
  /** Why the secret code is unusable (only when it is set). */
  codeProblem: string | null;
  projectId: string | null;
}

const VAR_NAMES = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
  workspace: "NEXT_PUBLIC_WORKSPACE_CODE",
} as const;

/** Pure check of the build-time settings (unit-tested). */
export function analyzeSyncEnv(env: SyncEnv): SyncSetup {
  const missing = (Object.keys(VAR_NAMES) as (keyof typeof VAR_NAMES)[]).filter((k) => !env[k]?.trim()).map((k) => VAR_NAMES[k]);
  const code = env.workspace?.trim() ?? "";
  let codeProblem: string | null = null;
  if (code && code.length < 12) codeProblem = "The secret code is shorter than 12 characters.";
  else if (code && !/^[A-Za-z0-9_-]+$/.test(code)) codeProblem = "The secret code may only contain letters, numbers, - and _ (no spaces).";

  const ok = missing.length === 0 && !codeProblem;
  return {
    missing,
    codeProblem,
    projectId: env.projectId?.trim() || null,
    config: ok
      ? {
          workspace: code,
          firebase: {
            apiKey: env.apiKey!.trim(), projectId: env.projectId!.trim(), appId: env.appId!.trim(),
            authDomain: env.authDomain?.trim() || undefined,
            storageBucket: env.storageBucket?.trim() || undefined,
            messagingSenderId: env.messagingSenderId?.trim() || undefined,
          },
        }
      : null,
  };
}

/** Each variable is read literally so Next.js can inline it at build time. */
function readEnv(): SyncEnv {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    workspace: process.env.NEXT_PUBLIC_WORKSPACE_CODE,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
}

export function getSyncSetup(): SyncSetup {
  return analyzeSyncEnv(readEnv());
}

export function getSyncConfig(): SyncConfig | null {
  return getSyncSetup().config;
}
