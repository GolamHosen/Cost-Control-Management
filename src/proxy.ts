import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "buildledger-secret-key-default-change-me-32-chars!"
);

const COOKIE_NAME = "buildledger_session";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/seed",
  "/api/health",
];

// Routes that only admins (and managers) can access
const ADMIN_ONLY_PATHS = ["/dashboard", "/team"];

function getJose() {
  try {
    const req = eval("require");
    return req("jose");
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths & static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const jose = getJose();
  if (!jose) {
    // If jose is not yet installed in node_modules, bypass check gracefully
    return NextResponse.next();
  }

  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    const role = payload.role as string;

    // Members cannot access admin-only pages (dashboard, team management)
    if (
      role === "member" &&
      ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))
    ) {
      return NextResponse.redirect(new URL("/projects", req.url));
    }

    return NextResponse.next();
  } catch {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
