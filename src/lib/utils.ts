import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility functions for the OpenMic app
 */

/**
 * Combines and merges Tailwind CSS classes
 * Uses clsx for conditional classes and twMerge to handle conflicts
 * 
 * @param inputs - Class names, conditional classes, arrays, objects
 * @returns Merged class string with Tailwind conflicts resolved
 * 
 * Example:
 * cn("px-4", "py-2", condition && "bg-blue-500", "px-6") 
 * // Returns: "py-2 bg-blue-500 px-6" (px-4 overridden by px-6)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
