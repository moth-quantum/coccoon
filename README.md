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
| **Benji the Blob** | Lead your quantum pet to food and avoid ticks, across procedurally generated terrain computed with quantum circuits. Port of the Pico-8 original by Decodoku. |
| **Celeste** | Full port of the Pico-8 original by Matt Thorson & Noel Berry. Sprites modfied via Moth's TESSA tool.|
| **Deep Space O'Brien** | Quantum maze game: navigate from start to beam-out point within a step limit. The maze is generated with quantum circuits, and your previous loop's path stays visible as a dim trail. |
| **Demo** | Terrain generation via a single qubit process. Intended as an example game.|

## WIP Games

| Game | Description |
|------|-------------|
| **Q-Snake** | Snake with a quantum twist: hitting the barrier triggers a quantum coin flip — tunnel through or die. Apple positions chosen with quantum randomness. Port of a Qiskit Camp Europe 2019 hackathon game. |
| **Q-Qube** | Manipulate a 2-qubit quantum statevector using quantum gates, visualised as permuted 4×4 blocks on an 8×8 display. Port of a Qiskit Camp Europe 2019 hackathon game. |

## PewPew Ports

Ports of games from the PewPew handheld, included as examples of how PewPew games translate to coccoon.

| Game | Description |
|------|-------------|
| **Snake** | Classic snake on an 8×8 LED grid. Port of the PewPew original. |

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
