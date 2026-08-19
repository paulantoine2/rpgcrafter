import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { assertSourceGame, type SourceGame } from '@rpgcrafter/game-schema';
import { describe, expect, it } from 'vitest';
import { createDraftRepository, DRAFT_DOCUMENTS } from '../src/lib/draft-storage';

const root = resolve(process.cwd(), '../../content/reference-game');
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
function sourceGame(): SourceGame {
  return assertSourceGame({
    manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
    skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'),
    events: read('events.json'), initialState: read('initial-state.json'),
  });
}

function openDatabase(factory: IDBFactory, name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function count(store: IDBObjectStore) {
  return new Promise<number>((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function changeDocument(database: IDBDatabase, projectId: string, name: string, change: (value: any) => any) {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('documents', 'readwrite');
    const store = transaction.objectStore('documents');
    const request = store.get([projectId, name]);
    request.onsuccess = () => store.put({ ...request.result, value: change(request.result.value) });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

describe('IndexedDB draft repository', () => {
  it('stores one record per JSON document and restores the complete game', async () => {
    const factory = new IDBFactory();
    const databaseName = 'draft-complete';
    const repository = createDraftRepository({ factory, databaseName, now: () => 123 });
    const game = sourceGame();
    await repository.save(game, ['maps.json']);
    expect(await repository.restore(game)).toEqual(game);
    await repository.close();

    const database = await openDatabase(factory, databaseName);
    const transaction = database.transaction(['projects', 'documents'], 'readonly');
    expect(await count(transaction.objectStore('projects'))).toBe(1);
    expect(await count(transaction.objectStore('documents'))).toBe(DRAFT_DOCUMENTS.length);
    database.close();
  });

  it('updates only the requested documents after initialization', async () => {
    const repository = createDraftRepository({ factory: new IDBFactory(), databaseName: 'draft-targeted' });
    const source = sourceGame();
    await repository.save(source);
    const changed = structuredClone(source);
    changed.maps[1].name = 'Changed map';
    changed.events.objectives[0].text = 'Changed event data';
    await repository.save(changed, ['maps.json']);
    const restored = await repository.restore(source);
    expect(restored?.maps[1].name).toBe('Changed map');
    expect(restored?.events).toEqual(source.events);
  });

  it('rewrites every document when upgrading a draft created by an older schema', async () => {
    const factory = new IDBFactory();
    const databaseName = 'draft-schema-upgrade';
    const repository = createDraftRepository({ factory, databaseName });
    const source = sourceGame();
    await repository.save(source);
    await repository.close();

    const database = await openDatabase(factory, databaseName);
    const transaction = database.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');
    const projectId = `${source.manifest.gameId}:${source.manifest.version}`;
    const record = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = store.get(projectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    delete record.sourceSchemaVersion;
    store.put(record);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();

    const changed = structuredClone(source);
    changed.maps[1].name = 'Schema-upgraded map';
    changed.events.objectives[0].text = 'Schema-upgraded objective';
    await repository.save(changed, ['maps.json']);
    const restored = await repository.restore(source);
    expect(restored?.maps[1].name).toBe('Schema-upgraded map');
    expect(restored?.events.objectives[0].text).toBe('Schema-upgraded objective');
  });

  it('opens and migrates a legacy draft without a types document', async () => {
    const factory = new IDBFactory();
    const databaseName = 'draft-legacy-types';
    const repository = createDraftRepository({ factory, databaseName });
    const source = sourceGame();
    await repository.save(source);
    await repository.close();
    const projectId = `${source.manifest.gameId}:${source.manifest.version}`;
    const database = await openDatabase(factory, databaseName);
    await changeDocument(database, projectId, 'manifest.json', manifest => ({ ...manifest, schemaVersion: '0.11', engineRange: '>=0.11 <0.12' }));
    await changeDocument(database, projectId, 'ui.json', ui => ({ ...ui, equipmentSlots: [{ id: 'weapon', label: 'Weapon' }, { id: 'armor', label: 'Armor' }, { id: 'accessory', label: 'Accessory' }] }));
    await changeDocument(database, projectId, 'items.json', items => Object.fromEntries(Object.entries(items).map(([id, item]: [string, any]) => {
      if (item.equipmentTypeId === undefined) return [id, item];
      const { equipmentTypeId, ...legacyItem } = item;
      return [id, { ...legacyItem, equipmentSlot: equipmentTypeId === 1 ? 'weapon' : 'armor' }];
    })));
    await changeDocument(database, projectId, 'initial-state.json', state => ({ ...state, equipment: {} }));
    const transaction = database.transaction('documents', 'readwrite');
    transaction.objectStore('documents').delete([projectId, 'types.json']);
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    database.close();

    const legacyRepository = createDraftRepository({ factory, databaseName });
    const reopened = await legacyRepository.openProject(projectId);
    expect(reopened?.game.manifest.schemaVersion).toBe('0.16');
    expect(reopened?.game.types.equipment.entries[0]).toEqual({ id: 1, name: 'Weapon' });
    expect(reopened?.game.items[4].equipmentTypeId).toBe(1);
  });

  it('serializes overlapping writes so the newest snapshot wins', async () => {
    const repository = createDraftRepository({ factory: new IDBFactory(), databaseName: 'draft-order' });
    const source = sourceGame();
    const first = structuredClone(source);
    const second = structuredClone(source);
    first.maps[1].name = 'First';
    second.maps[1].name = 'Second';
    await Promise.all([repository.save(first, ['maps.json']), repository.save(second, ['maps.json'])]);
    expect((await repository.restore(source))?.maps[1].name).toBe('Second');
  });

  it('deletes the project and every document atomically', async () => {
    const repository = createDraftRepository({ factory: new IDBFactory(), databaseName: 'draft-clear' });
    const game = sourceGame();
    await repository.save(game);
    await repository.clear(game);
    expect(await repository.restore(game)).toBeNull();
  });

  it('stores binary assets and reopens projects from the recent list', async () => {
    const repository = createDraftRepository({ factory: new IDBFactory(), databaseName: 'draft-assets', now: () => 456 });
    const game = sourceGame();
    const blob = new Blob(['png'], { type: 'image/png' });
    await repository.save(game);
    await repository.saveAssets(game, { 'tilesets/custom.png': blob });
    expect(await repository.listProjects()).toEqual([{ id: `${game.manifest.gameId}:${game.manifest.version}`, gameId: game.manifest.gameId, gameVersion: game.manifest.version, title: game.manifest.title, updatedAt: 456 }]);
    const reopened = await repository.openProject(`${game.manifest.gameId}:${game.manifest.version}`);
    expect(reopened?.game).toEqual(game);
    expect(reopened?.assets).toHaveProperty('tilesets/custom.png');
  });

  it('propagates storage failures without reading legacy localStorage drafts', async () => {
    localStorage.setItem(`rpgcrafter-studio:v1:${sourceGame().manifest.gameId}:${sourceGame().manifest.version}`, '{"legacy":true}');
    const failingFactory = { open: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); } } as unknown as IDBFactory;
    const repository = createDraftRepository({ factory: failingFactory, databaseName: 'draft-failure' });
    await expect(repository.save(sourceGame())).rejects.toThrow('Quota exceeded');

    const emptyRepository = createDraftRepository({ factory: new IDBFactory(), databaseName: 'draft-no-migration' });
    expect(await emptyRepository.restore(sourceGame())).toBeNull();
  });
});
