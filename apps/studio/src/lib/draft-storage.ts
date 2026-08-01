import { parseSourceGame, type SourceGame, type SourceGameFiles } from '@rpgcrafter/game-schema';

export const DRAFT_DATABASE_NAME = 'rpgcrafter-studio';
export const DRAFT_DOCUMENTS = [
  'manifest.json', 'tilesets.json', 'maps.json', 'actors.json', 'enemies.json', 'skills.json',
  'items.json', 'quests.json', 'ui.json', 'events.json', 'initial-state.json',
] as const;

export type DraftDocumentName = typeof DRAFT_DOCUMENTS[number];

type ProjectRecord = {
  id: string;
  schema: 1;
  sourceSchemaVersion?: string;
  gameId: string;
  gameVersion: string;
  revision: number;
  updatedAt: number;
  documentNames: DraftDocumentName[];
};

type DocumentRecord = {
  projectId: string;
  name: DraftDocumentName;
  revision: number;
  value: unknown;
};
type AssetRecord = { projectId: string; path: string; blob: Blob };
export type ProjectAssets = Record<string, Blob>;
export type RecentProject = { id: string; gameId: string; gameVersion: string; title: string; updatedAt: number };

type DraftRepositoryOptions = {
  factory?: IDBFactory;
  databaseName?: string;
  now?: () => number;
};

const DOCUMENT_KEYS: Record<DraftDocumentName, keyof SourceGameFiles> = {
  'manifest.json': 'manifest',
  'tilesets.json': 'tilesets',
  'maps.json': 'maps',
  'actors.json': 'actors',
  'enemies.json': 'enemies',
  'skills.json': 'skills',
  'items.json': 'items',
  'quests.json': 'quests',
  'ui.json': 'ui',
  'events.json': 'events',
  'initial-state.json': 'initialState',
};

export function draftProjectId(game: SourceGame) {
  return `${game.manifest.gameId}:${game.manifest.version}`;
}

function sourceFiles(game: SourceGame): SourceGameFiles {
  return {
    manifest: game.manifest, tilesets: game.tilesets, maps: game.maps, actors: game.actors, enemies: game.enemies,
    skills: game.skills, items: game.items, quests: game.quests, ui: game.ui,
    events: game.events, initialState: game.initialState,
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error || new Error('IndexedDB request failed.')), { once: true });
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('IndexedDB transaction was aborted.')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error || new Error('IndexedDB transaction failed.')), { once: true });
  });
}

export function createDraftRepository(options: DraftRepositoryOptions = {}) {
  const factory = options.factory || indexedDB;
  const databaseName = options.databaseName || DRAFT_DATABASE_NAME;
  const now = options.now || Date.now;
  let databasePromise: Promise<IDBDatabase> | null = null;
  let operationQueue: Promise<void> = Promise.resolve();

  const openDatabase = () => {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = factory.open(databaseName, 2);
      request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('projects')) database.createObjectStore('projects', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('documents')) {
          const documents = database.createObjectStore('documents', { keyPath: ['projectId', 'name'] });
          documents.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!database.objectStoreNames.contains('assets')) {
          const assets = database.createObjectStore('assets', { keyPath: ['projectId', 'path'] });
          assets.createIndex('projectId', 'projectId', { unique: false });
        }
      });
      request.addEventListener('success', () => {
        const database = request.result;
        database.addEventListener('versionchange', () => { database.close(); databasePromise = null; });
        resolve(database);
      }, { once: true });
      request.addEventListener('error', () => { databasePromise = null; reject(request.error || new Error('Could not open IndexedDB.')); }, { once: true });
      request.addEventListener('blocked', () => { databasePromise = null; reject(new Error('IndexedDB upgrade is blocked by another Studio tab.')); }, { once: true });
    });
    return databasePromise;
  };

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = operationQueue.catch(() => undefined).then(operation);
    operationQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  const save = (game: SourceGame, changedDocuments: readonly DraftDocumentName[] = DRAFT_DOCUMENTS) => {
    const snapshot = structuredClone(game);
    const requestedDocuments = [...new Set(changedDocuments)];
    return enqueue(async () => {
      const database = await openDatabase();
      const transaction = database.transaction(['projects', 'documents'], 'readwrite');
      const projects = transaction.objectStore('projects');
      const documents = transaction.objectStore('documents');
      const id = draftProjectId(snapshot);
      const existing = await requestResult(projects.get(id)) as ProjectRecord | undefined;
      const initialize = !existing
        || existing.documentNames.length !== DRAFT_DOCUMENTS.length
        || existing.sourceSchemaVersion !== snapshot.manifest.schemaVersion;
      const names = initialize ? [...DRAFT_DOCUMENTS] : requestedDocuments;
      const revision = (existing?.revision || 0) + 1;
      const files = sourceFiles(snapshot) as Record<keyof SourceGameFiles, unknown>;
      for (const name of names) documents.put({ projectId: id, name, revision, value: files[DOCUMENT_KEYS[name]] } satisfies DocumentRecord);
      projects.put({
        id, schema: 1, sourceSchemaVersion: snapshot.manifest.schemaVersion,
        gameId: snapshot.manifest.gameId, gameVersion: snapshot.manifest.version,
        revision, updatedAt: now(), documentNames: [...DRAFT_DOCUMENTS],
      } satisfies ProjectRecord);
      await transactionDone(transaction);
    });
  };

  const restore = (source: SourceGame) => enqueue(async () => {
    const database = await openDatabase();
    const transaction = database.transaction(['projects', 'documents'], 'readonly');
    const id = draftProjectId(source);
    const project = await requestResult(transaction.objectStore('projects').get(id)) as ProjectRecord | undefined;
    if (!project || project.schema !== 1 || project.gameId !== source.manifest.gameId || project.gameVersion !== source.manifest.version) {
      await transactionDone(transaction);
      return null;
    }
    const records = await requestResult(transaction.objectStore('documents').index('projectId').getAll(id)) as DocumentRecord[];
    await transactionDone(transaction);
    if (records.length !== DRAFT_DOCUMENTS.length) return null;
    const files = sourceFiles(source) as Record<keyof SourceGameFiles, unknown>;
    for (const record of records) files[DOCUMENT_KEYS[record.name]] = record.value;
    const result = parseSourceGame(files as unknown as SourceGameFiles);
    return result.success ? result.data : null;
  });

  const saveAssets = (game: SourceGame, assets: ProjectAssets) => enqueue(async () => {
    const database = await openDatabase();
    const transaction = database.transaction('assets', 'readwrite');
    const store = transaction.objectStore('assets');
    for (const [path, blob] of Object.entries(assets)) store.put({ projectId: draftProjectId(game), path, blob } satisfies AssetRecord);
    await transactionDone(transaction);
  });

  const restoreAssets = (game: SourceGame) => enqueue(async () => {
    const database = await openDatabase();
    const transaction = database.transaction('assets', 'readonly');
    const records = await requestResult(transaction.objectStore('assets').index('projectId').getAll(draftProjectId(game))) as AssetRecord[];
    await transactionDone(transaction);
    return Object.fromEntries(records.map(record => [record.path, record.blob])) as ProjectAssets;
  });

  const listProjects = () => enqueue(async () => {
    const database = await openDatabase();
    const transaction = database.transaction(['projects', 'documents'], 'readonly');
    const projects = await requestResult(transaction.objectStore('projects').getAll()) as ProjectRecord[];
    const documents = transaction.objectStore('documents');
    const result: RecentProject[] = [];
    for (const project of projects) {
      const manifest = await requestResult(documents.get([project.id, 'manifest.json'])) as DocumentRecord | undefined;
      const title = (manifest?.value as { title?: string } | undefined)?.title || project.gameId;
      result.push({ id: project.id, gameId: project.gameId, gameVersion: project.gameVersion, title, updatedAt: project.updatedAt });
    }
    await transactionDone(transaction);
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  });

  const openProject = (id: string) => enqueue(async () => {
    const database = await openDatabase();
    const transaction = database.transaction(['documents', 'assets'], 'readonly');
    const documentRecords = await requestResult(transaction.objectStore('documents').index('projectId').getAll(id)) as DocumentRecord[];
    const assetRecords = await requestResult(transaction.objectStore('assets').index('projectId').getAll(id)) as AssetRecord[];
    await transactionDone(transaction);
    if (documentRecords.length !== DRAFT_DOCUMENTS.length) return null;
    const files: Partial<SourceGameFiles> = {};
    for (const record of documentRecords) files[DOCUMENT_KEYS[record.name]] = record.value;
    const parsed = parseSourceGame(files as SourceGameFiles);
    if (!parsed.success) return null;
    return { game: parsed.data, assets: Object.fromEntries(assetRecords.map(record => [record.path, record.blob])) as ProjectAssets };
  });

  const clear = (game: SourceGame) => enqueue(async () => {
    const database = await openDatabase();
    const transaction = database.transaction(['projects', 'documents', 'assets'], 'readwrite');
    const id = draftProjectId(game);
    transaction.objectStore('projects').delete(id);
    const index = transaction.objectStore('documents').index('projectId');
    const cursorRequest = index.openKeyCursor(id);
    cursorRequest.addEventListener('success', () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      transaction.objectStore('documents').delete(cursor.primaryKey);
      cursor.continue();
    });
    const assetIndex = transaction.objectStore('assets').index('projectId');
    const assetCursorRequest = assetIndex.openKeyCursor(id);
    assetCursorRequest.addEventListener('success', () => {
      const cursor = assetCursorRequest.result;
      if (!cursor) return;
      transaction.objectStore('assets').delete(cursor.primaryKey);
      cursor.continue();
    });
    await transactionDone(transaction);
  });

  const close = async () => {
    await operationQueue;
    const database = await databasePromise;
    database?.close();
    databasePromise = null;
  };

  return { save, restore, saveAssets, restoreAssets, listProjects, openProject, clear, close };
}

const defaultRepository = createDraftRepository();

export const saveDraft = defaultRepository.save;
export const restoreDraft = defaultRepository.restore;
export const saveProjectAssets = defaultRepository.saveAssets;
export const restoreProjectAssets = defaultRepository.restoreAssets;
export const listRecentProjects = defaultRepository.listProjects;
export const openRecentProject = defaultRepository.openProject;
export const clearDraft = defaultRepository.clear;
