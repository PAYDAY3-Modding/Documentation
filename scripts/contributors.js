const fs = require('node:fs/promises')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const run = promisify(execFile)
const DAY = 24 * 60 * 60 * 1000
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

// Only GitHub's commit author association is trusted. Git author names and
// emails are neither used for identity matching nor stored in the cache/UI.
function githubRepository (url = '') {
  const match = url.match(/^(?:https?:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i)
  return match?.[1].toLowerCase()
}

function account (author) {
  if (!author || author.type !== 'User' || /\[bot\]$/i.test(author.login)) return null
  if (!Number.isSafeInteger(author.id) || !/^[\w-]+$/.test(author.login)) return null
  try {
    const profile = new URL(author.html_url)
    const avatar = new URL(author.avatar_url)
    if (profile.origin !== 'https://github.com' || profile.pathname.toLowerCase() !== '/' + author.login.toLowerCase()) return null
    if (avatar.origin !== 'https://avatars.githubusercontent.com') return null
    avatar.search = '?s=48&v=4'
    return { id: author.id, login: author.login, profileUrl: profile.href, avatarUrl: avatar.href }
  } catch {
    return null
  }
}

module.exports.register = function () {
  const logger = this.getLogger('contributors')
  this.on('documentsConverted', async ({ contentCatalog, playbook }) => {
    const cacheFile = path.resolve(playbook.dir, '.cache/contributors.json')
    let cache = { version: 1, commits: {}, pages: {} }
    try {
      const saved = JSON.parse(await fs.readFile(cacheFile, 'utf8'))
      if (saved.version === 1 && saved.commits && saved.pages) cache = saved
    } catch {}
    const warn = new Set()
    const report = (message) => {
      if (!warn.has(message)) {
        warn.add(message)
        logger.warn(message)
      }
    }
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    let offline = false
    let requests = 0
    const resolveCommit = async (repository, sha) => {
      const key = repository + '/' + sha
      const saved = cache.commits[key]
      if (saved && Date.now() - saved.checked < (saved.user ? 7 * DAY : DAY)) return saved
      if (offline) return saved
      try {
        requests++
        const response = await fetch(`https://api.github.com/repos/${repository}/commits/${sha}`, {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'antora-page-contributors',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: AbortSignal.timeout(10000),
          redirect: 'error',
        })
        if (response.status === 404 || response.status === 422) {
          // A local commit may not have been pushed to this repository yet.
          cache.commits[key] = { checked: Date.now(), user: null, unavailable: true }
        } else if (response.ok) {
          const data = await response.json()
          cache.commits[key] = { checked: Date.now(), user: account(data.author) }
        } else {
          throw new Error('GitHub unavailable')
        }
        if (response.headers.get('x-ratelimit-remaining') === '0') offline = true
      } catch {
        // Never print request headers, tokens, raw responses, or Git errors.
        offline = true
      }
      if (offline) report('GitHub contributor lookup is unavailable or rate limited; using cached identities where available. Contributor lists may be incomplete.')
      return cache.commits[key] || saved
    }

    const repositories = new Map()
    const scopes = new Map()
    const contributorPages = []
    let shown = 0
    for (const page of contentCatalog.getPages()) {
      if (!page.out || page.src.extname !== '.adoc') continue
      const origin = page.src.origin
      if (!origin?.gitdir) continue
      const gitdir = path.resolve(origin.gitdir)
      const ref = origin.refhash || (origin.worktree ? 'HEAD' : `refs/heads/${origin.refname}`)
      const repoKey = gitdir + ':' + ref
      if (!repositories.has(repoKey)) {
        const cwd = origin.worktree || path.dirname(gitdir)
        const git = async (...args) => (await run('git', [
          '-c', `safe.directory=${cwd.replace(/\\/g, '/')}`,
          `--git-dir=${gitdir}`, ...args,
        ], { cwd, encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024 })).stdout.trim()
        try {
          const url = githubRepository(origin.url) ? origin.url : await git('config', '--get', 'remote.origin.url')
          const repository = githubRepository(url)
          const head = await git('rev-parse', '--verify', `${ref}^{commit}`)
          const shallow = (await git('rev-parse', '--is-shallow-repository')) === 'true'
          if (shallow) report(`Contributor history for ${repository || 'a content source'} is shallow. Fetch full history (fetch-depth: 0 in CI); only complete cached page histories will be used.`)
          repositories.set(repoKey, { git, repository, head, shallow })
        } catch {
          report('Git history is unavailable for a content source; its contributor lists will be hidden.')
          repositories.set(repoKey, {})
        }
      }
      const { git, repository, head, shallow } = repositories.get(repoKey)
      if ('page-documentation-contributors' in (page.asciidoc?.attributes || {})) contributorPages.push(page)
      if (!repository || !head) continue
      const startPath = origin.startPath || ''
      scopes.set(repoKey + ':' + startPath, { git, repository, head, shallow, startPath })
      const sourcePath = path.posix.join(origin.startPath || '', page.src.path.replace(/\\/g, '/'))
      const historyKey = `${repository}/${head}/${sourcePath}`
      let commits = cache.pages[historyKey]
      if (shallow && !commits) continue
      if (!commits) {
        try {
          // --follow traverses renames; each commit counts once per page.
          const history = await git('log', '--follow', '--format=%H', head, '--', sourcePath)
          commits = [...new Set(history.split(/\r?\n/).filter((sha) => /^[a-f0-9]{40,64}$/.test(sha)))]
          cache.pages[historyKey] = commits
        } catch {
          report(`Could not read a page's history in ${repository}; its contributor list will be hidden.`)
          continue
        }
      }
      const users = new Map()
      let incomplete = false
      for (const sha of commits) {
        const identity = await resolveCommit(repository, sha)
        if (!identity || identity.unavailable) incomplete = true
        const user = identity?.user
        if (!user) continue
        const entry = users.get(user.id) || { ...user, count: 0 }
        entry.count++
        users.set(user.id, entry)
      }
      const people = [...users.values()].sort((a, b) => b.count - a.count || a.login.localeCompare(b.login))
      if (incomplete) report(`Some commits in ${repository} could not be resolved on GitHub; affected contributor lists are marked incomplete.`)
      if (!people.length) continue
      page.contributors = { first: people.slice(0, 5), more: people.slice(5), incomplete }
      shown++
    }

    if (contributorPages.length) {
      // Include the entire documentation source history, including deleted
      // pages and work on navigation, images, build scripts, and the UI.
      const allCommits = new Map()
      let incomplete = false
      for (const { git, repository, head, shallow, startPath } of scopes.values()) {
        const historyKey = `${repository}/${head}/${startPath}#all-contributors`
        let commits = cache.pages[historyKey]
        if (shallow && !commits) {
          incomplete = true
          continue
        }
        if (!commits) {
          try {
            const history = await git('log', '--format=%H', head, '--', startPath || '.')
            commits = [...new Set(history.split(/\r?\n/).filter((sha) => /^[a-f0-9]{40,64}$/.test(sha)))]
            cache.pages[historyKey] = commits
          } catch {
            incomplete = true
            report(`Could not read full contributor history in ${repository}; the documentation contributor list may be incomplete.`)
            continue
          }
        }
        for (const sha of commits) allCommits.set(repository + '/' + sha, { repository, sha })
      }
      const users = new Map()
      for (const { repository, sha } of allCommits.values()) {
        const identity = await resolveCommit(repository, sha)
        if (!identity || identity.unavailable) incomplete = true
        if (!identity?.user) continue
        const user = identity.user
        const entry = users.get(user.id) || { ...user, count: 0 }
        entry.count++
        users.set(user.id, entry)
      }
      const people = [...users.values()].sort((a, b) => b.count - a.count || a.login.localeCompare(b.login))
      const items = people.map((user) => `<li><a href="${escapeHtml(user.profileUrl)}"><img src="${escapeHtml(user.avatarUrl)}" alt="" width="24" height="24" loading="lazy" referrerpolicy="no-referrer"><span>${escapeHtml(user.login)}</span></a></li>`).join('\n')
      const list = people.length
        ? `<p>Everyone with an identifiable GitHub account who has contributed to the documentation, including its pages, images, navigation, tooling, and UI.</p>\n<ul class="contributor-list documentation-contributor-list">${items}</ul>`
        : '<p>Contributor information is currently unavailable.</p>'
      const status = incomplete || !scopes.size ? '<p class="contributor-status">Some contributor history is unavailable. This list may be incomplete.</p>' : ''
      for (const page of contributorPages) {
        page.contents = Buffer.concat([page.contents, Buffer.from(`\n<div class="sect1 documentation-contributors"><h2 id="_documentation_contributors">Documentation contributors</h2><div class="sectionbody">${list}${status}</div></div>\n`)])
      }
    }
    try {
      await fs.mkdir(path.dirname(cacheFile), { recursive: true })
      await fs.writeFile(cacheFile + '.tmp', JSON.stringify(cache))
      await fs.rename(cacheFile + '.tmp', cacheFile)
    } catch {
      report('Could not save the contributor cache; the generated site is unaffected.')
    }
    logger.info(`Contributor metadata: ${shown} pages, ${requests} GitHub requests.`)
  })
}
