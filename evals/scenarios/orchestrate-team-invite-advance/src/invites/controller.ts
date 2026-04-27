export function buildInviteResponse(invite) {
  return {
    id: invite.id,
    approvalState: invite.approvalState,
    seatReserved: false,
  };
}
