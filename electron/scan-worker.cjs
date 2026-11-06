const { parentPort, workerData } = require('node:worker_threads');
const { scanDirectory } = require('./scanner.cjs');
scanDirectory(workerData.path, { onProgress: data => parentPort.postMessage({ type: 'progress', data }) })
  .then(data => parentPort.postMessage({ type: 'done', data }))
  .catch(error => parentPort.postMessage({ type: 'error', message: error.message }));
