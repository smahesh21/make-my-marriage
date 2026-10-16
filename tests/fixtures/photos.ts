// Generated on demand: no copyrighted images or large committed binaries.
export const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=",
  "base64",
);
export function photoFixtures() {
  const png = (name: string, buffer = tinyPng) => ({
    name,
    mimeType: "image/png",
    buffer,
  });
  return {
    valid: png("memory.png"),
    duplicate: png("another-memory.png"),
    oversized: png("over-limit.png", Buffer.alloc(10 * 1024 * 1024 + 1)),
    empty: png("empty.png", Buffer.alloc(0)),
    corrupt: png("corrupt.png", Buffer.from("Not an image")),
    mismatch: { ...png("wrong-extension.jpg"), mimeType: "image/png" },
    unsupported: {
      name: "unsupported.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    },
  };
}
