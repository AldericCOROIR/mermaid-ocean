// Save and verify the complete browser game for offline play.
function timeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Offline download timed out')), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function waitForActivation(worker) {
  if (worker.state === 'activated') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onState = () => {
      if (worker.state === 'activated') { worker.removeEventListener('statechange', onState); resolve(); }
      if (worker.state === 'redundant') { worker.removeEventListener('statechange', onState); reject(new Error('Offline installation failed')); }
    };
    worker.addEventListener('statechange', onState);
    onState();
  });
}

function askWorkerToSave(worker, onProgress) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Offline cache did not respond')); }, 300000);
    channel.port1.onmessage = ({ data }) => {
      if (data?.type === 'OFFLINE_PROGRESS') onProgress(data.done / data.total);
      if (data?.type === 'OFFLINE_DONE' || data?.type === 'OFFLINE_ERROR') {
        clearTimeout(timer);
        channel.port1.close();
        if (data.type === 'OFFLINE_DONE') resolve();
        else reject(new Error(data.error || 'Offline cache failed'));
      }
    };
    worker.postMessage({ type: 'SAVE_OFFLINE' }, [channel.port2]);
  });
}

export async function saveGameOffline(onProgress) {
  if (!isSecureContext || !('serviceWorker' in navigator) || !('caches' in window)) {
    throw new Error('Offline play needs a secure browser page');
  }
  const onInstallProgress = ({ data }) => {
    if (data?.type === 'OFFLINE_PROGRESS') onProgress(data.done / data.total);
  };
  navigator.serviceWorker.addEventListener('message', onInstallProgress);
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    if (registration.active) {
      try { await timeout(registration.update(), 300000); }
      catch { /* An already installed version can still be saved offline. */ }
    }
    if (registration.installing) await timeout(waitForActivation(registration.installing), 300000);
    const ready = await timeout(navigator.serviceWorker.ready, 300000);
    if (!ready.active) throw new Error('No active offline worker');
    await askWorkerToSave(ready.active, onProgress);
    try { await navigator.storage?.persist?.(); } catch { /* optional browser feature */ }
  } finally {
    navigator.serviceWorker.removeEventListener('message', onInstallProgress);
  }
}
