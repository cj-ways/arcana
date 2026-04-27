export function canActivateInvite({ approvalState, seatAvailable }) {
  return approvalState === "approved" && seatAvailable === true;
}
