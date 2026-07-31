# Writing That Gets Noticed: Portfolios, Technical Blogs, and Devlogs for a Solo Dev Building "Puzzle Lab"

*(Commissioned research artifact, imported 2026-07-31 to underpin the `AGENTS.md` → "Build Log
(Devlog) Rule". The devlogs themselves live in the `Biscuit-Website` repo (biscuitlab.net) at
`/log` — this doc is the craft/evidence base, not the publishing mechanics.)*

## TL;DR

- **Your single biggest edge is that you're building something genuinely uncommon.** A
  procedural puzzle generator (Killer Sudoku, KenKen, Sudoku) is exactly the kind of
  algorithmically-rich, visually-demonstrable, non-clone project that recruiters and technical
  audiences respond to — the opposite of the "to-do app / tutorial clone" that dominated
  *rejected* portfolios in one hiring-manager's analysis of 100 tech-lead candidates (68% of
  rejected candidates had highlighted projects hiring teams rated *negatively*, and "almost
  three-quarters" of them featured an over-engineered to-do/note app). Lead with the algorithms,
  the live demo, and honest process writing.
- **Portfolio, blog, and devlog should be one interlinked system on your own domain.** The
  portfolio is a case-study index that proves skill in a ~7-second scan; the blog turns your
  hardest problems (unique-solution guarantees, difficulty calibration, passkeys) into
  interactive, sharable proof; the devlog is the lightweight, personality-driven "building in
  public" cadence that compounds an audience over months. Interactive explainers (Bartosz
  Ciechanowski / Red Blob Games / Josh Comeau style) are your highest-leverage format because
  puzzles are inherently visual and interactive.
- **In the AI era, obviously-generated content is now a liability and real, specific,
  first-person process writing is the scarce signal.** Show the ugly prototype, the bug that took
  three days, the tradeoff you regret. Consistency beats perfection, and "do stuff, then blog
  about it" (Simon Willison) remains the highest-ROI career move available to a solo developer.

## Key Findings

1. **Recruiters scan first, read later.** The most-cited data — Ladders, Inc.'s 2018 Eye-Tracking
   Study (30 recruiters monitored over 10 weeks) — found an average initial screen of **7.4
   seconds** ("an improvement on the six-second average screening time found in 2012"), following
   an F-pattern, with fit/no-fit driven by ~6 data points. This is contested as oversimplified —
   deeper reviews take 1–2+ minutes once you pass the first cut — but the actionable lesson is
   universal: your top-left/above-the-fold must instantly signal relevance. Clean, scannable
   layouts win; cluttered multi-column walls lose.

2. **What developers *think* impresses ≠ what actually does.** In one recruiter's analysis of 100
   tech-lead portfolios (with follow-up interviews of 12 engineering managers), **68% of
   *rejected* candidates highlighted projects that hiring teams had viewed *negatively*** — most
   commonly over-engineered to-do/note apps. What actually impressed: tools that solve other
   developers' pain, thoughtful performance work, and evidence of *thinking* (tradeoffs,
   decisions), not just *building*.

3. **Skills-first hiring is rising.** Per the CodinGame/CoderPad 2022 Tech Hiring Survey, **57% of
   recruiters are open to removing the CV** from the process, and hiring of developers from
   non-academic backgrounds "almost doubled, from 23% to 39% in one year." Live demos + clean,
   documented GitHub + original problem-solving are the recurring "stand out" trifecta. (A
   widely-repeated "Stack Overflow 2024: 73% of hiring managers value a strong portfolio over a
   perfect resume" stat circulates in secondary summaries — treat it cautiously; I could not
   confirm it against the primary survey.)

4. **The portfolio *site itself* is a work sample.** For a frontend/full-stack dev, load time,
   accessibility, mobile, and polish are read as a direct demonstration of craft — but
   over-designed sites that bury the work are an anti-pattern. Broken demo links and stale content
   signal you don't maintain your work.

5. **Technical posts spread when they gratify intellectual curiosity and give readers something
   to *do*.** Hacker News's own guideline — "anything that gratifies one's intellectual
   curiosity" — is borne out by first-hand viral accounts: interactive, try-it-yourself content
   and "I built/broke X" stories consistently outperform. Amplify Partners' manual analysis found
   product launches make the front page only "~4%" of the time and Show HN posts "<2%"; content
   quality (not timing tricks or upvote rings) is what GitLab's own experiments found drove
   front-page success.

6. **The most admired technical writers converge on a few principles:** write about what you
   struggled with or built (Julia Evans, Simon Willison); sound like a human talking to a human;
   make it scannable; use concrete examples over caveats (Dan Luu); and for algorithmic/visual
   topics, make it *interactive* (Ciechanowski, Amit Patel/Red Blob Games, Josh Comeau, Nicky
   Case). This last group is your north star.

7. **"Building in public" works but is oversold — and it's strongest when your audience is other
   builders.** Named indie devs have converted public building into real audiences and revenue
   (Pieter Levels, Tony Dinh, Marc Lou, Arvid Kahl, Danny Postma), but experienced practitioners
   warn it's often a poor *primary* marketing channel unless your users are indie hackers, and it
   invites copycats. The honest version — sharing failures, ugly prototypes, and real numbers — is
   what builds loyalty.

8. **Own your canonical.** Self-host on your own domain and syndicate (POSSE: Publish On Site,
   Syndicate Elsewhere) to dev.to / Hashnode / Medium with canonical tags pointing home. This
   captures community discovery without giving away SEO authority.

## Details

### 1. Developer Portfolios

**How recruiters actually behave.** The anchor datapoint is Ladders, Inc.'s 2018 eye-tracking
study: 30 professional recruiters, monitored over 10 weeks, spent an average of **7.4 seconds** on
an initial resume screen (up ~1 second from the 6 seconds measured in their 2012 study). Attention
followed an **F-pattern** (across the top, down the left), concentrating on the top-left quadrant
and a handful of fixation points; long paragraphs were skipped entirely. Multiple 2026
re-analyses (ResumeHeatMap, Standout-CV) note the "7.4 seconds" figure is contested and
context-dependent — high-volume screening is fast, but referred or well-structured resumes earn
substantially more time (one dataset cited 72% of recruiters spending under 2 minutes). **The
through-line: design for a scan first, a read second.** For a portfolio, that means an
above-the-fold hero (name, role, one-line value proposition), then scannable project cards.

**What actually catches the eye vs. what developers think does.** The sharpest evidence comes from
a former-developer-turned-recruiter who analyzed 100 tech-lead portfolios and followed up with 12
engineering managers: **68% of rejected candidates highlighted projects that hiring teams actually
rated *negatively*.** The number-one offender: over-engineered to-do/note-taking apps ("almost
three-quarters" of rejected candidates had one). What consistently impressed instead:

- Projects that show **empathy for other developers** (tools that improve workflows, solve common
  pain).
- **Performance analysis and optimization** work.
- Evidence of **decision-making and tradeoffs**, i.e., thinking, not just output.

This maps cleanly onto Puzzle Lab: a *generator* that guarantees unique solutions and calibrates
difficulty is an algorithmic, original, "hard problem" project — categorically different from a
CRUD clone.

**Structure and content patterns of standout portfolios.**

- **Case studies over grids.** A grid of screenshots shows *what*; a case study shows *how you
  thought*. But hiring managers *skim* case studies — so make skimming productive. Open Doors
  Careers' 2025/2026 guidance recommends the 30-second test: have someone scan for 30 seconds,
  then name the problem, approach, and outcome. If they can, it works.
- **Live demos** are especially valuable for frontend work — let people *experience* the work
  (Puzzle Lab is perfect for this: an embedded, immediately-playable generator).
- **GitHub as a real surface.** Recruiters and tech leads do open GitHub. Pinned repos with clear,
  specific descriptions ("Killer Sudoku generator with unique-solution guarantee and difficulty
  calibration," not "sudoku app"), meaningful commit messages, and a real README (not the default
  `create-next-app` boilerplate) are repeatedly cited signals. A well-maintained profile with
  focused, quality repos beats a large unfocused one.
- **Depth over breadth:** most guidance converges on 3–5 strong projects (some say up to 4–10 for
  versatility), quality over quantity.

**Case-study writing structure.** The consensus spine across UX (UXfolio, Toptal, Format) and dev
sources is a **problem → context/constraints → approach (and *why* over alternatives) → tradeoffs
→ outcome (quantified if possible) → what I'd do differently** narrative. Toptal frames it as:
"Here's what I did, how it helped, and how I might apply a similar approach with you." Open Doors
distills it to three pillars: *What was the problem? What did you do about it? What happened
because of it?* Keep it a tight story (many recommend ~800–1,500 words + visuals; some UX sources
say digestible in 1–2 minutes), with 3–5 images (one hero, a couple of process shots, one
outcome). Crucially: explain the *why*, and center *your* role and thinking.

**Anti-patterns (well-documented):**

- **Tutorial clones and to-do apps** as headline projects. If you include a clone, state exactly
  what *you* added/changed. Incomplete clones with default READMEs and no live deploy are a
  recognized red flag.
- **Skill-bar percentage charts** ("HTML 90%, CSS 85%") — widely mocked as meaningless.
- **Generic AI-default aesthetics / over-design** that hides the work.
- **Walls of logos** in place of substance.
- **Broken links and stale content** — signals you don't maintain your work.
- File named `resume.pdf`, unprofessional email — small but real turn-offs cited by hiring
  managers.

**Does the site's craft matter, or the content?** Both, but they serve different judges. For a
full-stack/frontend candidate, the site *is* a work sample: performance, accessibility, mobile
responsiveness, and load time are read as craft signals. But the content (case studies, demos,
thinking) is what converts a scan into an interview. The failure mode is an over-designed site that
demonstrates aesthetics while hiding the actual work. Balance: a fast, accessible, clean site whose
primary job is to get someone *into* the work.

**2025/2026 AI-era considerations.** The signal/noise ratio has shifted hard. Sources report large
candidate pools filtered before a human reads the resume, and portfolios that "look identical to
everyone else's" (same AI-default template, same generic projects) get discarded. Hiring managers
now actively wonder "did this person actually do this work?" when a portfolio looks "too clean, too
fast, too perfect." The emerging proof-of-real-ability signals:

- **Documented process** and honest annotation of what you did vs. what a tool generated (one
  backend dev's "AI vs. manual" README column was reportedly flagged by recruiters as among the
  clearest AI-fluency demonstrations they'd seen that quarter).
- **Original, hard problems** with realistic constraints over polished demos.
- **First-person narrative** of decisions and failures — hard to fake, easy to verify in an
  interview.

For Puzzle Lab, your algorithmic depth and interactive demos are inherently hard to fake and thus
disproportionately valuable now.

### 2. Technical Blog Posts

**What gets read and shared.** Hacker News's own definition of on-topic — *"anything that
gratifies one's intellectual curiosity"* — is the operating principle. Amplify Partners' manual
analysis of HN front-page posts found product launches rarely make it ("statistically highly
unlikely (~4%)"), Show HN posts almost never (<2%), while news articles made up ~36% of front-page
posts and technical explainers, postmortems, and genuinely curious deep-dives dominate the rest.
Multiple first-hand "we went viral" accounts (Workflow86: ~20,000% traffic spike; Daniel Wirtz:
~100,000 readers) converge on two things: **content quality is the driver**, and **interactive,
try-it-yourself content outperforms** ("Giving people something to try out makes the reading
experience more active… prompting discussions"). GitLab's own experiments concluded coordinated
upvoting doesn't work — "the content is the key to success."

**Post archetypes that work:**

- **Deep technical dives** ("how algorithm Y actually works") — especially with interactive
  visuals.
- **"I built X and here's what broke"** — Simon Willison's and Julia Evans' bread and butter.
- **Debugging detective stories** — narrative tension around a hard bug.
- **Postmortems** and **"reading the source code of X"** posts.
- **Benchmark/comparison** posts and **opinionated takes** (Dan Luu's territory — willing to say
  things others won't).
- **"Today I Learned" (TIL)** short posts — Simon Willison has published hundreds; low pressure,
  high cumulative value.

**Writing craft specifics.**

- **Titles:** question-provoking and concrete over clickbait listicles. Robin Moffatt / Stephen
  Turner: write what you'd want to read; avoid "10 amazing ways… #7 will shock you."
- **The hook:** Josh Comeau starts from "a particular visualization or a particular analogy… some
  sort of thing that makes this blog post worthwhile."
- **Voice:** Julia Evans — "I try to write in a way that sounds like a human talking to another
  human, not a manual." Dan Luu — clear, casual, few caveats, more concrete examples (a change he
  credits to Ben Kuhn).
- **Scannability:** Evans — "Most people don't read technical blog posts; they scan them for the
  code snippets and headings." Use headings, short paragraphs, bullet points.
- **Media:** code snippets for the how, diagrams for the structure, **interactive demos for
  anything spatial/algorithmic**, GIFs/screenshots liberally.
- **Length:** as long as it needs to be and no longer; Dan Luu proves very long works if every
  paragraph earns its place, Willison proves short TILs work too.
- **Editing:** Evans — "My first drafts are always a mess, and that's okay because the value is in
  the refining." Luu hired a professional editor with the instruction to fix "clunky and awkward"
  writing.

**Advice from named writers (what makes them distinctive):**

- **Julia Evans (jvns.ca):** Blog about what you struggled with; you don't need to be an expert,
  original, comprehensive, consistent, exciting, or even always right. Remembers what it felt like
  not to understand something. Zines/comics format. Measures success by "conversations, not page
  views." Has been "offered full-time jobs as a result of a single blog post."
- **Simon Willison (simonwillison.net):** "Do stuff and then blog about it" is his most-repeated
  career advice. Write about things you've **learned**, **built**, and (added 2024) **found**. Add
  "write about it" to your definition of "done." TILs remove the pressure to be unique; the value
  is in "writing frequently and having something to show for it over time."
- **Dan Luu (danluu.com):** Long-form, data-heavy, willing to be contrarian; intentionally minimal
  design so ideas carry. Believes there's a shortage of digestible technical information — a gap
  others should fill.
- **Bartosz Ciechanowski (ciechanow.ski):** The gold standard of interactive explainers.
  Custom-coded HTML5/Canvas/WebGL, no external frameworks; builds each subject "from first
  principles" with 100+ manipulable diagrams and sliders (Mechanical Watch, Cameras and Lenses,
  Internal Combustion Engine). Readers report they finally *understand* the subject. Supported via
  Patreon.
- **Amit Patel / Red Blob Games (redblobgames.com):** Interactive visual explanations of
  algorithms (A*, pathfinding, hexagonal grids, procedural map generation). Rationale: "I learn
  best when combining the language side of my brain… with the visual side… I want to learn not
  only by reading something or watching something, but by playing with it." His procgen war story —
  that he "spent all my time playing with generators and simulators and never finished the game"
  (SimBlob) — is a directly relevant cautionary tale.
- **Josh Comeau (joshwcomeau.com):** Writes in **MDX** (Markdown + React components) so he can drop
  bespoke interactive widgets mid-article; "An Interactive Guide to CSS Transitions/Flexbox" are
  his most popular. Philosophy: even a topic covered 100 times, "I know that I can put my own spin
  on it… and it will reach those people who otherwise I have no way of reaching." "Novelty budget":
  limit how many new things you attempt at once.

**The specific value of interactive explainers for puzzle/math topics.** This is your unfair
advantage. Puzzles are visual, rule-based, and interactive by nature — the exact domain where
Ciechanowski/Red Blob/Comeau/Nicky Case/3Blue1Brown-style explanations shine. An article that lets
the reader *watch a backtracking solver run*, *drag clues out of a grid and see the solution count
change*, or *step through a solving technique* is both a high-share blog post and portfolio-grade
proof of skill simultaneously. The effectiveness comes from active manipulation ("play with it")
turning passive reading into understanding.

**SEO and distribution.**

- **Self-host and own your canonical.** The strong consensus (Hashnode's own "own your canonical,"
  POSSE advocates, Josh Comeau's stack) is: publish first on *your* domain, then syndicate to
  dev.to / Hashnode / Medium with `rel=canonical` pointing home. Community platforms give fast
  feedback and discovery; your domain accumulates authority. Outbound links on those platforms are
  often `nofollow`/`ugc`, so SEO equity mostly comes from your own site.
- **Platform fit:** dev.to for the largest active community and fast feedback; Hashnode for
  custom-domain + community (note some features moved behind a Pro tier in 2026); Medium for broad
  reach but paywall/algorithm caveats; Hacker News and Reddit (r/programming) for distribution
  spikes (short-lived — traffic typically returns to baseline in ~2 days).
- **Distribution mechanics:** HN success is driven by content and, secondarily, timing; don't ask
  people to vote via direct links. Newsletters and RSS build a durable audience independent of
  algorithms.

**Consistency vs. quality; sustainability.** Willison's core argument: the value is in "writing
frequently and having something to show for it over time — worthwhile even if you don't attract
much of an audience (or any audience at all)." Evans reassures that you don't need to be
consistent, comprehensive, or exciting. For a solo dev, the sustainable model is: a few flagship
interactive deep-dives (high effort, evergreen) + frequent low-friction TILs/devlog notes (low
effort). Evergreen explainers (how the generator works) outlast timely posts.

### 3. Dev Logs

**Devlog culture and formats.** Devlogs are deeply embedded in indie game dev — TIGSource/
TIGForums (Derek Yu's community, launchpad for Spelunky, Fez, and where Minecraft, Papers Please,
and QWOP were incubated), itch.io devlogs, r/gamedev's "Screenshot Saturday," and YouTube devlog
channels. In web/SaaS, the equivalent is Indie Hackers "building in public" and X/Bluesky/Mastodon
threads. Formats that work: written (itch.io, personal blog), short video (YouTube), and social
threads with GIFs.

**"Building in public" — honest assessment.** Named practitioners show it can compound into real
audiences and revenue (all revenue/follower figures are founder-self-reported, the norm in BIP, and
not independently audited):

- **Pieter Levels (@levelsio):** popularized the movement by openly tweeting Stripe revenue; Nomad
  List grew from a public Google Spreadsheet. His "open startups" tweets showed **Nomad List +
  Remote OK + MAKE generating $34,733 in revenue in a month** (with $3,950 expenses), later passing
  **$52,843/month**; ~600K+ X followers built over ~10 years.
- **Tony Dinh (@tdinh_me):** ~100 Twitter followers in 2021 → ~8,000 when he quit his job (products
  then only ~$600 MRR) → **over 181,000 by 2026.** TypingMind made $22K in its first week and
  scaled toward $137K/month; he sold Black Magic ($14K MRR peak) for $128K and Xnapper for
  $150K. His lesson from building DevUtils in two weeks vs. six months on a flop: *"The
  difference… wasn't quality. It was feedback."*
- **Marc Lou (@marc_louvion):** grew from **1,000 followers (July 2022) to 40,000+** by ShipFast's
  launch to **127K+** by 2026; **ShipFast made $63,600 in its first 60 days**, over half its traffic
  from his personal brand; he later self-reported peaks around $141K MRR. His verbatim on the grind:
  *"Most people quit during the flat part of the curve."*
- **Arvid Kahl (@arvidkahl):** bootstrapped FeedbackPanda to **~$55K MRR in ~2 years**, sold to
  SureSwift Capital in 2019; now runs "The Bootstrapped Founder." Mantra: "Don't find customers for
  your products; find products for your customers."
- **Danny Postma (@dannypostmaa):** HeadshotPro built in ~30 hours, **~$100K revenue within two
  weeks**, grown via X; advocates setting a "Quit Metric" before launch.

**The downsides (from experienced indie hackers):** BIP is "usually a pretty terrible channel"
*unless your product targets other founders* — a real caveat for Puzzle Lab, whose users are puzzle
players, not indie hackers. Sharing revenue attracts copycats (multiple top indie hackers went
"revenue ghost mode" — deleting numbers while continuing to share non-metric wins) and can tip into
"chasing likes instead of being authentic." Treat BIP as *one* channel, not your whole marketing
strategy.

**Game-marketing evidence (Chris Zukowski, howtomarketagame.com).** If Puzzle Lab ever ships on a
store or grows an audience, Zukowski's data is the definitive reference:

- His 2019 five-hour observation of how Steam shoppers actually browse: a typical shopper
  "wishlisted the game after they thought the game's capsule image was cute, watched 13 seconds of
  an animated gif version of the trailer, read 12 words of the short description, **SKIPPED the
  trailer**, looked at exactly 4 screenshots (which took all of 5.5 seconds)…" **Takeaway: capsule
  art + animated GIF + first screenshots do the heavy lifting; most people skip the trailer and
  long description.**
- On why gameplay content beats static assets: *"A streamer can't play screenshots or a trailer,
  they just can't!"* — the case for GIFs and short clips in every devlog.
- His Jan 2025 data-backed finding that wishlists don't "get old" (average conversion ~8%, low
  variance regardless of age) refutes a common myth.

**What makes a devlog entertaining, not a boring changelog:**

- **Narrative arc** — a problem, a struggle, a resolution. IndieGameDev.net's #1 mistake: starting
  a devlog *before you have anything to show* ("two or three paragraphs of text about how great
  this game is going to be… but there's no screenshots, or even concept art"). Show, don't
  announce.
- **Show failure and iteration**, the ugly early prototype, and before/after visuals.
- **Personality and humor** (Jonas Tyroller, DevDuck's chill authenticity, Games Over Coffee's calm
  tone are cited models).
- **GIFs and short clips** — the single highest-impact devlog asset.
- **Numbers, metrics, reader questions/polls** to invite participation.

**Cadence and the "nobody is reading this" phase.** First-hand indie consensus (itch.io community):
**"It takes months, if not years, to build followers."** Do *not* post daily — one experienced
community member warns that daily devlogs of tiny tidbits get you *unfollowed* ("people will
unfollow you because you're posting so much their feed becomes unusable"); **weekly is acceptable,
every 15–30 days may be best** so you can present meatier updates. A sobering counter-example: one
dev dropped "nearly 60 changelogs, dropping one every week without fail" and his Steam Early Access
game "completely flopped," while his earlier no-devlog free roguelike got "thousands and thousands
of downloads" — **cadence alone doesn't create traction; the game/hook does.** The psychological
upside of a devlog: once people comment, "you will feel compelled to continue, especially if you've
had some initial comments… you don't want to let them down."

**Avoiding devlogs eating dev time.** Amit Patel's SimBlob story is the cautionary archetype. Keep
devlog production lightweight: capture GIFs as you build, batch updates, and time-box writing.
DevDuck is cited specifically for modeling healthy work-life balance against industry crunch.

**Well-known devlogs worth studying:** *Game dev:* Jonas Tyroller, DevDuck (Godot, "Dolphin"), Karl
(Equilinox / city builder), Patch Quest ("How to NOT make an indie game"), Derek Yu / TIGSource.
*Web/SaaS building-in-public:* Levels.io, Tony Dinh (tonydinh.com), Marc Lou (marcfa.st), Arvid
Kahl (The Bootstrapped Founder), and Simon Willison's real-time documentation of everything he
learns.

### 4. Topic Ideas for Puzzle Lab

These double as blog posts *and* portfolio case studies. The ones marked ★ are highest-leverage
(strong technical-audience appeal **and** portfolio proof).

**Generation & algorithms (your core strength):**

- ★ **"How I generate a Killer Sudoku that has exactly one solution"** — backtracking generation,
  the "dig-hole" strategy, and the uniqueness check. Include an interactive widget: drag clues out
  and watch the solution count change. Anchor it with the real math: classic Sudoku has a proven
  minimum of **17 clues** (McGuire, Tugemann & Civario, "There is no 16-Clue Sudoku,"
  arXiv:1201.0749, Jan 2012 — an exhaustive ~year-long search at ICHEC costing ~7.1M core-hours;
  "we did not find one, thereby proving that the answer is indeed 17"), and there are exactly
  **6,670,903,752,021,072,936,960 ≈ 6.671 × 10²¹ valid filled grids** (Felgenhauer & Jarvis,
  "Mathematics of Sudoku I," 2006), reducing to 5,472,730,538 essentially different grids.
- ★ **"Making a generator that produces *good* puzzles, not just *valid* ones"** — the
  teleological-vs-tuning problem Amit Patel describes; how you bias toward elegant, human-solvable
  puzzles. The single most portfolio-impressive topic because it's about *judgment*, not just
  correctness.
- **"Difficulty rating is harder than solving"** — why clue count ≠ difficulty; rating by which
  solving *techniques* are required (naked/hidden singles → X-wing → forcing chains). Daniel Beer's
  implementation scored an easy puzzle at 55 vs. a naive solver's 655; and the academic literature
  (e.g., the arXiv difficulty-rating survey) notes computer ratings often diverge from real human
  performance. Interactive: a puzzle that highlights which technique unlocks each step.
- **KenKen/Calcudoku generation** — constraint satisfaction with arithmetic cages; how it differs
  from Sudoku generation.
- **"Reading the source of Simon Tatham's Portable Puzzle Collection"** (MIT-licensed, famously
  clean C; the `tents` solver is HN-praised as "a masterclass of how to write C") or **KDE
  KSudoku** — what you learned about generator architecture. "Reading the source of X" is a proven
  HN archetype.

**Web/product engineering (proves full-stack range):**

- ★ **Passkeys/WebAuthn with better-auth** — implementing passwordless auth end-to-end. Timely,
  high-interest, and demonstrates security depth.
- **Neon Postgres + Drizzle ORM schema design** for puzzles, attempts, and leaderboards; serverless
  Postgres tradeoffs on Vercel.
- **Performance work** — generating puzzles fast in the browser vs. server; Web Workers; benchmark
  territory (Daniel Beer generated difficult puzzles in ~596ms on a 1.66GHz Atom). Performance
  posts are consistently well-received and were explicitly cited as impressing hiring managers.
- **"Designing a puzzle UI that gets out of the way"** — input methods, pencil marks,
  accessibility, mobile touch targets.

**Design/product/economics:**

- **The gamification of streaks and leaderboards** — the psychology and the schema; honest take on
  dark patterns.
- **Interactive explainers of solving techniques** (a standalone "how to solve Killer Sudoku"
  interactive guide) — simultaneously marketing (attracts players), SEO evergreen, and portfolio
  proof.

**Which perform best:** Interactive algorithm explainers and "how X actually works" deep-dives
historically do best with technical audiences (HN/Reddit/Lobsters) *and* are the strongest
portfolio proof. "I built X and what broke" and postmortems build audience and personality. Pure
changelog devlogs perform worst — always wrap them in narrative.

### 5. Practical Synthesis

**How they interlink.** Run everything on **one domain** (e.g., `yourname.dev`): a portfolio home,
a `/blog`, and a `/devlog` or "building Puzzle Lab" thread. The flow:

1. **Devlog** captures the raw, in-progress story cheaply (GIF of a bug, a "here's the ugly first
   generator" note).
2. A hard problem from the devlog graduates into a **flagship blog post** (the interactive "how
   unique-solution generation works" explainer).
3. That blog post becomes the spine of a **portfolio case study** (problem → constraints → approach
   → tradeoffs → outcome → what I'd do differently), linking to the live demo and the specific blog
   deep-dives as evidence.

Cross-link aggressively: case study → deep-dive posts → live demo → GitHub repo (with a real
README). This is the POSSE-plus-portfolio system: publish on your domain, syndicate posts to
dev.to/Hashnode with canonicals, drop GIFs on X/Bluesky/Mastodon linking back.

## Recommendations (Staged)

**Stage 0 — Foundation (week 1, a few hours):**

- Buy a domain; ship a fast, accessible, mobile-clean one-page portfolio: hero (name, "full-stack
  dev building Puzzle Lab, a procedural puzzle generator"), an embedded **live playable demo**, and
  3 project cards.
- Clean up GitHub: pin the Puzzle Lab repo, write a real README (architecture, screenshots, live
  link, the interesting algorithmic bits), specific repo descriptions.
- *Benchmark to advance:* someone can, in a 7-second scan, tell what you built and click into a
  working demo.

**Stage 1 — First proof-of-skill post (weeks 2–4):**

- Write ONE flagship interactive explainer: **"Generating a Killer Sudoku with exactly one
  solution."** Use MDX/React (Comeau's approach) so you can embed a live generator/solver widget.
  Structure it as a story (what broke, what you tried).
- Publish on your domain; syndicate to dev.to + Hashnode with canonical tags; post a GIF to HN
  ("Show HN"), r/programming, and Bluesky/Mastodon.
- *Benchmark:* if it gets meaningful HN/Reddit engagement or comments, double down on interactive
  explainers. If not, it's still evergreen portfolio proof — keep going (Willison's rule).

**Stage 2 — Devlog cadence (ongoing, low-friction):**

- Start a **weekly-to-biweekly** devlog (never daily). Each entry: one GIF/before-after, one thing
  that broke or that you learned, one number if you have it. Capture GIFs *as you build* to avoid
  overhead.
- Show the ugly prototype early. Invite feedback with a concrete question.
- *Benchmark:* expect months before traction ("nobody is reading this" is normal). If you dread it
  or it eats build time, cut cadence — do not let the devlog become SimBlob.

**Stage 3 — Convert to case studies (month 2–3):**

- Turn your best 1–2 blog deep-dives into portfolio case studies with the full
  problem→outcome→reflection arc. Add measurable outcomes (generation time, uniqueness guarantee,
  difficulty-rating accuracy).
- Add 2–3 more topics from the list (passkeys/WebAuthn ★, difficulty rating, "good vs. valid
  puzzles" ★).

**Stage 4 — Sustain & distribute (ongoing):**

- Add a newsletter/RSS to build an algorithm-independent audience.
- Alternate high-effort evergreen explainers with low-effort TILs.
- Reassess quarterly: which posts drove interviews, traffic, or user signups? Shift effort toward
  what works.

**Thresholds that change the plan:**

- If a post hits the HN/Reddit front page → write a follow-up while you have attention; add an email
  capture.
- If building-in-public brings *players* (not just other devs) → lean in. If it only attracts
  copycats or feels like like-chasing → go "numbers-quiet," keep sharing craft/failures.
- If devlog time exceeds ~10% of build time → cut it back.

## Caveats

- **The "7.4 seconds" statistic is contested.** It comes from a single small study (30 recruiters)
  with a thin published methodology; 2026 re-analyses argue real review time varies widely (6–30+
  seconds, longer once past the first cut). Treat it as directional — "design for a fast scan" —
  not gospel.
- **Much portfolio/recruiter advice comes from content-marketing sources** (bootcamps, resume
  tools, portfolio builders) with an incentive to assert confident round numbers (e.g., "80% of
  employers want clean code," "70% want variety"). I've prioritized primary studies (Ladders 2018,
  CoderPad 2022), first-hand recruiter analyses, and named practitioners; treat the round-number
  survey stats as softer.
- **The widely-cited "Stack Overflow 2024: 73% of hiring managers" and "CareerBuilder: 50%"
  figures** appear only in secondary summaries; I could not confirm them against primary sources
  within scope — cite cautiously. (The confirmed skills-first datapoints are CoderPad's 2022 "57%
  open to dropping the CV" and "23%→39% non-academic hiring.")
- **All "building in public" revenue/follower numbers are self-reported** by founders (that's the
  nature of BIP) and not independently audited; some month-by-month breakdowns come from secondary
  aggregators. Directionally credible, precisely uncertain.
- **Building-in-public fit is genuinely uncertain for Puzzle Lab.** The strongest evidence says BIP
  works best when your audience is *other builders*; puzzle players are not, so its marketing ROI
  may be lower than the hype suggests. Its clearer value for you is portfolio/audience-building
  among the *dev* community — a legitimate but different goal.
- **Cadence advice conflicts:** some say publish frequently for compounding/SEO; indie devlog
  veterans say infrequent-but-meatier avoids unfollows. The reconciliation — frequent *low-friction*
  notes plus occasional *flagship* pieces — is my synthesis, not a single sourced rule.
- **Interactive-explainer effort is high.** Ciechanowski-grade pieces take enormous time; don't let
  the pursuit of the perfect interactive demo stall shipping. Start with one modest widget.

---

### Strong examples worth studying (curated links)

**Portfolios / case-study craft:** Open Doors Careers case-study guide (blog.opendoorscareers.com);
Toptal "All About Process" case-study framework.

**Technical blogs / interactive explainers:** ciechanow.ski (Bartosz Ciechanowski); redblobgames.com
(Amit Patel); joshwcomeau.com (Josh Comeau); jvns.ca (Julia Evans); simonwillison.net (Simon
Willison); danluu.com (Dan Luu); ncase.me (Nicky Case); dlbeer.co.nz/articles/sudoku.html (Daniel
Beer's Sudoku generation writeup).

**Puzzle-source reading:** chiark.greenend.org.uk/~sgtatham/puzzles/ (Simon Tatham's Portable Puzzle
Collection, MIT-licensed source).

**Devlogs / building in public:** TIGSource forums DevLogs board; itch.io devlogs; levels.io;
tonydinh.com; marcfa.st (Marc Lou); The Bootstrapped Founder (Arvid Kahl); howtomarketagame.com
(Chris Zukowski, for store-marketing data); YouTube — Jonas Tyroller, DevDuck.
