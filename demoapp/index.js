const buildApp = require('./app.js');

const app = buildApp();

app.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) throw err
  // Server is now listening on ${address}
});
