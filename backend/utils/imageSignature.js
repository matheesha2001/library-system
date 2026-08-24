// Minimal magic-byte (file signature) detector for the image formats this
// app accepts. Hand-rolled instead of pulling in a general-purpose
// file-type-sniffing library: those parse dozens of container formats
// (video, archives, etc.) this app will never accept, which is unnecessary
// parsing surface for code whose whole job is validating untrusted uploads -
// each signature check here is only a handful of fixed byte comparisons, so
// there's no room for that class of bug.
//
// Single source of truth for both the cheap client-mimetype pre-check in
// profileRoutes.js's fileFilter and the extension actually used once a
// file's real content has been verified.
const SUPPORTED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

function matchesBytes(buffer, offset, bytes) {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

// One signature test per accepted mimetype, checked against the file's
// actual leading bytes - never the client-supplied filename or Content-Type.
const SIGNATURE_TESTS = {
  'image/jpeg': (buf) => matchesBytes(buf, 0, [0xff, 0xd8, 0xff]),
  'image/png': (buf) => matchesBytes(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  // GIF87a or GIF89a
  'image/gif': (buf) =>
    matchesBytes(buf, 0, [0x47, 0x49, 0x46, 0x38]) && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61,
  // RIFF....WEBP - bytes 4-7 are the container's file size, which we don't care about
  'image/webp': (buf) => matchesBytes(buf, 0, [0x52, 0x49, 0x46, 0x46]) && matchesBytes(buf, 8, [0x57, 0x45, 0x42, 0x50]),
};

// Detects the real image type from a buffer's leading bytes and returns the
// matching file extension (e.g. '.png'), or null if the content doesn't
// match any accepted signature - regardless of what the upload claimed to be.
function detectImageExtension(buffer) {
  const mime = Object.keys(SIGNATURE_TESTS).find((m) => SIGNATURE_TESTS[m](buffer));
  return mime ? SUPPORTED_IMAGE_TYPES[mime] : null;
}

module.exports = { SUPPORTED_IMAGE_TYPES, detectImageExtension };
