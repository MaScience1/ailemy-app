/**
 * Tier 1 marking — the deterministic tier produces REAL marks, so every rule
 * it applies is asserted here rather than trusted.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/deterministic.test.ts
 *
 * No database, no network, no key: deterministic.ts is pure, which is what
 * makes this suite possible and what makes Tier 1 authoritative.
 */
import { markMcq, markNumeric, parseNumber, extractMcqKey, tierFor } from "../../../src/lib/exam/deterministic.ts";
let pass=0, fail=0;
const t=(name:string, cond:boolean, got?:unknown)=>{ if(cond){pass++;console.log("  ✓ "+name);} else {fail++;console.log("  ✗ "+name+(got!==undefined?"  got: "+JSON.stringify(got):""));} };

console.log("── MCQ key extraction (the one place Tier 1 reads examiner prose) ──");
t("Q1 criterion → B", extractMcqKey("The only correct answer is B (neutron number 44, electron number 36)")==="B");
t("Q2 criterion → A", extractMcqKey("The only correct answer is A (0.072 dm3)")==="A");
t("fails CLOSED on unfamiliar prose", extractMcqKey("An answer that makes reference to the following points:")===null);
t("does not grab a stray capital", extractMcqKey("Award the mark for a Balanced equation")===null);

console.log("\n── MCQ marking ──");
const mcqCrit=[{pointCode:"M1",criterion:"The only correct answer is B (neutron number 44, electron number 36)"}];
let r:any = markMcq({kind:"mcq",choice:"B"},1,null,mcqCrit);
t("correct choice → 1/1", r.markable && r.awarded===1 && r.confidence==="deterministic", r);
r = markMcq({kind:"mcq",choice:"C"},1,null,mcqCrit);
t("wrong choice → 0/1, still markable", r.markable && r.awarded===0, r);
t("wrong choice names the right one", r.markable && r.points[0].evidence.includes("correct answer is B"));
r = markMcq(null,1,null,mcqCrit);
t("no answer → 0/1", r.markable && r.awarded===0);
r = markMcq({kind:"mcq",choice:"b"},1,null,mcqCrit);
t("lowercase b accepted", r.markable && r.awarded===1);
r = markMcq({kind:"mcq",choice:"B"},1,null,[{pointCode:"M1",criterion:"garbled"}]);
t("unreadable scheme → NOT markable (never a silent 0)", !r.markable, r);

console.log("\n── number parsing (student keyboards, examiner notation) ──");
const cases:[string,number|null][]=[["0.0172",0.0172],["307",307],["3.591",3.591],
  ["245 310 000",245310000],["245,310,000",245310000],["4.15x10-4",0.000415],
  ["4.15 × 10-4",0.000415],["1.72e-2",0.0172],["3.591%",3.591],["−307",-307],
  ["about 307",null],["",null],["abc",null],["1.2.3",null]];
for(const [input,want] of cases) {
  const got=parseNumber(input);
  const ok = want===null ? got===null : (got!==null && Math.abs(got-want) <= Math.abs(want)*1e-9);
  t(`"${input}" → ${want}`, ok, got);
}

console.log("\n── regression: scientific notation must match an exact-match answer ──");
{
  const specExact={expectedValue:"0.000415",expectedUnit:null,tolerance:null,acceptedValues:null,marksOnCorrectAnswer:1,requiresUnit:false};
  const one=[{pointCode:"M1",criterion:"c"}];
  let rr:any = markNumeric({kind:"numeric",value:"4.15x10-4"},1,specExact,one);
  t("4.15x10-4 matches 0.000415 with NO examiner tolerance", rr.markable && rr.awarded===1, rr);
  rr = markNumeric({kind:"numeric",value:"0.000415"},1,specExact,one);
  t("plain decimal still matches", rr.markable && rr.awarded===1);
  rr = markNumeric({kind:"numeric",value:"0.00042"},1,specExact,one);
  t("a genuinely different value still fails", rr.markable && rr.awarded===0, rr.awarded);
}

console.log("\n── numeric: 20(a), scheme OVERRIDES to 4 (why no general rule is possible) ──");
const spec20a={expectedValue:"0.0172",expectedUnit:"mol",tolerance:0.005,acceptedValues:null,marksOnCorrectAnswer:4,requiresUnit:true};
const c4=[1,2,3,4].map(i=>({pointCode:"M"+i,criterion:"c"+i}));
r = markNumeric({kind:"numeric",value:"0.0172",unit:"mol"},4,spec20a,c4);
t("exact + unit → 4/4 (full marks, per the scheme)", r.markable && r.awarded===4, r);
r = markNumeric({kind:"numeric",value:"0.01721",unit:"mol"},4,spec20a,c4);
t("within 0.5% → 4/4", r.markable && r.awarded===4);
r = markNumeric({kind:"numeric",value:"0.0172",unit:""},4,spec20a,c4);
t("missing required unit on a MULTI-mark q → not_markable, not 0/4", !r.markable, r);
r = markNumeric({kind:"numeric",value:"0.0172",unit:"g"},4,spec20a,c4);
t("wrong unit on a MULTI-mark q → not_markable (never a confirmed 0)", !r.markable, r);
r = markNumeric({kind:"numeric",value:"172",unit:"mol"},4,spec20a,c4);
t("wrong value on a MULTI-mark q → not_markable, method may have scored", !r.markable && /method may still have earned/.test(r.reason), r);
r = markNumeric({kind:"numeric",value:"roughly 0.017",unit:"mol"},4,spec20a,c4);
t("unparseable → NOT markable (not marked wrong)", !r.markable, r);

console.log("\n── THE UNDER-MARKING GUARD: 20(b)(iii), 6 method marks, one value ──");
const spec6={expectedValue:"307",expectedUnit:"kg",tolerance:null,acceptedValues:["306"],marksOnCorrectAnswer:6,requiresUnit:true};
const c6=[1,2,3,4,5,6].map(i=>({pointCode:"M"+i,criterion:"c"+i}));
r = markNumeric({kind:"numeric",value:"307",unit:"kg"},6,spec6,c6);
t("scheme states 6 → 6/6", r.markable && r.awarded===6, r.awarded);
r = markNumeric({kind:"numeric",value:"306",unit:"kg"},6,spec6,c6);
t("accepted alternate 306 → 6/6", r.markable && r.awarded===6);
const spec6NoFull={...spec6,marksOnCorrectAnswer:null};
r = markNumeric({kind:"numeric",value:"307",unit:"kg"},6,spec6NoFull,c6);
t("scheme silent (null) → not_markable, NEVER a default award of 1", !r.markable, r);
t("...reason names the missing transcription rather than guessing",
  !r.markable && /hasn't been recorded/.test(r.reason), r.reason);

console.log("\n── DEFECT 2 GUARD: a stated figure below the tariff must not round up ──");
{
  // The case a boolean could not express: scheme says 4, question is worth 6.
  const spec4of6={expectedValue:"307",expectedUnit:"kg",tolerance:null,acceptedValues:null,marksOnCorrectAnswer:4,requiresUnit:true};
  let rr:any = markNumeric({kind:"numeric",value:"307",unit:"kg"},6,spec4of6,c6);
  t("scheme says 4 on a 6-mark question → 4, not 6", rr.markable && rr.awarded===4, rr.awarded);
  // A transcription error above the tariff must be capped, not honoured.
  const spec9of6={...spec4of6,marksOnCorrectAnswer:9};
  rr = markNumeric({kind:"numeric",value:"307",unit:"kg"},6,spec9of6,c6);
  t("stated 9 on a 6-mark question → capped to 6", rr.markable && rr.awarded===6, rr.awarded);
  const spec0={...spec4of6,marksOnCorrectAnswer:0};
  rr = markNumeric({kind:"numeric",value:"307",unit:"kg"},6,spec0,c6);
  t("stated 0 → awards 0 even when correct", rr.markable && rr.awarded===0, rr.awarded);
}

console.log("\n── numeric without a unit requirement: 22(c) percentage yield ──");
const spec22c={expectedValue:"3.591",expectedUnit:null,tolerance:0.01,acceptedValues:null,marksOnCorrectAnswer:3,requiresUnit:false};
r = markNumeric({kind:"numeric",value:"3.591"},3,spec22c,[1,2,3].map(i=>({pointCode:"M"+i,criterion:"c"})));
t("dimensionless answer, no unit given → 3/3", r.markable && r.awarded===3, r);
r = markNumeric({kind:"numeric",value:"3.59"},3,spec22c,[{pointCode:"M1",criterion:"c"}]);
t("3.59 within 1% → awarded", r.markable && r.awarded>0);

console.log("\n── no expected answer recorded (0031 not applied / not populated) ──");
r = markNumeric({kind:"numeric",value:"307"},6,{...spec6,expectedValue:null},c6);
t("→ NOT markable, never guesses from prose", !r.markable && /No expected answer/.test(r.reason), r);

console.log("\n── tier routing ──");
t("mcq → deterministic", tierFor("mcq")==="deterministic");
t("numeric_with_unit → deterministic", tierFor("numeric_with_unit")==="deterministic");
t("long_text → ai", tierFor("long_text")==="ai");
t("structure → unmarkable", tierFor("structure")==="unmarkable");
t("graph → unmarkable", tierFor("graph")==="unmarkable");
t("chemical_equation → unmarkable", tierFor("chemical_equation")==="unmarkable");

console.log(`\n${fail===0?"✓ ALL":"✗"} ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
