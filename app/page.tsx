import Link from "next/link"
import { ApiKeyPanel } from "@/components/api-key-panel"

type GameCard = {
  title: string
  blurb: string
  href?: string
  status: "Playable" | "Not ported"
  note?: string
}

const DEMO_GAMES: GameCard[] = [
  {
    title: "Qubit Park",
    blurb:
      "Terrain generation via a single-qubit process. Scroll an infinite world where every tile is decided by a quantum circuit.",
    href: "/play/qubit-park",
    status: "Playable",
  },
  {
    title: "Quantum Caverns",
    blurb:
      "A quantum maze game: navigate from start to exit within a step limit. Maze generation is quantum blur, run entirely on the Moth platform.",
    href: "/play/quantum-caverns",
    status: "Playable",
    note: "Requires an Atlas API key. The source doubles as a tutorial for calling the Moth platform from a coccoon game.",
  },
]

const FEATURED_GAMES: GameCard[] = [
  {
    title: "Celeste (Quantum Remix)",
    blurb:
      "A full port of Celeste Classic by Maddy Thorson & Noel Berry. The physics and levels are faithful to the original; each solid tile flickers between three quantum sprite variants made with Moth's TESSA tool.",
    href: "/play/celeste",
    status: "Playable",
  },
]

export default function MenuPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-emerald-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-16">
        <header className="flex flex-col gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-emerald-500">Moth Quantum · web port</p>
          <h1 className="text-balance font-mono text-4xl font-bold tracking-tight text-emerald-300 sm:text-6xl">
            coccoon
          </h1>
          <p className="max-w-2xl text-pretty text-base leading-relaxed text-emerald-100/80">
            A quantum game engine and incubator: a small, sharable way to build games whose logic runs on{" "}
            <a
              href="https://platform.mothquantum.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
            >
              Atlas, the Moth platform
            </a>
            . The engine renders to a virtual <span className="font-mono text-emerald-300">32×18</span> cell grid.
            Simple quantum effects run in the browser on{" "}
            <span className="font-mono text-emerald-300">MicroMoth</span>, a lightweight statevector simulator; heavier
            work — like Quantum Caverns&apos; maze generation — runs on Atlas using an API key you provide below.
          </p>
          <ApiKeyPanel />
        </header>

        <section aria-labelledby="demo-heading" className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 id="demo-heading" className="font-mono text-sm uppercase tracking-[0.3em] text-emerald-500">
              Demo games
            </h2>
            <p className="text-sm text-emerald-100/60">
              Small, self-contained examples that each demonstrate one way to bring quantum into a game.
            </p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_GAMES.map((game) => (
              <li key={game.title}>
                <GameTile game={game} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="featured-heading" className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 id="featured-heading" className="font-mono text-sm uppercase tracking-[0.3em] text-emerald-500">
              Featured games
            </h2>
            <p className="text-sm text-emerald-100/60">
              Full games ported to coccoon, given a quantum twist.
            </p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_GAMES.map((game) => (
              <li key={game.title}>
                <GameTile game={game} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="create-heading" className="flex flex-col gap-6">
          <h2 id="create-heading" className="font-mono text-sm uppercase tracking-[0.3em] text-emerald-500">
            Create
          </h2>
          <Link href="/create" className="block">
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-700/60 bg-emerald-950/40 p-6 transition-colors hover:border-emerald-500 hover:bg-emerald-900/40 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <h3 className="font-mono text-base font-semibold text-emerald-200">Code your own cartridge</h3>
                <p className="max-w-2xl text-pretty text-sm leading-relaxed text-emerald-100/70">
                  A fantasy-console-style editor. Write JavaScript against the same engine the built-in games use —
                  sprites, text, per-frame input, and the <span className="font-mono text-emerald-300">MicroMoth</span>{" "}
                  quantum simulator — and run it live in the browser.
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs uppercase tracking-widest text-emerald-400">Open editor →</span>
            </div>
          </Link>
        </section>

        <section aria-labelledby="about-heading" className="flex flex-col gap-4 border-t border-emerald-950 pt-10">
          <h2 id="about-heading" className="font-mono text-sm uppercase tracking-[0.3em] text-emerald-500">
            About this port
          </h2>
          <div className="grid gap-6 text-sm leading-relaxed text-emerald-100/75 sm:grid-cols-2">
            <p>
              The original coccoon is a Godot 4 project written in GDScript. This is a faithful web reimplementation:
              the engine primitives (<span className="font-mono">Sprite</span>,{" "}
              <span className="font-mono">Text</span>, <span className="font-mono">ImageList</span>,{" "}
              <span className="font-mono">update()</span>) render to an HTML5 canvas instead of Godot scene nodes.
            </p>
            <p>
              MicroMoth is ported line-for-line, keeping the same statevector representation and{" "}
              <span className="font-mono">simulate()</span> output modes (
              <span className="font-mono">statevector</span>, <span className="font-mono">probabilities_dict</span>,{" "}
              <span className="font-mono">counts</span>, <span className="font-mono">memory</span>). Game code ports
              across almost verbatim.
            </p>
          </div>
          <a
            href="https://github.com/moth-quantum/coccoon"
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit font-mono text-xs uppercase tracking-widest text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
          >
            Original source on GitHub →
          </a>
        </section>
      </div>
    </main>
  )
}

function GameTile({ game }: { game: GameCard }) {
  const playable = game.status === "Playable" && game.href

  const inner = (
    <div
      className={`flex h-full flex-col gap-3 rounded-xl border p-5 transition-colors ${
        playable
          ? "border-emerald-700/60 bg-emerald-950/40 hover:border-emerald-500 hover:bg-emerald-900/40"
          : "border-neutral-800 bg-neutral-900/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-mono text-base font-semibold text-emerald-200">{game.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
            playable ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-700/40 text-neutral-400"
          }`}
        >
          {game.status}
        </span>
      </div>
      <p className="text-pretty text-sm leading-relaxed text-emerald-100/70">{game.blurb}</p>
      {game.note ? <p className="mt-auto text-xs italic text-neutral-500">{game.note}</p> : null}
      {playable ? (
        <span className="mt-auto font-mono text-xs uppercase tracking-widest text-emerald-400">Play →</span>
      ) : null}
    </div>
  )

  if (playable) {
    return (
      <Link href={game.href!} className="block h-full">
        {inner}
      </Link>
    )
  }
  return inner
}
