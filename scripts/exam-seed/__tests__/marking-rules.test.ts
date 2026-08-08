/**
 * Tier 1 marking — the deterministic tier produces REAL marks, so every rule
 * it applies is asserted here rather than trusted.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/marking-rules.test.ts
 *
 * No database, no network, no key: deterministic.ts is pure, which is what
 * makes this suite possible and what makes Tier 1 authoritative.
 */
import { markNumeric, markMcq, WORKING_NOT_CAPTURED } from "../../../src/lib/exam/deterministic.ts";
let pass=0, fail=0;
const t=(n:string,c:boolean,g?:unknown)=>{c?(pass++,console.log("  ✓ "+n)):(fail++,console.log("  ✗ "+n+(g!==undefined?"  got: "+JSON.stringify(g):"")));};
const pts=(n:number)=>Array.from({length:n},(_,i)=>({pointCode:"M"+(i+1),criterion:"c"}));
const base={expectedUnit:"kg",tolerance:0.005,acceptedValues:["306"],requiresUnit:true};

console.log("── RULE 1: match → award marks_on_correct_answer; remainder excluded ──");
{
  const spec={...base,expectedValue:"307",marksOnCorrectAnswer:2};
  const r:any = markNumeric({kind:"numeric",value:"307",unit:"kg"},6,spec,pts(6));
  t("awarded = 2 (not 6, not 1)", r.markable && r.awarded===2, r.awarded);
  t("assessedOutOf = 2 — denominator EXCLUDES the rest", r.markable && r.assessedOutOf===2, r.assessedOutOf);
  t("unassessedMarks = 4", r.markable && r.unassessedMarks===4, r.unassessedMarks);
  t("reason is the canonical phrase", r.markable && r.unassessedReason===WORKING_NOT_CAPTURED, r.unassessedReason);
  t("student would see 2/2, never 2/6", r.markable && `${r.awarded}/${r.assessedOutOf}`==="2/2");
  const r1:any = markNumeric({kind:"numeric",value:"306",unit:"kg"},6,{...spec,marksOnCorrectAnswer:1},pts(6));
  t("marks=1 variant → 1/1 confirmed, 5 unassessed", r1.markable && r1.awarded===1 && r1.assessedOutOf===1 && r1.unassessedMarks===5);
}

console.log("\n── RULE 2: mismatch on a MULTI-mark question → not_markable, never 0 ──");
{
  const spec={...base,expectedValue:"307",marksOnCorrectAnswer:2};
  let r:any = markNumeric({kind:"numeric",value:"250",unit:"kg"},6,spec,pts(6));
  t("wrong value → markable:false", !r.markable, r);
  t("...reason cites working not captured", !r.markable && r.reason.includes(WORKING_NOT_CAPTURED));
  t("...tells the student their method may have earned marks", !r.markable && /method may still have earned/.test(r.reason));
  r = markNumeric({kind:"numeric",value:"307",unit:"g"},6,spec,pts(6));
  t("RIGHT value, WRONG unit → not_markable, awards nothing", !r.markable, r);
  r = markNumeric({kind:"numeric",value:"307",unit:""},6,spec,pts(6));
  t("RIGHT value, NO unit → not_markable (no partial credit for the value)", !r.markable);
  r = markNumeric(null,6,spec,pts(6));
  t("blank answer on multi-mark → not_markable, not a 0", !r.markable, r);
}

console.log("\n── RULE 3: mismatch on a 1-MARK numeric → genuine confirmed 0 ──");
{
  const spec={expectedValue:"307",expectedUnit:null,tolerance:null,acceptedValues:null,marksOnCorrectAnswer:1,requiresUnit:false};
  let r:any = markNumeric({kind:"numeric",value:"250"},1,spec,pts(1));
  t("wrong → markable:true, awarded 0", r.markable && r.awarded===0, r);
  t("...assessedOutOf 1, nothing excluded", r.markable && r.assessedOutOf===1 && r.unassessedMarks===0);
  r = markNumeric(null,1,spec,pts(1));
  t("blank on 1-mark → confirmed 0", r.markable && r.awarded===0);
  r = markNumeric({kind:"numeric",value:"307"},1,spec,pts(1));
  t("correct → 1/1", r.markable && r.awarded===1 && r.assessedOutOf===1);
}

console.log("\n── NO DEFAULTING: null marks_on_correct_answer is never 'award 1' ──");
{
  const spec={...base,expectedValue:"307",marksOnCorrectAnswer:null};
  const r:any = markNumeric({kind:"numeric",value:"307",unit:"kg"},6,spec,pts(6));
  t("correct answer, no figure recorded → not_markable", !r.markable, r);
  t("...and does NOT silently award 1", !r.markable);
}

console.log("\n── 20(a): the override that forbids a general answer+unit rule ──");
{
  const spec={expectedValue:"0.0172",expectedUnit:"mol",tolerance:0.005,acceptedValues:null,marksOnCorrectAnswer:4,requiresUnit:true};
  const r:any = markNumeric({kind:"numeric",value:"0.0172",unit:"mol"},4,spec,pts(4));
  t("scheme says 4 → 4/4, nothing unassessed", r.markable && r.awarded===4 && r.assessedOutOf===4 && r.unassessedMarks===0, r);
  t("(a hardcoded answer+unit=2 rule would have given 2 here)", r.awarded===4);
}

console.log("\n── MCQ unchanged: a wrong option is a real 0 ──");
{
  const c=[{pointCode:"M1",criterion:"The only correct answer is B (x)"}];
  let r:any = markMcq({kind:"mcq",choice:"C"},1,null,c);
  t("wrong MCQ → confirmed 0/1", r.markable && r.awarded===0 && r.assessedOutOf===1 && r.unassessedMarks===0);
  r = markMcq({kind:"mcq",choice:"B"},1,null,c);
  t("right MCQ → 1/1", r.markable && r.awarded===1);
}

console.log("\n── cap still holds ──");
{
  const spec={...base,expectedValue:"307",marksOnCorrectAnswer:9};
  const r:any = markNumeric({kind:"numeric",value:"307",unit:"kg"},6,spec,pts(6));
  t("stated 9 on 6-mark → capped 6, 0 unassessed", r.markable && r.awarded===6 && r.unassessedMarks===0, r.awarded);
}

console.log(`\n${fail===0?"✓ ALL":"✗"} ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
