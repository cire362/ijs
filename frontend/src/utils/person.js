export function personName(user) {
  if (!user) return "";
  return (
    user.fullName ||
    [user.lastName, user.firstName, user.middleName]
      .filter(Boolean)
      .join(" ") ||
    user.name ||
    ""
  );
}
