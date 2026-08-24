// Runs automatically before `npm run dev` (predev) - frees the configured
// PORT if a previous `nodemon`/`node server.js` process got left running
// (e.g. a crashed terminal), which otherwise fails the next start with
// EADDRINUSE. Reads PORT the same way server.js does, so this always
// targets the actual port the dev server is about to bind to.
require('dotenv').config();
const kill = require('kill-port');

const port = process.env.PORT || 5000;

kill(port)
  .then(() => console.log(`predev: freed port ${port} (a previous process was still using it).`))
  .catch(() => {
    // kill-port rejects when nothing is listening on the port - that's the
    // common case, not a failure. Never block `npm run dev` on this either
    // way.
  });
