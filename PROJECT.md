# llm-viz — a transformer you can stand inside

llm-viz is an interactive 3D instrument, built in Three.js, that shows a real transformer running. You type a prompt; the tokens become ribbons of light; the forward pass plays out in front of you through a tower of layers whose shape *is* the model's parameter count. It exists so that after twenty minutes of play a curious person understands — in their eyes and hands, not just in a formula — why parameters scale as L × H², what the residual stream is and why it matters, what each layer actually does to the vector passing through it, and why making a model wider costs so much more than making it deeper.

This document is the aspiration. It says what the instrument is, what it must make visible, and the few rules that keep it honest. It does not say how to build it.

## The atom: the residual stream is the protagonist

Every textbook diagram draws a transformer as a stack of boxes with an arrow in and an arrow out, and the skip connection as a thin line curving around each box like an afterthought. That picture is backwards. The residual stream is the main road: a vector of width H that enters at the embedding and leaves at the unembedding, and every attention head and every MLP is a side loop that reads a copy of the stream, computes something, and *adds* its result back. Nothing along the way replaces the stream. It is only ever added to, so at the top of the model

    x_L = x_0 + Σ (every attention write) + Σ (every MLP write)

is literally a sum, and a sum can be taken apart. Which layer contributed what, how much each head moved the answer, what the model "believed" halfway up — all of that is recoverable because the stream keeps a running total rather than overwriting it.

So in this instrument the stream is the thing you look at, and everything else is arranged around it. The stream is bright, solid, and always visible. Attention and MLP blocks are glassy side rooms the stream passes beside. The skip path is not a feature you toggle on for a lesson; it is the spine of the scene, and the lesson is that the blocks are the optional part.

## The scene

The stream rises. Tokens enter at the floor as embeddings, climb through L layers, and leave at the top as logits. Up means deeper. Each layer is a slab the stream passes through, and each slab is as wide as the model's hidden dimension.

That orientation is chosen for one reason: it makes both of the model's shape parameters into visible dimensions. L is the height of the tower. H is the width of every slab. And a slab is not just H wide — its footprint is H × H, because a layer's weights are H × H matrices: four of them in attention (Q, K, V, O) and the equivalent of eight in the MLP (H × 4H in, 4H × H out). A layer is twelve weight matrices stacked into one slab, so a slab's volume is 12 H² and the tower's volume is 12 L H². **The tower's volume is the parameter count.** Double H and every slab's footprint quadruples; double L and the tower gets twice as tall. Nobody has to be told L × H². They can see that a tall skinny tower is cheap and a short wide one is not.

The embedding is the floor slab, V × H, and for small models it is embarrassingly large — in GPT-2 small it is 38.6M of the 124M parameters. Watching that floor shrink to a sliver as H and L grow is one of the quiet lessons in the room.

### Inside a slab

Fly into a layer and it opens into its anatomy, laid out along the stream's direction of travel:

- **The stream** — a ribbon of H lanes running straight through the slab's core. Cyan. Untouched by anything in the slab until a write merges into it.
- **Layer norm** — a thin translucent plane the branch reads *through*. It does not alter the stream; it produces a normalized read copy for the branch. This is pre-LN, the modern arrangement: x ← x + Attn(LN(x)), then x ← x + MLP(LN(x)). A white flash marks each read.
- **Attention** — the read copy splits into n_heads parallel lanes, each d_head = H / n_heads wide, sitting side by side and running at the same time. Each head throws arcs to earlier tokens' ribbons (its attention pattern), gathers what it attends to, and emits its output. The head outputs concatenate back to width H, pass through W_O, and merge into the stream as an addition: magenta light joining cyan.
- **MLP** — the read copy fans out to 4H, a visible bulge four times the stream's width, passes the nonlinearity, narrows back to H, and merges as another addition. Violet joining cyan.
- **The merge points** — two per layer, where a branch's write rejoins the stream. Nothing else ever touches the stream.

A prompt of n tokens is n ribbons standing side by side along the depth axis. Attention arcs are the only thing that ever crosses between ribbons, and that is the single most important fact the layout has to make obvious: every MLP is per-token (each ribbon has its own bulge, and they never touch), and attention is the *only* place information moves between positions. The causal mask is visible as a rule of the room — arcs only reach backward, never forward.

Dimensions are labeled where they change: V → H at the embedding, H along the stream, H / n_heads at each head, 4H at the MLP's widest, H → V at the unembedding. Every label is computed from the current configuration. None is typed by hand.

### The color language

Dark ground, neon light, and every color means exactly one thing:

- **Cyan** — carried unchanged along the residual stream.
- **Magenta** — written by attention.
- **Violet** — written by an MLP.
- **White** — a normalized read (layer norm) or the final norm before the unembedding.

Colors mix where writes merge, so the stream's color at any height is the blend of everything added into it so far, and the top of the tower glows with the whole history of the pass. Side branches are glassy so the reader sees data being transformed inside them; the stream is opaque so it reads as the thing that persists.

## The forward pass, animated

Type a prompt and a real model runs it. The reference model is GPT-2 small — L = 12, H = 768, 12 heads of width 64, 124M parameters — running in the browser with no server behind it. At every read and every merge point the instrument captures the actual activations, and the light on screen is those numbers:

- A ribbon's brightness at any height is the actual norm of that token's residual vector there. In GPT-2 the residual norm grows layer over layer — a real, slightly surprising fact the viewer discovers by looking, and the final layer norm is what tames it before the unembedding.
- An attention arc's thickness is the actual attention weight between those two positions in that head.
- A head's or MLP's write glows in proportion to the norm of what it actually added.

Nothing in the animation is invented. When a scene shows something that no real model computed — the gradient view, or a configuration no loaded checkpoint matches — the scene says so on screen. That rule is the fidelity bar, and it is what separates an instrument from a cartoon.

Time is scrubbable. One clock drives the whole pass; play it, pause it at any layer, step it head by head, drag it backward. A slow pass through a single layer, with the stream paused mid-merge and the two writes hovering beside it, is where most of the understanding happens.

### Taking the stream apart

Click the stream at any height and it fans apart into its contributors: the embedding, every earlier head's write, every earlier MLP's write, each sized by its norm and colored by its source. This is the sum from the atom, made physical. The viewer can see that at layer 6 the answer is mostly three heads and one MLP, and that a head they can name is doing the work.

Beside the fanned stream sits the logit lens: what the model would predict if it stopped *here*. As the viewer drags upward the prediction sharpens, wobbles, commits. Watching a running answer refine itself layer by layer is the best single demonstration that the residual stream carries the model's current belief and every layer edits it rather than starting over.

## Parameters, made visible

A live ledger sits beside the tower and never disagrees with it. For the current configuration it shows the count, the formula with the real numbers plugged in, and the share per component:

    per layer   attention  4H²  (+ 4H bias)
                MLP        8H²  (+ 5H bias)
                layer norm 4H
    embedding   V · H
    positional  n_ctx · H
    final norm  2H
    total       L · (12H² + 13H) + V·H + n_ctx·H + 2H

The ledger is checked against reality: when a real checkpoint is loaded, the count summed from its actual tensor shapes must equal the formula's answer, to the parameter. For GPT-2 small that is 124,439,808 with the unembedding tied to the embedding. A ledger that is off by one is a ledger nobody should trust, so it is never allowed to be.

Density is visible as glow: each slab's intensity is its share of the total, and the floor slab's share shrinks as the tower grows. Compute rides along for free — the forward pass costs roughly 2 × parameters FLOPs per token, so the tower's volume is also the price of every token, with attention's n² · H term showing up as the arcs thicken on longer prompts.

### The what-if ledger

Dragging H or L reshapes the tower and reruns the ledger in real time. Two ghosts make the scaling law felt rather than stated: drag H and watch the count climb on a curve, drag L and watch it climb on a line. A budget mode lets the viewer pick a parameter count and shows the family of (L, H) shapes that spend it — a short wide tower and a tall thin one, overlaid as ghosts of the same volume — so "same size, different shape" becomes a picture.

Presets snap to real models so the ledger has anchors the viewer may already know: the GPT-2 family (small 12 × 768, medium 24 × 1024, large 36 × 1280, XL 48 × 1600) at minimum. Only the reference model runs live; the others shape the tower and fill the ledger honestly and say that they are shapes, not running weights.

## Interaction

The instrument is played, not watched. Everything the brief asks for is here, and each control changes values the scene is already rendering rather than switching the scene into a different program:

- **Sliders** for H, L, and the number of heads. The tower and ledger follow in real time with a smooth transition so the eye can track what grew.
- **A prompt box.** Type text; tokens appear as ribbons; the pass runs; the ledger and the decomposition update to those activations.
- **Time control.** Play, pause, speed, scrub, step per head.
- **Click a layer** to fly in and open the slab. **Click a head** to isolate its arcs for the current prompt, see its d_head lanes, and watch its write merge alone.
- **Residual toggle.** Turning the residual stream off is the one destructive experiment the instrument offers. With the skip gone, each block's output becomes the next block's *only* input: the stream's color at the top is now purely the last layer's write, the decomposition shows a single contributor, and the logit lens stops making sense partway up. That is what the residual protects against, shown by removing it.
- **Gradient view.** Reverse the flow. Gradient enters at the top and descends; along the residual it passes unchanged — the identity term in ∂x_{l+1}/∂x_l = I + ∂f/∂x — while inside each branch it is bent by that branch's Jacobian. With the residual toggle off, the descending light dims layer by layer and has nearly nothing left at the floor: the vanishing gradient, visible. This view is labeled schematic; the instrument does not run a real backward pass.
- **Camera.** Free orbit, plus presets: side elevation (the tower as a whole), top-down (footprints, the H² lesson), and inside (standing in the stream, looking up).

## The lessons

These are the moments the guided tour walks through, in order. Each is a thing to see, and each ends with something the viewer can do to prove they saw it.

1. **Volume is parameter count.** Look at the tower from the side, then from above. Drag H; drag L. Prove it: predict the count for a shape you haven't tried, then set it.
2. **Wide is expensive, deep is cheap.** Budget mode, two ghosts of the same volume. Prove it: starting from GPT-2 small, reach 10× the parameters by moving only L, then by moving only H, and say how far each slider had to travel.
3. **The stream is a sum.** Fan the stream apart at three heights. Prove it: find the layer at which a specific head's write is the largest contributor.
4. **Heads run in parallel, and attention is the only bridge between tokens.** Open a layer; watch every head fire at once; watch the MLP bulges never touch. Prove it: point to the only kind of light that crosses between ribbons.
5. **The stream carries a running answer.** Logit lens from floor to top. Prove it: find the first layer at which the model's top prediction matches its final one.
6. **The residual is a gradient highway.** Gradient view with the residual on, then off. Prove it: say what the identity term does to the light.
7. **H lanes are shared by everyone.** Every write in the whole model lands in the same H-wide stream; norms grow; the final norm rescales. Prove it: watch a ribbon's brightness from floor to top and explain the white plane at the top.
8. **The floor is bigger than you think.** Embedding share at GPT-2 small versus XL. Prove it: say roughly what fraction of a 124M model is vocabulary.

## Fidelity bar

High fidelity means three things here, and all three are required.

The numbers are real. Counts are computed, activations are captured from a real pass, and anything schematic is labeled schematic. No silent stand-ins: if the browser cannot run the model or the GPU path the instrument needs, the instrument says exactly that instead of quietly drawing something else.

The picture is real. Every particle is GPU-instanced; the tower at GPT-2 XL's shape holds 60 frames per second on an Apple-silicon laptop; transitions never drop frames; nothing allocates per frame. The scene is a function of five inputs — configuration, activations, the clock, the camera, and the view flags — and nothing else. Change an input and the same pipeline draws the new state.

The lesson is real. A viewer who completes the tour can pass its eight proofs. That is the only definition of "educational" this project accepts.

## Principles that shape the build

Few, and each earns its place by preventing a specific way the instrument could go wrong.

**One configuration.** The model's shape — L, H, heads, d_ff, V, n_ctx — lives in exactly one structure. Geometry, labels, the ledger, and the loaded checkpoint are all derived from it or checked against it; the checkpoint's own shape is loaded *into* that structure, never kept as a second copy beside it. The constraint that H divides evenly by the head count is enforced where the configuration is built, and nowhere else. `[LAW:one-source-of-truth]` `[LAW:single-enforcer]`

**The scene is a pure function.** Rendering always runs the same pipeline in the same order; the sliders, toggles, and clicks change the values flowing through it. The residual toggle sets the skip path's contribution, it does not branch into a different renderer. The gradient view reverses the clock's direction and swaps the light's source, it does not swap the scene. `[LAW:dataflow-not-control-flow]`

**One clock.** The forward-pass animation, the transitions, and the particle motion all read a single timeline. Scrubbing sets that timeline; nothing keeps its own timer. `[ui: one timing authority]`

**The ledger is verified, not trusted.** The parameter formula and the checkpoint's tensor shapes are compared by a test, and the instrument does not ship if they disagree. Every lesson's proof is something a test can also perform against the rendered state. `[LAW:verifiable-goals]`

**No cartoon fallbacks.** When the real thing is unavailable, say so. A schematic labeled schematic teaches; a schematic pretending to be data lies. `[guideline: no-silent-fallbacks]`

## What this is not

It is not a training simulator; it runs inference and explains gradients schematically. It is not a chat interface; the prompt box exists to make activations, not conversation. It is not a general neural-network diagramming tool; it knows one architecture deeply rather than many shallowly. It is not a paper; anything it claims, it shows.

## Done means

- The reference model runs in the browser and the ledger matches its checkpoint to the parameter.
- Every control in the Interaction section works, and a Playwright suite exercises each one against the rendered state.
- All eight lesson proofs can be performed by a viewer and asserted by a test.
- 60 fps at GPT-2 XL's shape on an Apple-silicon laptop, with no console warnings or errors.
- A stranger with no ML background finishes the tour and can state, unprompted, why L × H² and what the residual stream is.
