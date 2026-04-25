export function getInvoiceTotal(invoice) {
  if (!invoice) return 0;
  return invoice.items.reduce((sum, item) => sum + item.amountCents, 0);
}
