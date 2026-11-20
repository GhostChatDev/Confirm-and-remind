const DB = 'confirm-remind-drafts';
let pending: Promise<void> = Promise.resolve();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Draft database is blocked'));
  });
}

export async function readDraft(key: string): Promise<string> {
  await pending;
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readonly');
    const request = tx.objectStore('drafts').get(key);
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : '');
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

// Serialize writes so a slower earlier keystroke cannot overwrite a later one,
// including the clearing write after a note is saved.
export function writeDraft(key: string, value: string): Promise<void> {
  const operation = pending.then(async () => {
    const db = await open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      if (value) tx.objectStore('drafts').put(value, key);
      else tx.objectStore('drafts').delete(key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  });
  pending = operation.catch(() => {});
  return operation;
}
