export function serializeUser(user) {
  return {
    userId: user.id,
    accountName: user.accountName,
  };
}
