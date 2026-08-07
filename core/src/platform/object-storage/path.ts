import path from "node:path";

export function resolveObjectStoragePath(root: string, objectKey: string) {
  const normalizedKey = objectKey.trim();
  const segments = normalizedKey.split(/[\\/]+/);
  if (
    !normalizedKey ||
    path.isAbsolute(normalizedKey) ||
    segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\0"))
  ) {
    throw new Error("Object key must be a safe relative path");
  }

  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, ...segments);
  const relativePath = path.relative(resolvedRoot, resolvedPath);
  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Object key must stay within the object storage root");
  }

  return resolvedPath;
}
