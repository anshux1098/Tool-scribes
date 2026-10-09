import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let hashCounter = 0;
const hashId = () => `ts_${++hashCounter}_${Date.now()}`;

export { hashId };
