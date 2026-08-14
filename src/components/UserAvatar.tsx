import Image from "next/image";
import { getAvatarColor, getInitials } from "./Sidebar";

type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZE_CLASSES = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-24 w-24 text-2xl",
};

const SIZE_PIXELS = {
  xs: 28,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 96,
};

export default function UserAvatar({
  name,
  avatarUrl,
  size = "sm",
  className = "",
}: UserAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`flex-shrink-0 rounded-full object-cover ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white ${sizeClass} ${getAvatarColor(name)} ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
