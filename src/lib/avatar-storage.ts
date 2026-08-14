import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Only JPEG, PNG, WebP, and GIF images are allowed";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "Image must be 2 MB or smaller";
  }
  return null;
}

function uploadsDir() {
  return path.join(process.cwd(), "public", "uploads", "avatars");
}

export async function saveAvatarFile(userId: number, file: File): Promise<string> {
  const ext = EXT_BY_TYPE[file.type] ?? "jpg";
  const filename = `user-${userId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const dir = uploadsDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
    return `/uploads/avatars/${filename}`;
  } catch {
    const base64 = buffer.toString("base64");
    return `data:${file.type};base64,${base64}`;
  }
}

export async function deleteAvatarFile(avatarUrl: string | null | undefined) {
  if (!avatarUrl || avatarUrl.startsWith("data:")) return;

  if (!avatarUrl.startsWith("/uploads/avatars/")) return;

  const filename = path.basename(avatarUrl);
  const filePath = path.join(uploadsDir(), filename);

  try {
    await unlink(filePath);
  } catch {
    // File may already be gone
  }
}

export function toPublicUser(row: {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  avatarUrl?: string | null;
  createdAt: unknown;
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone ?? null,
    avatarUrl: row.avatarUrl ?? null,
    createdAt: row.createdAt ? String(row.createdAt) : "",
  };
}
