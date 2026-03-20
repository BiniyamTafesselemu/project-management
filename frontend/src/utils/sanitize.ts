import DOMPurify from "dompurify";

/**
 * Strips all HTML tags from untrusted strings before rendering.
 * React's JSX escaping already prevents XSS for text nodes, but this
 * provides defense-in-depth against misuse (e.g. dangerouslySetInnerHTML).
 */
export function sanitize(value: string): string {
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });
}
