const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("./secrets");

const guestSupportSecret = getJwtSecret();
const GUEST_SUPPORT_TOKEN_TYPE = "support_guest";

function buildGuestRoomId() {
  return `guest:${crypto.randomBytes(18).toString("base64url")}`;
}

function issueGuestSupportSession(existingRoomId) {
  const roomId = existingRoomId || buildGuestRoomId();
  const guestToken = jwt.sign(
    {
      type: GUEST_SUPPORT_TOKEN_TYPE,
      roomId,
    },
    guestSupportSecret,
    { expiresIn: "30d" },
  );

  return { roomId, guestToken };
}

function verifyGuestSupportSession(guestToken) {
  if (!guestToken || typeof guestToken !== "string") return null;

  try {
    const payload = jwt.verify(guestToken, guestSupportSecret);
    if (payload?.type !== GUEST_SUPPORT_TOKEN_TYPE) return null;
    if (typeof payload?.roomId !== "string") return null;
    if (!/^guest:[A-Za-z0-9_-]{16,}$/.test(payload.roomId)) return null;
    return { roomId: payload.roomId, guestToken };
  } catch {
    return null;
  }
}

module.exports = {
  issueGuestSupportSession,
  verifyGuestSupportSession,
};