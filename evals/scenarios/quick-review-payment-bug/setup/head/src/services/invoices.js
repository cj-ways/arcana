export function getInvoiceTotal(invoice) {
  return invoice.items.reduce((sum, item) => sum + item.amountCents, 0);
}
