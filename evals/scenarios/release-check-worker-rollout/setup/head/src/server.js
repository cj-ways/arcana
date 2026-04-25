export function startServer() {
  return {
    port: process.env.PORT || 3000,
    queueUrl: process.env.QUEUE_URL,
  };
}
