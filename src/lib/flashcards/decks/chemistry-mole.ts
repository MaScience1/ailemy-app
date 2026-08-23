import type { Deck } from "../types.ts";

/**
 * Sample deck for Lesson 1 — Definitions, formulae and the mole.
 *
 * ============================================================================
 * ⚠ SAMPLE, AND SAID SO EVERYWHERE IT IS SHOWN (§30, §31, §55)
 * ============================================================================
 * These nine cards exist to demonstrate every card type against real Ailemy
 * content. The chemistry is accurate and every fact is one the lesson's own
 * deck teaches — the exam definitions from slides 6 and 9, L = 6.02 × 10²³
 * mol⁻¹ from slide 12, the NaCl formula-unit trap from slide 8, M(H₂O) = 18.0
 * from slide 19, glucose C₆H₁₂O₆ → CH₂O from slide 9 — so nothing here
 * contradicts what a student just watched.
 *
 * ⚠ IT IS NOT A CURRICULUM AND MUST NOT GROW INTO ONE HERE (§55). Authoring
 * the real decks is the founder's, through content, after the visual system is
 * approved. This file is the fixture that proves the system works.
 *
 * ⚠ NO IMAGES ARE REFERENCED. A `media` block would point at an asset path
 * that does not exist, and a broken diagram in a sample deck teaches nothing
 * about how diagrams look. The diagram and image-annotation card types are
 * demonstrated on /dev/flashcards, where placeholder media is honest.
 */
export const CHEMISTRY_MOLE_DECK: Deck = {
  id: "sample-chem-mole",
  subject: "chemistry",
  title: "Definitions, formulae and the mole",
  lessonSlug: "definitions-formulae-and-the-mole",
  topic: "Atoms, formulae and amount of substance",
  description: "The exam definitions, the mole, and the two calculations everything else rests on.",
  specCodes: ["1.1", "1.2"],
  cards: [
    {
      id: "c1",
      type: "definition",
      title: "Atom",
      specCodes: ["1.1"],
      front: [
        {
          kind: "definition",
          term: "Atom",
          body: "The smallest particle of an element that retains its chemical identity.",
        },
        {
          kind: "callout",
          tone: "exam",
          body: "Define the particle the question asks for — not a similar-sounding one. Marks are lost swapping *atom* for *element*.",
        },
      ],
    },
    {
      id: "c2",
      type: "definition",
      title: "Element and ion",
      specCodes: ["1.1"],
      front: [
        {
          kind: "definition",
          term: "Element",
          body: "A substance containing only atoms with the same atomic (proton) number.",
        },
        {
          kind: "definition",
          term: "Ion",
          body: "An atom (or group of atoms) with an overall charge, formed by loss or gain of electrons.",
        },
      ],
      reveal: "Which term is defined by proton number?",
      back: [
        {
          kind: "text",
          body: "**Element.** Proton number is the identity of the element — change it and you have a different element entirely.",
        },
      ],
    },
    {
      id: "c3",
      type: "key_facts",
      title: "Molecule vs compound",
      specCodes: ["1.1"],
      front: [
        {
          kind: "bullets",
          items: [
            "**Molecule** describes *how* atoms are joined — covalently.",
            "**Compound** describes *what* is present — more than one element.",
            "H₂ is a molecule but **not** a compound: one element only.",
            "H₂O is **both** — covalently bonded, two elements.",
          ],
        },
        {
          kind: "callout",
          tone: "mistake",
          body: "NaCl is a **compound but not a molecule**. It is bonded ionically, so say *formula unit*, never *molecule*.",
        },
      ],
    },
    {
      id: "c4",
      type: "definition",
      title: "Empirical and molecular formula",
      specCodes: ["1.1"],
      front: [
        {
          kind: "definition",
          term: "Empirical formula",
          body: "Simplest whole-number ratio of atoms of each element.",
        },
        {
          kind: "definition",
          term: "Molecular formula",
          body: "Actual number of atoms of each element in one molecule.",
        },
        {
          kind: "text",
          body: "Glucose is C₆H₁₂O₆ — divide through by 6 and the empirical formula is CH₂O.",
        },
      ],
      reveal: "What is the empirical formula of ethane, C₂H₆?",
      back: [
        { kind: "text", body: "**CH₃** — divide both subscripts by 2." },
      ],
    },
    {
      id: "c5",
      type: "formula",
      title: "Avogadro's constant",
      specCodes: ["1.2"],
      front: [
        {
          kind: "formula",
          expression: "N = n × L",
          where: [
            { symbol: "N", meaning: "number of specified particles" },
            { symbol: "n", meaning: "amount of substance" },
            { symbol: "L", meaning: "Avogadro's constant, 6.02 × 10²³" },
          ],
          units: "n in mol · L in mol⁻¹",
        },
        {
          kind: "callout",
          tone: "remember",
          body: "L counts **specified particles** — atoms, ions, molecules, electrons or formula units, whichever the question names.",
        },
      ],
    },
    {
      id: "c6",
      type: "formula",
      title: "Amount of substance from mass",
      specCodes: ["1.2"],
      front: [
        {
          kind: "formula",
          expression: "n = m ÷ M",
          where: [
            { symbol: "n", meaning: "amount of substance" },
            { symbol: "m", meaning: "mass" },
            { symbol: "M", meaning: "molar mass" },
          ],
          units: "n in mol · m in g · M in g mol⁻¹",
        },
        {
          kind: "callout",
          tone: "mistake",
          body: "Multiplying instead of dividing is the most common slip. Check: more grams must mean more moles.",
        },
      ],
    },
    {
      id: "c7",
      type: "worked_example",
      title: "How many molecules in 9.0 g of water?",
      specCodes: ["1.2"],
      front: [
        { kind: "text", body: "M(H₂O) = 18.0 g mol⁻¹ · L = 6.02 × 10²³ mol⁻¹" },
        {
          kind: "steps",
          items: [
            "Identify what you have: m = 9.0 g, M = 18.0 g mol⁻¹.",
            "Amount: n = m ÷ M = 9.0 ÷ 18.0 = 0.50 mol",
            "Particles: N = n × L = 0.50 × 6.02 × 10²³",
          ],
        },
      ],
      reveal: "Work it through, then check your answer",
      back: [
        { kind: "text", body: "**N = 3.01 × 10²³ molecules**" },
        {
          kind: "callout",
          tone: "exam",
          body: "Quote to 3 significant figures and say **molecules** — the question asked for a specified particle.",
        },
      ],
    },
    {
      id: "c8",
      type: "exam_tip",
      title: "Exam wording that earns marks",
      specCodes: ["1.1", "1.2"],
      front: [
        {
          kind: "callout",
          tone: "exam",
          body: "Empirical formula: always say **simplest whole-number ratio**. The mark is for the wording.",
        },
        {
          kind: "callout",
          tone: "mistake",
          body: "Writing *number of atoms* for Avogadro's constant. It is **specified particles** — the question decides which.",
        },
        {
          kind: "callout",
          tone: "remember",
          body: "The mole is the **unit**; Avogadro's constant is the **number** of particles in it. They are not the same thing.",
        },
      ],
    },
    {
      id: "c9",
      type: "summary",
      title: "The whole lesson on one card",
      specCodes: ["1.1", "1.2"],
      front: [
        {
          kind: "bullets",
          items: [
            "Atom · element · ion — learn the exam wording, not a paraphrase.",
            "Molecule = how it bonds. Compound = what is in it.",
            "Empirical = simplest ratio. Molecular = actual count.",
            "n = m ÷ M and N = n × L do most of the arithmetic in this unit.",
            "L = 6.02 × 10²³ mol⁻¹, counting whichever particle is specified.",
          ],
        },
      ],
    },
  ],
};
