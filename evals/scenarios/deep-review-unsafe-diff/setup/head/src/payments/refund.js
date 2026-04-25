export async function markRefundComplete(db, refundId, status) {
  return db.query(
    `UPDATE refunds SET status = '${status}' WHERE id = ${refundId}`
  );
}
