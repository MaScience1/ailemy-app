import type { Deck } from "../types.ts";

/**
 * Biology and Physics preview decks for /dev/flashcards (§32, §33).
 *
 * ⚠ THESE ARE THEME AND LAYOUT FIXTURES, NOT TEACHING MATERIAL. They exist so
 * the green and blue identities, the comparison card, the diagram slot and the
 * formula card can be judged against real-length content. Ailemy teaches no
 * Biology or Physics yet and these are not attached to any lesson (§55).
 *
 * The science is accurate anyway — a fixture that taught something wrong would
 * be a liability the moment somebody copied it into a real deck.
 *
 * ⚠ MEDIA PATHS HERE ARE DELIBERATELY ABSENT. The diagram card is shown with
 * its caption and frame so the LAYOUT can be judged; pointing at an asset that
 * does not exist would demonstrate a broken image rather than a diagram, and
 * the error state is tested separately.
 */

export const BIOLOGY_PREVIEW_DECK: Deck = {
  id: "preview-bio",
  subject: "biology",
  title: "Cell division",
  topic: "Mitosis and meiosis",
  description: "Preview deck — demonstrates the green identity, comparison and process layouts.",
  cards: [
    {
      id: "b1",
      type: "definition",
      title: "Mitosis",
      front: [
        {
          kind: "definition",
          term: "Mitosis",
          body: "Nuclear division producing two genetically identical diploid daughter cells.",
        },
        {
          kind: "callout",
          tone: "exam",
          body: "Say **genetically identical** and **diploid** — both are marking points.",
        },
      ],
    },
    {
      id: "b2",
      type: "comparison",
      title: "Mitosis vs meiosis",
      front: [
        {
          kind: "compare",
          left: {
            label: "Mitosis",
            points: ["Two daughter cells", "Diploid (2n)", "Genetically identical", "Growth and repair"],
          },
          right: {
            label: "Meiosis",
            points: ["Four daughter cells", "Haploid (n)", "Genetically different", "Gamete formation"],
          },
        },
      ],
      reveal: "Which produces variation, and by what two mechanisms?",
      back: [
        {
          kind: "text",
          body: "**Meiosis** — by **crossing over** in prophase I and **independent assortment** of homologous pairs in metaphase I.",
        },
      ],
    },
    {
      id: "b3",
      type: "key_facts",
      title: "Stages of mitosis",
      front: [
        {
          kind: "steps",
          items: [
            "**Prophase** — chromosomes condense, nuclear envelope breaks down.",
            "**Metaphase** — chromosomes align on the equator.",
            "**Anaphase** — sister chromatids are pulled to opposite poles.",
            "**Telophase** — nuclear envelopes reform around each set.",
          ],
        },
      ],
    },
    {
      id: "b4",
      type: "diagram",
      title: "The cell cycle",
      front: [
        {
          kind: "text",
          body: "Interphase occupies most of the cycle: **G₁** growth, **S** DNA replication, **G₂** preparation. Mitosis and cytokinesis follow.",
        },
        {
          kind: "callout",
          tone: "mistake",
          body: "Interphase is not a *resting* phase — it is the most metabolically active part of the cycle.",
        },
      ],
    },
    {
      id: "b5",
      type: "summary",
      title: "What to take away",
      front: [
        {
          kind: "bullets",
          items: [
            "Mitosis: 2 identical diploid cells, for growth and repair.",
            "Meiosis: 4 genetically different haploid cells, for gametes.",
            "Variation comes from crossing over and independent assortment.",
          ],
        },
      ],
    },
  ],
};

export const PHYSICS_PREVIEW_DECK: Deck = {
  id: "preview-phys",
  subject: "physics",
  title: "Forces and motion",
  topic: "Kinematics and Newton's laws",
  description: "Preview deck — demonstrates the blue identity, formula and worked-example layouts.",
  cards: [
    {
      id: "p1",
      type: "formula",
      title: "Newton's second law",
      front: [
        {
          kind: "formula",
          expression: "F = ma",
          where: [
            { symbol: "F", meaning: "resultant force" },
            { symbol: "m", meaning: "mass" },
            { symbol: "a", meaning: "acceleration" },
          ],
          units: "F in N · m in kg · a in m s⁻²",
        },
        {
          kind: "callout",
          tone: "exam",
          body: "F is the **resultant** force. Resolve and sum before substituting.",
        },
      ],
    },
    {
      id: "p2",
      type: "definition",
      title: "Scalar and vector",
      front: [
        { kind: "definition", term: "Scalar", body: "A quantity with magnitude only." },
        { kind: "definition", term: "Vector", body: "A quantity with both magnitude and direction." },
      ],
      reveal: "Is speed a scalar or a vector? And velocity?",
      back: [
        {
          kind: "text",
          body: "**Speed is scalar; velocity is a vector.** An object moving in a circle at constant speed has continuously changing velocity — which is why it accelerates.",
        },
      ],
    },
    {
      id: "p3",
      type: "worked_example",
      title: "A 1200 kg car accelerating at 2.5 m s⁻²",
      front: [
        { kind: "text", body: "Find the resultant force on the car." },
        {
          kind: "steps",
          items: [
            "List what you have: m = 1200 kg, a = 2.5 m s⁻².",
            "Choose the equation: F = ma",
            "Substitute: F = 1200 × 2.5",
          ],
        },
      ],
      reveal: "Work it through, then check",
      back: [
        { kind: "text", body: "**F = 3000 N** (3.0 kN)" },
        {
          kind: "callout",
          tone: "exam",
          body: "Always quote the unit. A bare *3000* scores nothing.",
        },
      ],
    },
    {
      id: "p4",
      type: "key_facts",
      title: "The suvat equations",
      front: [
        {
          kind: "bullets",
          items: [
            "v = u + at",
            "s = ut + ½at²",
            "v² = u² + 2as",
            "s = ½(u + v)t",
          ],
        },
        {
          kind: "callout",
          tone: "remember",
          body: "They hold only for **constant acceleration**. Check that before you reach for one.",
        },
      ],
    },
    {
      id: "p5",
      type: "exam_tip",
      title: "Units and significant figures",
      front: [
        {
          kind: "callout",
          tone: "exam",
          body: "Quote answers to the same number of significant figures as the least precise datum.",
        },
        {
          kind: "callout",
          tone: "mistake",
          body: "Mixing g and kg in F = ma. Convert to SI **before** substituting, not after.",
        },
      ],
    },
  ],
};
