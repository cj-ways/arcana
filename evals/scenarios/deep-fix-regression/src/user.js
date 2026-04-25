export function getPrimaryEmail(user) {
  return user.emails[0].toLowerCase();
}
