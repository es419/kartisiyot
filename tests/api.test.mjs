import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Compile the real API with only its external dependencies replaced.
const source = readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8')
  .replace("import { supabase } from './supabase'", 'const supabase = globalThis.__apiMock')
  .replace("import { todayStr } from './lib/text'", "const todayStr = () => '2026-10-14'")
  .replace("import { studyView } from './lib/cloze'", 'const studyView = (cards) => cards')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
let sequence = 0
async function setup(responses, uid = 'user-a', storage = new Map()) {
  const calls = []
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  globalThis.__apiMock = {
    auth: { getSession: async () => ({ data: { session: uid ? { user: { id: uid } } : null } }) },
    from(table) {
      const call = { table, filters: [] }
      calls.push(call)
      const response = responses.shift()
      const query = {
        insert(row) { call.insert = row; return query },
        update(row) { call.update = row; return query },
        select() { return query },
        eq(key, value) { call.filters.push([key, value]); return query },
        order() { return query },
        single() { return Promise.resolve(response) },
        maybeSingle() { return Promise.resolve(response) },
        then(resolve, reject) { return Promise.resolve(response).then(resolve, reject) }
      }
      return query
    }
  }
  const api = await import('data:text/javascript;base64,' + Buffer.from(compiled + `\n// ${sequence++}`).toString('base64'))
  return { api, calls, storage }
}
const payload = { type: 'concept', title: 'Title', body: 'Body', tag: '' }
const entry = { ...payload, id: 'entry-id', user_id: 'user-a' }

test('new entries use the stable editor ID and authenticated owner', async () => {
  const { api, calls } = await setup([{ data: entry, error: null }])
  assert.deepEqual(await api.createEntry(payload, entry.id), entry)
  assert.deepEqual(calls[0].insert, entry)
})
test('lost insert response recovers the already committed entry', async () => {
  const { api, calls } = await setup([{ data: null, error: { message: 'Failed to fetch' } }, { data: entry, error: null }])
  assert.deepEqual(await api.createEntry(payload, entry.id), entry)
  assert.deepEqual(calls[1].filters, [['id', entry.id], ['user_id', 'user-a']])
})
test('retry after a lost response returns the same entry after duplicate-key rejection', async () => {
  const { api } = await setup([{ data: null, error: { message: 'duplicate key' } }, { data: entry, error: null }])
  assert.deepEqual(await api.createEntry(payload, entry.id), entry)
})
test('failed insert without an existing entry remains an error', async () => {
  const { api } = await setup([{ data: null, error: { message: 'Failed to fetch' } }, { data: null, error: null }])
  await assert.rejects(api.createEntry(payload, entry.id), /Failed to fetch/)
})
test('offline cache cannot fall back to another user or old unscoped keys', async () => {
  const storage = new Map([['fc:user-b:folders', '[{"name":"Private"}]'], ['fc:folders', '[{"name":"Legacy private"}]']])
  const { api } = await setup([{ data: null, error: { message: 'offline' } }], 'user-a', storage)
  await assert.rejects(api.listFolders(), /offline/)
})
test('offline cache works for the current user', async () => {
  const storage = new Map([['fc:user-a:folders', '[{"name":"Own folder"}]']])
  const { api } = await setup([{ data: null, error: { message: 'offline' } }], 'user-a', storage)
  assert.deepEqual(await api.listFolders(), [{ name: 'Own folder' }])
})
test('corrupt cached JSON preserves the original server error', async () => {
  const { api } = await setup([{ data: null, error: { message: 'offline' } }], 'user-a', new Map([['fc:user-a:folders', '{']]))
  await assert.rejects(api.listFolders(), /offline/)
})
test('an update that matched no entry fails instead of reporting success', async () => {
  const { api } = await setup([{ data: null, error: { message: 'No rows returned' } }])
  await assert.rejects(api.updateEntry('missing-id', payload), /No rows/)
})
