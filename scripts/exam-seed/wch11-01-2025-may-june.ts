/**
 * SEED FIXTURE — Edexcel IAL Chemistry WCH11/01, May–June 2025.
 *
 * ============================================================================
 * PROVENANCE
 * ============================================================================
 * Every `criterion` string below is transcribed from the mark scheme PDF held
 * in Supabase Storage at
 *   papers/f7577346-3c45-4b3a-b944-d52542863358/markscheme-1786027939731.pdf
 * and every question label and mark tariff from the question paper at
 *   papers/f7577346-3c45-4b3a-b944-d52542863358/paper-1786027939730.pdf
 *
 * Transcribed, not summarised. Where the mark scheme prints an unlabelled
 * bullet — which is most of them — the point code M1, M2, … is assigned in
 * PRINTED ORDER by this file. That mapping is a convention introduced here,
 * and marking_results.point_code will refer to it by string forever, so
 * renumbering a point after any marking has happened silently orphans those
 * results. Add, never renumber.
 *
 * ----------------------------------------------------------------------------
 * HOW THE MARK SCHEME'S COLUMNS MAP ONTO 0028
 * ----------------------------------------------------------------------------
 * Every mark-scheme row is printed as FOUR columns: Question Number | Answer |
 * Additional Guidance | Mark. Since migration 0029 this file maps them by
 * WHAT A MARKER MUST DO with each line, not by which column it came from:
 *
 *   Answer column bullet        -> criterion   what earns the mark
 *   "Allow …" / "Accept …"      -> accept[]    still earns it
 *   "Ignore …"                  -> accept[]    award it despite X
 *   "Do not award …"            -> reject[]    must NOT earn it
 *   worked examples, TE rules   -> guidance    neither; prose
 *
 * `reject[]` is the point of the exercise. Before 0029 there was one array
 * called `accepted_alternatives` holding all of the above, and "Do not award
 * ions move" sat in it looking exactly like an accepted alternative. See
 * 23(c)(ii) M1 below for the case that forced the migration.
 *
 * THE ONE CAVEAT WORTH KNOWING. The Additional Guidance column is ONE MERGED
 * CELL spanning every bullet in the row, so splitting it per point is an
 * INTERPRETATION, not something the PDF states. Where a line plainly belongs
 * to one point ("Accept 13H2O(g)" -> the state-symbols mark) it is attached
 * there; where it governs the whole row ("Allow TE throughout") it is
 * attached to the LAST point. No information is dropped, but the attribution
 * is editorial. Section A rows have no guidance column at all — they are
 * printed with three columns — so their points carry no `guidance`.
 *
 * `acceptedAlternatives` is no longer written by anything. The column survives
 * in the database until its own migration drops it; the validator now rejects
 * a fixture that still populates the field, so content cannot be silently
 * stranded there.
 *
 * `topic` is authored EXCEPT where the examiner report names it in so many
 * words; those carry a `// examiner report:` comment. `specPoint` is omitted
 * throughout — the specification document is not in the repository and
 * plausible-looking spec codes are exactly the kind of invention the rest of
 * this work has avoided. The column is nullable; fill it from the spec.
 *
 * ============================================================================
 * WHY THESE SEVENTEEN QUESTIONS
 * ============================================================================
 * This is a TYPE-COVERAGE set, not a complete paper — `complete: false`, which
 * switches off the "leaf marks must sum to 80" check. It is chosen so that
 * every answer_type the marking engine must handle appears at least once, on
 * real content, before any of it is built:
 *
 *   mcq                Q1, Q2            — deterministic marking, no model
 *   other (container)  Q20, 20(b), 21, 21(c), 22, 23, 23(c)
 *   numeric_with_unit  20(a), 20(b)(iii) — 4-mark and 6-mark method chains
 *   short_text         20(b)(i)          — one-line definition
 *   chemical_equation  20(b)(ii)         — balancing + state symbols
 *   structure          20(b)(iv)         — drawn skeletal formulae
 *   graph              21(c)(i)          — plotted points on a supplied grid
 *   numeric            22(c)             — two accepted method chains
 *   long_text          23(c)(ii)         — "Explain", 2 marks
 *
 * Q20 is seeded IN FULL (4+1+2+6+2 = 15, the printed total), so the parent /
 * child / grandchild path is exercised end to end rather than sampled. The
 * three other Section B questions contribute one leaf each, with their real
 * containers, so that a later pass seeding the rest of Q21 can attach to an
 * existing 21(c) instead of re-parenting rows that marking already references.
 *
 * NOT covered by this paper, and knowingly left for later:
 *   mechanism   22(a) asks candidates to NAME a mechanism, not draw one — it
 *               is short_text. A drawn mechanism is an A2 (WCH14) question.
 *   apparatus   Unit 1 is theory-only. Apparatus lives in the practical
 *               units, WCH13 and WCH16.
 *   freehand    Reserved for the "student drew something we cannot classify"
 *               fallback; there is no paper question that should use it.
 *
 * ============================================================================
 * REGIONS ARE DELIBERATELY ABSENT
 * ============================================================================
 * Not one question below carries a `regions` entry, and the importer supports
 * them fully. The reason is that a bbox is the one field that cannot be
 * authored responsibly from a text dump: it is only correct if someone has
 * seen it drawn over the rendered page. A wrong bbox is strictly worse than a
 * missing one — it silently highlights the wrong half of the page for every
 * student, and nothing about it looks wrong in a diff.
 *
 * Producing approved regions is the entire job of the admin mapping tool, and
 * 0028 already models the handoff: question_regions.approved_by /
 * approved_at are NULL until a human signs off. Questions seeded from this
 * file are readable and markable; they are not yet *locatable* on the page.
 */

import type { QuestionSet } from "../../src/lib/exam/question-set.ts";

export const WCH11_01_2025_MAY_JUNE: QuestionSet = {
  // past_papers.id — NOT the slug. "unit-1-may-june-2025" is unique only
  // within edexcel-ial-as-chemistry; other courses hold the same slug.
  paperId: "f7577346-3c45-4b3a-b944-d52542863358",

  expect: {
    paperCode: "WCH11/01",
    session: "May-June",
    year: 2025,
    totalMarks: 80,
  },

  // 25 of 80 marks. See "WHY THESE SEVENTEEN QUESTIONS" above.
  complete: false,

  questions: [
    // ========================================================================
    // SECTION A — multiple choice, question paper p2
    // ========================================================================
    // The mark scheme prints the key AND a rationale for each distractor.
    // Both are captured: the criterion holds the key, because that is what
    // marking compares against, and the distractor rationales go in reject[]
    // so the feedback layer can explain a wrong answer without a model call.
    // An MCQ is the only answer_type that never needs one.
    //
    // NOTE ON THE SECTION A TABLES: they are printed with THREE columns —
    // Question Number | Answer | Mark — with no Additional Guidance column at
    // all. So every Section A point has guidance: undefined, and that is the
    // document's shape rather than an omission.
    {
      questionNumber: "1",
      parentQuestionNumber: null,
      displayOrder: 10,
      marks: 1,
      answerType: "mcq",
      commandWord: "Which row shows",
      topic: "Atomic structure", // examiner report: "Question 1 (atomic structure)"
      // MS p5 · "The only correct answer is B (neutron number 44, electron
      // number 36)". An MCQ's answer IS its single mark.
      expectedAnswer: { value: "B", marksOnCorrectAnswer: 1 },
      questionText:
        "Which row shows the numbers of neutrons and electrons in a bromide ion 79Br- ?\n" +
        "\n" +
        "       Number of neutrons   Number of electrons\n" +
        "  A          44                    35\n" +
        "  B          44                    36\n" +
        "  C          46                    35\n" +
        "  D          46                    36",
      markScheme: [
        {
          pointCode: "M1",
          criterion:
            "The only correct answer is B (neutron number 44, electron number 36)",
          // Distractor rationales are reject[], not accept[]: each names a
          // wrong option and why. Put them in accept[] and an MCQ marker would
          // credit all four options.
          reject: [
            "A is incorrect because the number of electrons is for a 79Br atom",
            "C is incorrect because the number of neutrons is for a 81Br atom",
            "D is incorrect because the number of neutrons is for a 81Br- ion",
          ],
        },
      ],
      examinerInsights: [
        {
          insightText:
            "Candidates of all abilities gained marks on Question 1 (atomic structure).",
          insightType: "strong_candidates",
        },
      ],
    },
    {
      questionNumber: "2",
      parentQuestionNumber: null,
      displayOrder: 20,
      marks: 1,
      answerType: "mcq",
      commandWord: "What volume",
      topic: "Moles and gas volumes",
      // MS p5 · "The only correct answer is A (0.072 dm3)"
      expectedAnswer: { value: "A", marksOnCorrectAnswer: 1 },
      questionText:
        "What volume of sulfur dioxide gas reacts completely with 50 cm3 of 0.12 mol dm-3 sodium hydroxide solution?\n" +
        "\n" +
        "[molar volume of a gas = 24 dm3 at room temperature and pressure]\n" +
        "\n" +
        "SO2   +   2NaOH   →   Na2SO3   +   H2O\n" +
        "\n" +
        "  A  0.072 dm3\n" +
        "  B  0.144 dm3\n" +
        "  C  0.288 dm3\n" +
        "  D  72 dm3",
      markScheme: [
        {
          pointCode: "M1",
          criterion: "The only correct answer is A (0.072 dm3)",
          reject: [
            "B is incorrect because it has not allowed for the correct stoichiometry (not divided by 2)",
            "C is incorrect because it has not allowed for the correct stoichiometry (multiplied by 2)",
            "D is incorrect because the concentration has not been divided by 1000",
          ],
        },
      ],
    },

    // ========================================================================
    // SECTION B — Q20, seeded in full. Question paper pp10–12.
    // ========================================================================
    // Q20 and 20(b) are CONTAINERS: they hold the stem and the shared context
    // a student needs to answer the parts, and carry 0 marks so that the
    // leaves own the tariff. Summing a container's own marks alongside its
    // children's is the standard way these totals end up doubled.
    {
      questionNumber: "20",
      parentQuestionNumber: null,
      displayOrder: 200,
      marks: 0,
      answerType: "other",
      topic: "Moles, combustion and organic formulae",
      questionText: "This question is about carbon dioxide.",
    },
    {
      questionNumber: "20(a)",
      parentQuestionNumber: "20",
      displayOrder: 210,
      marks: 4,
      answerType: "numeric",
      commandWord: "Calculate",
      topic: "The ideal gas equation",
      // `numeric`, NOT numeric_with_unit. MS p14 lists four points — convert,
      // convert, substitute, evaluate — and NONE of them is a unit mark, so a
      // unit field here could only ever cost marks. The stem supplies the
      // quantity anyway ("Calculate the moles"), exactly as 20(b)(iii)'s
      // supplies "in kg". Same shape, same ruling.
      // MS p14 · M4 guidance: "n = 0.0172 mol"
      //          M4 guidance: "Correct answer with no working scores (4)" -> 4
      //          M4 accept:   "Ignore SF except 1 SF" -> a tolerance, not exact
      //
      // `unit` is deliberately absent: the answer type is `numeric`, so no
      // unit is collected and none may be required. marksOnCorrectAnswer
      // stays 4 — this is the paper's one explicit "no working" override, and
      // it is why no general answer-plus-unit rule can exist in the marker.
      expectedAnswer: {
        value: "0.0172",
        tolerance: 0.005,
        marksOnCorrectAnswer: 4,
      },
      questionText:
        "According to data from 2021, there are 415 ppm of carbon dioxide in the atmosphere by volume.\n" +
        "\n" +
        "Calculate the moles of carbon dioxide present in 1.00 m3 of air at 20.0 °C and 101 kPa.\n" +
        "\n" +
        "[Ideal gas equation pV = nRT\n" +
        "R = 8.31 J mol-1 K-1]",
      // The guidance cell prints a four-line worked example, one line per
      // bullet, so it splits cleanly across M1–M4 for once.
      markScheme: [
        {
          pointCode: "M1",
          criterion: "convert °C to K",
          guidance: "Example of calculation\n20 + 273 = 293",
        },
        {
          pointCode: "M2",
          criterion: "kPa to Pa and 415 cm3 to m3",
          guidance:
            "101 x 1000 = 101000 and 415 ÷ 1000000 = 415 x 10-6 / 4.15 x 10-4",
        },
        {
          pointCode: "M3",
          criterion: "substitution into pV = nRT and rearrangement",
          guidance: "n = 101000 × 415 x 10-6 ÷ 8.31 × 293",
        },
        {
          pointCode: "M4",
          criterion: "evaluation",
          // "Ignore SF except 1 SF" is an ACCEPT rule: it says award the mark
          // regardless of significant figures unless only one is given.
          accept: ["Ignore SF except 1 SF"],
          guidance:
            "n = 0.0172 mol\n" +
            "TE on M1 and M2 but no TE from M3 to M4\n" +
            "Correct answer with no working scores (4)",
        },
      ],
      examinerInsights: [
        {
          insightText:
            "The majority of candidates scored 3 of the 4 available marks, the final mark being lost for not converting cubic centimetres into cubic metres.",
          insightType: "common_error",
        },
      ],
    },
    {
      questionNumber: "20(b)",
      parentQuestionNumber: "20",
      displayOrder: 220,
      marks: 0,
      answerType: "other",
      topic: "Combustion of dodecane",
      questionText:
        "Dodecane C12H26, is found in kerosene and forms carbon dioxide during its complete combustion.",
    },
    {
      questionNumber: "20(b)(i)",
      parentQuestionNumber: "20(b)",
      displayOrder: 230,
      marks: 1,
      answerType: "short_text",
      commandWord: "State",
      topic: "Complete combustion",
      questionText: "State what is meant by complete combustion.",
      markScheme: [
        {
          pointCode: "M1",
          criterion: "(burned / reacted) in sufficient / excess oxygen",
          accept: [
            "Allow a reaction in which all of the atoms in the fuel are fully oxidised",
            "Ignore any reference to carbon dioxide and water",
          ],
        },
      ],
    },
    {
      questionNumber: "20(b)(ii)",
      parentQuestionNumber: "20(b)",
      displayOrder: 240,
      marks: 2,
      answerType: "chemical_equation",
      commandWord: "Write",
      topic: "Balanced equations with state symbols",
      questionText:
        "Write a balanced equation for the complete combustion of dodecane, C12H26.\n" +
        "Include state symbols.",
      markScheme: [
        {
          pointCode: "M1",
          criterion: "correctly balanced equation",
          accept: ["Allow multiples"],
          guidance: "C12H26(l) + 18.5O2(g) → 12CO2(g) + 13H2O(l)",
        },
        {
          pointCode: "M2",
          criterion: "state symbols correct",
          accept: ["Accept 13H2O(g)"],
        },
      ],
      examinerInsights: [
        {
          // examiner report p9, "Question 20(b)ii-iii" — maps straight onto M2.
          insightText:
            "Many candidates were able to balance but several lost the state symbol mark, with dodecane labelled as (g), (s) and occasionally (aq).",
          insightType: "common_error",
        },
      ],
    },
    {
      questionNumber: "20(b)(iii)",
      parentQuestionNumber: "20(b)",
      displayOrder: 250,
      marks: 6,
      // `numeric`, NOT numeric_with_unit, and the two decisions are one:
      // marksOnCorrectAnswer is 1 because the stem already supplies the unit
      // ("Calculate the mass, in kg"), so there is no separate unit mark to
      // earn — and a question with no unit mark must not ask for a unit it
      // cannot credit. Compare 20(a), where the unit is NOT given in the stem.
      answerType: "numeric",
      commandWord: "Calculate",
      topic: "Multi-step mass calculation",
      // MS p15 · M6 guidance: "307 (kg)"
      //          M6 accept:   "Allow 306 (kg)" -> acceptedValues
      //          M6 criterion: "calculation of mass (kg) of carbon dioxide/
      //                        passenger and to 3SF" — ONE point, not two
      //
      // marksOnCorrectAnswer: 1, set by the examiner. This scheme carries NO
      // "correct answer scores N" override, so Pearson's default shape applies
      // — and the stem already gives the unit, so the usual unit mark is not
      // available here. The remaining 5 are method marks this app cannot see:
      // the editor captured one value, not the working.
      //
      // ⚠ The 1 and the `numeric` answer type above are the same decision. Do
      // not raise this to 2 without also restoring numeric_with_unit, or the
      // marker would award a unit mark for a unit it never collected.
      expectedAnswer: {
        value: "307",
        acceptedValues: ["306"],
        tolerance: 0.005,
        marksOnCorrectAnswer: 1,
      },
      questionText:
        "Kerosene is used as aeroplane fuel. A jet plane can carry a maximum of 800 passengers and uses 11 400 dm3 of fuel per hour.\n" +
        "\n" +
        "Calculate the mass, in kg, of carbon dioxide emitted from the engine per passenger on a full flight from Sydney to Hong Kong, flight time 9 hours 15 minutes.\n" +
        "\n" +
        "Give your answer to three significant figures.\n" +
        "\n" +
        "[Assume kerosene consists solely of C12H26\n" +
        "Density of dodecane = 0.749 g cm-3]",
      markScheme: [
        {
          pointCode: "M1",
          criterion: "calculation of litres of fuel used",
          guidance: "Example of calculation\n(11400) × 9.25 = 105 450 (1.0545 × 105)",
        },
        {
          pointCode: "M2",
          criterion: "calculation of mass of fuel used",
          guidance: "(105 450) × 0.749 (× 1000) = 78 982 000 (7.8982 × 107)(g)",
        },
        {
          pointCode: "M3",
          criterion: "calculation of mol of fuel used",
          guidance: "(78 982 000) ÷ 170 = 464 600 (4.6460 × 105) (mol)",
        },
        {
          pointCode: "M4",
          criterion: "calculation of mol of carbon dioxide",
          guidance:
            "(464 600) × 12 = 5 575 200 (5.5752 × 106) (mol)\n(check mole ratio from 20bii)",
        },
        {
          pointCode: "M5",
          criterion: "calculation of mass of carbon dioxide",
          guidance: "(5 575 200) × 44 = 245 310 000 (2.4531 × 108) (g)",
        },
        {
          pointCode: "M6",
          criterion:
            "calculation of mass (kg) of carbon dioxide/passenger and to 3SF",
          // Row-wide rules land on the last point — see the header note on the
          // merged guidance cell.
          accept: [
            "Allow 306 (kg)",
            "Allow 307000 / 306000 g",
            "If all six operations have not been carried out ignore SF",
            "Allow TE throughout",
          ],
          guidance:
            "(245 310 000) ÷ 800 (÷ 1000)= (306 640 (3.0664 × 105) (g)\n307 (kg)",
        },
      ],
      examinerInsights: [
        {
          // examiner report p3, Introduction.
          insightText:
            "Some of the questions were more challenging, particularly the multi-step calculation Q20(b)(iii).",
          insightType: "warning",
        },
        {
          // examiner report p9, "Question 20(b)ii-iii". Materially useful to a
          // marker: it says the six steps may be done in any order, which is
          // why the mark scheme allows TE throughout.
          insightText:
            "All the operations involved either multiplication or division and consequently the order of the operations did not affect the final value.",
        },
      ],
    },
    {
      questionNumber: "20(b)(iv)",
      parentQuestionNumber: "20(b)",
      displayOrder: 260,
      marks: 2,
      answerType: "structure",
      commandWord: "Draw",
      topic: "Skeletal formulae and isomers",
      questionText:
        "The formula C12H26 represents many isomers, including six diethyloctanes. The names of four of these diethyloctanes are\n" +
        "\n" +
        "3,3-diethyloctane, 3,4-diethyloctane, 3,5-diethyloctane, 3,6-diethyloctane.\n" +
        "\n" +
        "Draw the skeletal formulae of the remaining two diethyloctanes.",
      // ⚠ THE ONE QUESTION WHOSE MARK SCHEME IS NOT TEXT. The two criteria are
      // printed as IMAGES of skeletal formulae (confirmed: mark scheme p16
      // carries exactly two embedded images and the answer-column bullets
      // extract as empty strings). Only the guidance column is machine-
      // readable.
      //
      // The criteria below are therefore DESCRIBED, not transcribed, and are
      // the only strings in this file that are not verbatim — the [DIAGRAM]
      // prefix marks them so no reader mistakes them for mark-scheme wording.
      // The descriptions were read off a 150 dpi render of the page, not
      // guessed: the question names 3,3-, 3,4-, 3,5- and 3,6-diethyloctane,
      // and the two printed structures are the remaining pair — one with both
      // ethyl groups on the same carbon, one with them on adjacent carbons.
      //
      // Adequate to display and to route a marking request; NOT adequate to
      // mark against automatically. A drawn answer needs a vision model and a
      // human check regardless, so nothing is lost today. Revisit when the
      // extractor can crop the mark-scheme image and store it alongside.
      markScheme: [
        {
          pointCode: "M1",
          criterion:
            "[DIAGRAM, NOT TEXT — see mark scheme p16] skeletal formula of 4,4-diethyloctane (both ethyl groups on the same carbon)",
          accept: ["Ignore any names even if incorrect"],
        },
        {
          pointCode: "M2",
          criterion:
            "[DIAGRAM, NOT TEXT — see mark scheme p16] skeletal formula of 4,5-diethyloctane (ethyl groups on adjacent carbons)",
          accept: ["Allow 1 mark for two correct non skeletal formulae"],
        },
      ],
      examinerInsights: [
        {
          // examiner report p3, Introduction.
          insightText:
            "Question 20(b)(iv), drawing the two missing diethyl isomers of dodecane, was among the more challenging questions on the paper.",
          insightType: "warning",
        },
        {
          // examiner report p14, "Question 20(b)iv" — the actual reasoning
          // step candidates missed, which the Introduction does not give.
          insightText:
            "This question was aimed at the most able candidates. In order to answer the question, it was necessary to realise that the ethyl branches had to be placed on at least the third carbon in from either end, otherwise they were just increasing the carbon chain length.",
          insightType: "common_error",
        },
      ],
    },

    // ========================================================================
    // Q21 — one leaf, with its real containers. Question paper p14.
    // ========================================================================
    {
      questionNumber: "21",
      parentQuestionNumber: null,
      displayOrder: 300,
      marks: 0,
      answerType: "other",
      topic: "Ionisation energies",
      questionText: "This question is about ionisation energy.",
    },
    {
      questionNumber: "21(c)",
      parentQuestionNumber: "21",
      displayOrder: 310,
      marks: 0,
      answerType: "other",
      topic: "Period 2 first ionisation energies",
      // questionText deliberately omitted: the paper prints "(c)" and moves
      // straight to "(i)", with no (c)-level stem of its own. This container
      // exists purely as a parent so that 21(c)(ii) and 21(c)(iii) — not
      // seeded here — have somewhere to attach later. The other six
      // containers all carry real stems; this one has nothing to carry, and a
      // fabricated sentence would be worse than a null.
    },
    {
      questionNumber: "21(c)(i)",
      parentQuestionNumber: "21(c)",
      displayOrder: 320,
      marks: 3,
      answerType: "graph",
      commandWord: "Plot",
      topic: "Plotting ionisation energy against element",
      questionText:
        "Plot the following first ionisation energies of the elements in Period 2 on the grid below.\n" +
        "\n" +
        "  Element                            Li   Be    B     C     N     O     F    Ne\n" +
        "  1st ionisation energy / kJ mol-1  520  900  801  1086  1402  1314  1681  2081",
      // The interesting case for the marking engine: the marks are for the
      // ARTEFACT (axes, scale, plotted points), not for a value. Marking this
      // needs the student's drawn layer and the grid it was drawn on — which
      // is why question_regions matters more here than anywhere else.
      markScheme: [
        {
          pointCode: "M1",
          criterion: "axes labelled correctly with units on y axis",
          accept: ["Allow x axis as atomic numbers", "Allow log axis on y axis"],
        },
        {
          pointCode: "M2",
          criterion: "suitable scale",
          // This is guidance, not an accept: it does not widen what earns M2,
          // it DEFINES what "suitable" means and therefore narrows it.
          guidance:
            "Points plotted must cover at least 50% of the graph in both directions",
        },
        {
          pointCode: "M3",
          criterion: "all points correctly plotted",
          accept: [
            "Allow ±1 small square",
            "Ignore lines between points / line of best fit",
          ],
        },
      ],
      // ⚠ THE TWO INSIGHTS BELOW DISAGREE, AND BOTH ARE KEPT ON PURPOSE.
      // The Introduction says this was answered well; the dedicated section
      // says poor and non-linear scales cost candidates BOTH the scale and the
      // plotting marks. Carrying only the Introduction line — which is what
      // this fixture did before the mark-scheme audit — labels the question
      // strong_candidates and hides the single most common way to lose 2 of
      // its 3 marks. Where the report contradicts itself, store both.
      examinerInsights: [
        {
          // examiner report p3, Introduction.
          insightText:
            "The graphical Question 21(c)(i) was answered well by the majority of candidates.",
          insightType: "strong_candidates",
        },
        {
          // examiner report p23, "Question 21(c)i".
          insightText:
            "There were several very poor choices of scale and this made plotting more difficult for the candidates. There were also non-linear scales and this meant it was not possible to award either the scale or plotting marks. Lines were not required on the graph.",
          insightType: "common_error",
        },
      ],
    },

    // ========================================================================
    // Q22 — one leaf, with its container. Question paper p17.
    // ========================================================================
    {
      questionNumber: "22",
      parentQuestionNumber: null,
      displayOrder: 400,
      marks: 0,
      answerType: "other",
      topic: "Alkanes and halogens",
      questionText:
        "This question is about alkanes and halogens.\n" +
        "Alkanes can react with halogens to form halogenoalkanes.",
    },
    {
      questionNumber: "22(c)",
      parentQuestionNumber: "22",
      displayOrder: 410,
      marks: 3,
      answerType: "numeric",
      commandWord: "Calculate",
      topic: "Percentage yield",
      // M3 guidance: "1/ 27.844 x 100 = 3.591%" · "Correct answer with some working scores 3".
      // No unit: a percentage yield is dimensionless, which is why this is
      // `numeric` and not `numeric_with_unit`.
      // MS p23 · M3 guidance: "1/ 27.844 x 100 = 3.591%"
      //          M3 accept:   "Ignore SF except for 1 SF" -> a tolerance
      //
      // ⚠ marksOnCorrectAnswer IS DELIBERATELY OMITTED, and the omission is
      // the ruling. The scheme says "Correct answer with some working scores
      // 3" — note "with SOME working", where 20(a) four questions earlier says
      // "with NO working". The wording differs on purpose, and this app
      // captures no working at all, so the condition can never be satisfied.
      //
      // A correct 3.591 therefore reports 0 confirmed with all 3 marks needing
      // review. Setting 3 here would award the full tariff on a bare answer
      // the examiner conditions on evidence we do not have.
      expectedAnswer: {
        value: "3.591",
        tolerance: 0.01,
      },
      questionText:
        "Calculate the percentage yield if 1.00 g of trichlorobutane is produced from 10.0 g butane using the overall equation shown.\n" +
        "\n" +
        "C4H10   +   3Cl2   →   C4H7Cl3   +   3HCl",
      // `numeric` rather than `numeric_with_unit`: a percentage yield is
      // dimensionless, and demanding a unit would mark a correct answer wrong.
      // The distinction exists precisely for this pair of cases.
      //
      // TWO ACCEPTED METHOD CHAINS lead to the same answer, and the mark
      // scheme prints both. They are stored as ONE set of three points with
      // the alternative route recorded per point, because the tariff is three
      // marks total however the candidate got there — storing six points would
      // make a correct script look like it scored 3/6.
      markScheme: [
        {
          pointCode: "M1",
          criterion: "calculation of moles of butane",
          guidance:
            "Example of calculation\n" +
            "10/58 = 0.17241 mol butane\n" +
            "Alternative method M1 — calculation of moles of butane: 10/58 = 0.17241 mol butane",
        },
        {
          pointCode: "M2",
          criterion: "calculation of theoretical mass of trichlorobutane",
          guidance:
            "mol trichlorobutane 0.17241\n" +
            "0.17241 x 161.5 = 27.844(g)\n" +
            "Alternative method M2 — calculation of actual moles of trichlorobutane: 1/161.5 = 6.19195 x 10-3",
        },
        {
          pointCode: "M3",
          criterion: "% yield",
          accept: ["Ignore SF except for 1 SF"],
          // "final answer must be less than 100%" is a constraint on what may
          // be credited, but the mark scheme states it as prose rather than as
          // a "Do not award …" rule, so it is recorded verbatim here rather
          // than rewritten into reject[]. Rewriting it would put words in the
          // examiner's mouth in the one array that can veto a mark.
          guidance:
            "1/ 27.844 x 100 = 3.591%\n" +
            "Alternative method M3 — % yield ((M2/M1) x 100)): [6.19195 x 10-3 / 0.17241] x 100 = 3.591%\n" +
            "TE throughout, but final answer must be less than 100%\n" +
            "Correct answer with some working scores 3",
        },
      ],
      examinerInsights: [
        {
          // examiner report p38, "Question 22(c)".
          insightText:
            "A percentage yield question, accessible to all candidates with over half the cohort scoring all three marks.",
          insightType: "strong_candidates",
        },
        {
          // examiner report p39, the annotated candidate clip. This is the
          // most actionable insight in the whole set: it names the specific
          // wrong procedure a marker should expect to see.
          insightText:
            "The clip shows a response where the atom economy has been calculated instead of the percentage yield.",
          insightType: "common_error",
        },
      ],
    },

    // ========================================================================
    // Q23 — one leaf, with its containers. Question paper p22.
    // ========================================================================
    {
      questionNumber: "23",
      parentQuestionNumber: null,
      displayOrder: 500,
      marks: 0,
      answerType: "other",
      topic: "Structure and bonding", // examiner report: "Q23 was about structure and bonding"
      questionText: "This question is about structure and bonding.",
    },
    {
      questionNumber: "23(c)",
      parentQuestionNumber: "23",
      displayOrder: 510,
      marks: 0,
      answerType: "other",
      topic: "Metallic bonding in copper",
      questionText: "Metals are held together by metallic bonding.",
    },
    {
      questionNumber: "23(c)(ii)",
      parentQuestionNumber: "23(c)",
      displayOrder: 520,
      marks: 2,
      answerType: "long_text",
      commandWord: "Explain",
      topic: "Delocalised electrons and electrical conductivity",
      questionText:
        "Metals conduct electricity when solid.\n" +
        "\n" +
        "Explain, with the aid of a diagram, why copper conducts electricity.",
      // The canonical model-marked case: free prose, a named misconception to
      // penalise ("Do not award ions move"), and a second mark that can be
      // earned by a DIAGRAM instead of by words. Marking it needs both the
      // text layer and the drawn layer of a student_responses row.
      markScheme: [
        {
          pointCode: "M1",
          criterion:
            "delocalised electrons are able to move / flow (through the lattice and carry a charge)",
          // THE REASON 0029 EXISTS. Under the old single-array shape this line
          // sat in a field called accepted_alternatives, where a marker
          // reading "another way to earn the mark" would award M1 to a
          // candidate who said the IONS move — the one answer the examiner
          // names and forbids. The examiner report corroborates from the other
          // side: the clip shows an ionic lattice mistaken for a metallic one.
          reject: ["Do not award ions move"],
        },
        {
          pointCode: "M2",
          criterion:
            "diagram showing lattice of Cu2+ ions and (sea of) electrons interspersed within the structure – approximately twice as many electrons as ions",
          accept: ["Delocalised electrons may be labelled in the diagram"],
        },
      ],
      examinerInsights: [
        {
          // examiner report p62, "Question 23(c)ii". Note how precisely this
          // corroborates M1's "Do not award ions move" — the report and the
          // mark scheme are describing the same failure from two directions.
          insightText:
            "This question about metallic bonding was aimed at all candidates, just over 40% of the cohort scored one mark for this question. The clip show what appears to be an ionic lattice rather than a metallic lattice. There is no mention of the delocalised electrons being able to move. Know the difference between the different types of lattices.",
          insightType: "common_error",
        },
      ],
    },
  ],
};
