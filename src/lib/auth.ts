import { cookies } from "next/headers";
import * as jose from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "buildledger-secret-key-default-change-me-32-chars!"
);

const COOKIE_NAME = "buildledger_session";

export interface SessionPayload {
  userId: number;
  email: string;
  name: string;
  role: "admin" | "manager" | "member";
}

// ----------------------------------------------------------------------------
// Password Hashing using Web Crypto API (SHA-256 + Salt)
// ----------------------------------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const enc = new TextEncoder();
  const keyBuffer = enc.encode(password + saltHex);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyBuffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, originalHash] = storedHash.split(":");
  if (!saltHex || !originalHash) return false;

  const enc = new TextEncoder();
  const keyBuffer = enc.encode(password + saltHex);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyBuffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex === originalHash;
}

// ----------------------------------------------------------------------------
// Session JWT Management — Vercel Edge & Serverless Ready
// ----------------------------------------------------------------------------
export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
