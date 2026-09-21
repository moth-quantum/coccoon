# coccoon

A simple quantum game engine and incubator of quantum games, built at [Moth Quantum](https://mothquantum.com).

## Lineage

This project is the latest incarnation of an idea that has gone through several forms.

It began as a Jupyter-based game engine in the **Qiskit textbook**, where interactive quantum games were used to teach quantum computing concepts in an accessible, playful way. This was inspired by the **PewPew** — a tiny open-source handheld console with an 8×8 monochrome LED display.

The engine then evolved into **qisge**, a standalone version of the same idea with Qiskit built in

Coccoon is the current form: a Godot 4 game engine that renders to a virtual 32×18 cell grid. Simple quantum circuits are provided by **MicroMoth**, a lightweight statevector simulator that runs entirely in GDScript. But coccoon is truly intended to incubate simple games made using [Atlas](https://platform.mothquantum.com/), the Moth platform.


## Games

| Game | Description |
|------|-------------|
| **Qubit Park** | Terrain generation via a single qubit process. The source is a good tutorial for how to use coccoon — straightforward enough to read top to bottom and see how a game is put together. |
| **Celeste (Quantum Remix)** | Full port of the Pico-8 original by Matt Thorson & Noel Berry. Sprites modified via Moth's TESSA tool. |
| **Quantum Caverns** | Quantum maze game: navigate from start to exit within a step limit. Maze generation uses the Moth blur-core-v1 API (falling back to local QuantumBlur). The source is a tutorial for calling the Moth API from a coccoon game. |


## Structure

- `coccoon.gd` — the engine autoload: sprite, text, and image list classes, input handling, 32×18 grid
- `micromoth.gd` — quantum circuit simulator (statevector, sampling, probabilities)
- `quantumblur.gd` — quantum blur utilities
- `games/` — one subdirectory per game, each self-contained

## Engine

Games are written as Godot scenes with a single GDScript. The engine exposes:

- `coccoon.Sprite` — a positioned, scaled image on the grid
- `coccoon.Text` — a text label with font size, colour, and background
- `coccoon.ImageList` — loads a list of images or colours as swappable sprite frames
- `coccoon.update()` — returns current key presses each frame

Quantum computation is done via `MicroMoth.QuantumCircuit` and `MicroMoth.simulate()`, which supports `statevector`, `probabilities_dict`, `counts`, and `memory` output modes.
