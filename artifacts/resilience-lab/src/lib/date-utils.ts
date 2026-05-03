import React from "react";
import { formatDistanceToNow } from "date-fns";

export function formatRelativeTime(dateString: string) {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Unknown";
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (e) {
    return "Unknown";
  }
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
