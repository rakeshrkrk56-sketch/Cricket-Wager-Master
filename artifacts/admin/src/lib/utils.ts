import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUserIdentifier(identifier?: string | null) {
  if (!identifier) return "—";
  if (!identifier.startsWith("guest:")) return identifier;

  // Keep the full fingerprint as the private server-side identity, but show
  // operators a compact, stable code instead of the long hash.
  return `Guest #${identifier.slice(-8).toUpperCase()}`;
}
