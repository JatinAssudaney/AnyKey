# Preset checklist

How to check a preset on the live site. Every preset shortcut ships with `verified: false` (the options page marks it Unverified) until it passes these checks. Sites change their pages, so check again when a shortcut stops finding its element: AnyKey then shows a toast that names it.

`pnpm test:live` runs the GitHub, YouTube, Hacker News and Wikipedia checks that work signed out (`e2e/live/`), as does CI for the presets a pull request changes. To write the live test for a new preset, see [CONTRIBUTING.md](../CONTRIBUTING.md#presets). The rest is checked by hand: every site signed in (rows marked "signed in" work only then), GitHub's `g e` on a repository you administer, all of Reddit, which shows automated browsers a reCAPTCHA page, all of Stack Overflow, which shows headless browsers a Cloudflare check, and all of Gmail, which needs an account.

## Setup

1. Build with `pnpm build` and load `dist/chrome-mv3` unpacked: `brave://extensions` (or `chrome://extensions`), Developer mode on, Load unpacked. After a rebuild, press the reload button on AnyKey's card, then reload the site's tabs.
2. Check each site twice: signed in, and signed out in a private window (allow AnyKey there from its Details page). Some controls exist only when signed in.
3. To see the site's own shortcut help, switch AnyKey off for the site in its popup and press `?`. Switch it back on afterwards.

## Every preset

- [ ] Press `?` on a page from the tables below. The cheatsheet starts with "<Site>'s own keys", listing the site's keys that still reach it.
- [ ] Open the popup there. The "<Site> preset" section lists the preset's shortcuts for the page, and says which keys go to the site's own shortcuts.
- [ ] In the options page, Sites, the site's row names the preset. Opened, the site shows the preset's shortcuts, then the built-in shortcuts that give way and the site's own keys, as closed lists with their counts.

## Each preset shortcut

1. Open a page where it applies and press its keys. It does what its name says, with no toast.
2. If a toast says it found nothing, inspect the element (right-click, Inspect) and fix the shortcut's `selector`, `fallbacks` or `text` in the preset's JSON.
3. Once it works signed in and signed out, set `verified: true`. Any change to a preset file needs a higher `version`.

## Each key that gives way

1. On a page where it applies, press the key. The site's own shortcut runs, and AnyKey does nothing.
2. On a page of the site where it doesn't apply, AnyKey's shortcut runs.
3. In options, open the site in Sites, then "Built-in shortcuts that give way to <Site>", and switch on Keep for it. AnyKey's shortcut now runs on the first page too. Switch Keep off again.

## GitHub (`presets/github.json`)

| Keys | Shortcut | Where to try it | What happens |
|---|---|---|---|
| `g e` | Go to the Settings tab | A repository you administer | Its Settings tab opens |
| `g r` | Go to Releases | A repository with releases | Its Releases page opens |
| `S` | Star or unstar the repository | Any repository page | The star toggles (signed out: GitHub asks you to sign in) |
| `C` | Open the Code menu to clone | A repository's Code tab | The green Code menu opens |

| Keys | Where they give way | What GitHub does |
|---|---|---|
| `g g` | A repository with Discussions on | The Discussions tab opens. On github.com itself, `g g` scrolls to the top. |
| `j` `k` `u` `x` | A repository's issue list or pull request list | `j` and `k` move the focus from item to item, `u` opens the author filter, `x` selects the focused item. The tab stays open. |
| `x` | An issue or a pull request, signed in | GitHub offers to link an issue or pull request. The tab stays open. On an issue, note which of `x` and `d` does this. |
| `j` `k` `x` | Your notifications (`/notifications`), signed in | If GitHub moves through or selects notifications, the preset should give way here too: note it. |
| `g f` | A workflow run under the Actions tab | The workflow file opens |
| `j` `k` `H` `L` `J` `K` | A repository's network graph (`/network`) | The graph scrolls |

## YouTube (`presets/youtube.json`)

| Keys | Shortcut | Where to try it | What happens |
|---|---|---|---|
| `g l` | Like the video | A video page | The like button toggles |
| `g d` | Dislike the video | A video page | The dislike button toggles |
| `g s` | Subscribe to the channel | A video page | Subscribe, or the menu for a channel you subscribe to |
| `g c` | Write a comment | A video page, scrolled until the comments load | The comment box opens |
| `g u` | Go to the channel | A video page | The channel's page opens |

| Keys | Where they give way | What YouTube does |
|---|---|---|
| `j` `k` | A video page | `j` goes back 10 seconds, `k` plays or pauses. On the home page they scroll. |

## Reddit (`presets/reddit.json`)

| Keys | Shortcut | Where to try it | What happens |
|---|---|---|---|
| `g h` | Go to your home feed | Any page | Your home feed opens |
| `g p` | Go to Popular | Any page | r/popular opens |
| `g n` | Go to your notifications | Any page, signed in | Your notifications open |
| `g m` | Go to chat | Any page, signed in | Chat opens. The address is a guess: fix `url` if it doesn't. |
| `/` | Search Reddit | Any page | The search box takes focus |

| Keys | Where they give way | What Reddit does |
|---|---|---|
| `j` `k` | Any feed or post | The next or previous post or comment is selected |
| `x` | A feed in compact view | The selected post expands or collapses |
| `d` | The mod queue (`/mod/*`), as a moderator | Removes the selected item: try it only in a test subreddit you moderate |

## Gmail (`presets/gmail.json`)

Turn on Gmail's keyboard shortcuts first (Settings, See all settings, General, Keyboard shortcuts on, Save Changes), then check the shortcuts once with them on and once with them off. The labels below are Gmail's in English: Spam, Trash and Scheduled can sit under "More" in the sidebar.

| Keys | Shortcut | Where to try it | What happens |
|---|---|---|---|
| `g m` | Go to Spam | Any page | The Spam folder opens |
| `g h` | Go to Trash (Bin) | Any page | The Trash folder opens |
| `g o` | Go to Important | Any page | Important opens (if Gmail shows it) |
| `g w` | Go to Scheduled | Any page | Scheduled opens |
| `g e` | Open the quick settings | Any page | The quick settings panel opens |

| Keys | Where they give way | What Gmail does |
|---|---|---|
| `j` `k` | The inbox, shortcuts on | The cursor moves to the older or newer conversation |
| `x` | The inbox, shortcuts on | The conversation under the cursor is selected. The tab stays open. |
| `u` | A conversation, shortcuts on | Back to the list |
| `d` | Any page, shortcuts on | A new message opens in a new tab |

With Gmail's shortcuts off, these keys do nothing in Gmail. Check that switching on Keep for one of them in options gives it back to AnyKey.

## Stack Overflow (`presets/stack-overflow.json`)

Stack Overflow's own keys need an account: turn them on in your profile's Preferences (Keyboard shortcuts), and press `?` to see them.

| Keys | Shortcut | Where to try it | What happens |
|---|---|---|---|
| `/` | Search Stack Overflow | Any page | The search box takes focus |
| `g j` | Jump to the accepted answer | A question with an accepted answer | The page scrolls to it, and the focus is on its Share link |
| `g l` | Share a link to the question | A question | The question's share menu opens |

| Keys | Where they give way | What Stack Overflow does |
|---|---|---|
| `j` `k` `u` | Any question list, shortcuts on | The next, previous and first question are selected |
| `v` then `u` or `d` | A question, signed in, shortcuts on, after `j` selects a post | The vote menu votes up or down: try it on a post you're glad to vote on, then undo the vote |

On the front page and `/questions`, `d` still scrolls half a page, and `g f` opens link hints for a new tab everywhere. Tagged lists (`/questions/tagged/*`) share the question pages' pattern, so `d` gives way there too.

## Hacker News (`presets/hacker-news.json`)

`e2e/live/hacker-news.spec.ts` checks every shortcut. Hacker News has no keys of its own.

| Keys | Shortcut | Where to try it | What happens |
|---|---|---|---|
| `g h` `g n` `g p` `g c` `g a` `g s` `g j` | Go to the front page, newest stories, past front pages, newest comments, Ask HN, Show HN, jobs | Any page | That page opens |
| `n` | Go to the next page | A list with a More link | The next page opens |
| `/` | Search Hacker News | Any page with the footer search | The search box takes focus |

## Wikipedia (`presets/wikipedia.json`)

`e2e/live/wikipedia.spec.ts` checks every shortcut on English Wikipedia, and `g t` on German Wikipedia. Wikipedia's own keys are access keys, which AnyKey doesn't list. Also try a language other than English signed in.

| Keys | Shortcut | Where to try it | What happens |
|---|---|---|---|
| `/` | Search Wikipedia | An article | The search box takes focus |
| `g m` | Go to the main page | Any page | The main page opens |
| `g r` | Go to a random article | Any page | A random article opens |
| `g c` | Go to the article | A talk page or history | The article opens |
| `g t` | Go to the talk page | An article | Its talk page opens |
| `g e` | Edit the page, or view its source | An article | The editor opens (or the source, on a protected page) |
| `g h` | Go to the page's history | An article | Its history opens |
| `g w` | Go to What links here | An article | The pages that link to it are listed |
| `g l` | Show the page in other languages | An article in many languages | The language menu opens with its search box focused |
