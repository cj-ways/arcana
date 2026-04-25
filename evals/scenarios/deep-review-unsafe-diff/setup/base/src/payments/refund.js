export async function markRefundComplete(db, refundId, status) {
  return db.query(
    "UPDATE refunds SET status = $1 WHERE id = $2",
    [status, refundId]
  );
}
