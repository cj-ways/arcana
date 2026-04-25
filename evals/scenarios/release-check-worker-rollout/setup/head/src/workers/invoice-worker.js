export function createInvoiceWorker(queueUrl) {
  return {
    name: "invoice-worker",
    queueUrl,
  };
}
