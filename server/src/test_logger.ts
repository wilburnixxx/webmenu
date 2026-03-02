import fs from 'fs';
process.on('uncaughtException', (err) => {
    fs.appendFileSync('server_error_log.txt', err.stack + '\n');
});
// This is not a real tool, just a scratchpad thought.
