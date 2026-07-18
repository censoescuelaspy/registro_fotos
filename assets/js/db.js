const DATABASE_NAME = 'cialpa-registro-fotos-v1';
const DATABASE_VERSION = 1;

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transaccion cancelada'));
  });
}

export class LocalDatabase {
  constructor() {
    this.database = null;
  }

  async open() {
    if (this.database) return this.database;
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('drafts')) {
        const store = database.createObjectStore('drafts', { keyPath: 'draftId' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!database.objectStoreNames.contains('blobs')) {
        database.createObjectStore('blobs', { keyPath: 'blobId' });
      }
      if (!database.objectStoreNames.contains('queue')) {
        const store = database.createObjectStore('queue', { keyPath: 'queueId' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    this.database = await requestAsPromise(request);
    return this.database;
  }

  async put(storeName, value) {
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    await transactionDone(transaction);
    return value;
  }

  async get(storeName, key) {
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readonly');
    return requestAsPromise(transaction.objectStore(storeName).get(key));
  }

  async getAll(storeName) {
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readonly');
    return requestAsPromise(transaction.objectStore(storeName).getAll());
  }

  async delete(storeName, key) {
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
    await transactionDone(transaction);
  }

  async saveDraft(draft) {
    return this.put('drafts', { ...draft, updatedAt: new Date().toISOString() });
  }

  async listDrafts() {
    const drafts = await this.getAll('drafts');
    return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveBlob(blob, metadata = {}) {
    const blobId = metadata.blobId || crypto.randomUUID();
    await this.put('blobs', { blobId, blob, ...metadata, savedAt: new Date().toISOString() });
    return blobId;
  }

  getBlob(blobId) { return this.get('blobs', blobId); }
  deleteBlob(blobId) { return this.delete('blobs', blobId); }

  async enqueue(action, payload, queueId = crypto.randomUUID()) {
    return this.put('queue', {
      queueId,
      action,
      payload,
      attempts: 0,
      lastError: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  async listQueue() {
    const items = await this.getAll('queue');
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async markQueueError(item, message) {
    return this.put('queue', {
      ...item,
      attempts: Number(item.attempts || 0) + 1,
      lastError: String(message || '').slice(0, 500),
      updatedAt: new Date().toISOString()
    });
  }

  deleteQueue(queueId) { return this.delete('queue', queueId); }
}
