// ============ Physical model ============
const CORNER_ADJ = { UL:['U','L'], UR:['U','R'], DL:['D','L'], DR:['D','R'] };
function mod12(n){ return ((n % 12) + 12) % 12; }

function newState(){
  return { fCorner:{UL:0,UR:0,DL:0,DR:0}, fEdge:{U:0,D:0,L:0,R:0}, fC:0, bEdge:{U:0,D:0,L:0,R:0}, bC:0 };
}
function applyFrontMove(state, physicalCorners, n){
  if(n===0) return;
  const touched = new Set();
  for(const c of physicalCorners){ state.fCorner[c]=mod12(state.fCorner[c]+n); CORNER_ADJ[c].forEach(e=>touched.add(e)); }
  state.fC = mod12(state.fC+n);
  touched.forEach(e=>{ state.fEdge[e]=mod12(state.fEdge[e]+n); });
}
function applyBackMove(state, physicalCorners, n){
  if(n===0) return;
  const touched = new Set();
  for(const c of physicalCorners){ state.fCorner[c]=mod12(state.fCorner[c]-n); CORNER_ADJ[c].forEach(e=>touched.add(e)); }
  state.bC = mod12(state.bC+n);
  touched.forEach(e=>{ state.bEdge[e]=mod12(state.bEdge[e]+n); });
}
const FRONT_GROUPS = [ ['UR',['UR']],['DR',['DR']],['DL',['DL']],['UL',['UL']],['U',['UL','UR']],['R',['UR','DR']],['D',['DL','DR']],['L',['UL','DL']],['ALL',['UL','UR','DL','DR']] ];
const BACK_GROUPS  = [ ['U',['UL','UR']],['R',['UL','DL']],['D',['DL','DR']],['L',['UR','DR']],['ALL',['UL','UR','DL','DR']] ];
function randTurn(){ return Math.floor(Math.random()*12)-5; }
function fmtTurn(n){ return n>=0 ? (n+'+') : ((-n)+'-'); }
function generateRawScramble(){
  const state = newState(); const tokens = [];
  for(const [label,corners] of FRONT_GROUPS){ const n=randTurn(); applyFrontMove(state,corners,n); tokens.push(label+fmtTurn(n)); }
  tokens.push('y2');
  for(const [label,corners] of BACK_GROUPS){ const n=randTurn(); applyBackMove(state,corners,n); tokens.push(label+fmtTurn(n)); }
  return {state, tokens};
}

// ============ Physical symmetry: 4 rotations x (read as-is / swap which face each term reads) ============
// Derived directly from the 8 confirmed Fall variants: front and back rotate in OPPOSITE directions for
// the same rotation step n (consistent with the front/back mirror relationship established earlier), and
// the remaining 4 of the 8 come from additionally swapping which physical face each formula term reads
// from. (An earlier attempt used the SAME rotation direction for both faces when swapping, which produced
// a false-positive match -- this version was checked against all 8 of your confirmed Fall variants exactly.)
const ROT_F_MAP = { U:'R', R:'D', D:'L', L:'U', UL:'UR', UR:'DR', DR:'DL', DL:'UL', C:'C' };
const ROT_B_MAP = { R:'U', D:'R', L:'D', U:'L', UR:'UL', DR:'UR', DL:'DR', UL:'DL', C:'C' };
function rotateN(map, pos, n){ let p = pos; for(let i=0;i<((n%4)+4)%4;i++) p = map[p]; return p; }
// Canonical x/y/z rotation notation for each (n,swap) orientation label -- this is the physical
// reorientation the solver needs to do STARTING FROM how the puzzle is already held right after the
// scramble (which ends on y2). Verified by literal function composition against comboVal's own
// reading behavior across all 18 grid positions, for many random states -- not derived by hand.
const ORIENTATION_NOTATION = {
  '0-false': 'x2 z2', '0-true': 'z2',
  '1-false': 'x2 z',  '1-true': "z'",
  '2-false': 'x2',    '2-true': 'nothing needed',
  '3-false': "x2 z'", '3-true': 'z',
};
function orientationName(o){ return ORIENTATION_NOTATION[o.n + '-' + o.swap]; }

// ============ x2 back-label -> physical position ============
const X2_TO_PHYS = { UL:'DL', UR:'DR', DL:'UL', DR:'UR', U:'D', D:'U', L:'L', R:'R', C:'C' };
// y2 mirrors left/right, keeps top/bottom -- used only for the visual back-face diagram
const Y2_TO_PHYS = { UL:'UR', UR:'UL', DL:'DR', DR:'DL', U:'U', D:'D', L:'R', R:'L', C:'C' };

function readPosPhys(state, face, physPos){
  // like readPos but takes an already-resolved physical position (used for y2 display)
  if(face==='front'){
    if(physPos==='C') return state.fC;
    if(['U','D','L','R'].includes(physPos)) return state.fEdge[physPos];
    return state.fCorner[physPos];
  } else {
    if(physPos==='C') return state.bC;
    if(['U','D','L','R'].includes(physPos)) return state.bEdge[physPos];
    return mod12(-state.fCorner[physPos]);
  }
}

function readPos(state, face, posLabel){
  if(face==='front'){
    if(posLabel==='C') return state.fC;
    if(['U','D','L','R'].includes(posLabel)) return state.fEdge[posLabel];
    return state.fCorner[posLabel];
  } else {
    const p = X2_TO_PHYS[posLabel];
    if(p==='C') return state.bC;
    if(['U','D','L','R'].includes(p)) return state.bEdge[p];
    return mod12(-state.fCorner[p]);
  }
}

// ============ Term-combination helpers (for Tommy memo, case constraints, and per-case answers) ============
function T_(sign, face, pos){ return {sign, face, pos}; }
function S(face, pos){ return [T_(1,face,pos)]; }
function negC(a){ return a.map(t => ({sign:-t.sign, face:t.face, pos:t.pos})); }
function addC(...combos){ return combos.flat(); }
function subC(a,b){ return addC(a, negC(b)); }
function toC(face, fromPos, toPos){ return subC(S(face,toPos), S(face,fromPos)); } // "fromPos to toPos" = value(to)-value(from)
// "apply A to X, then do X to Y" where X is turned by A first:
function applyToFirst(A, face, X, Y){ return subC(toC(face,X,Y), A); }   // (Y-X) - A
// "apply A to Y (the second term), then do X to Y":
function applyToSecond(A, face, X, Y){ return addC(toC(face,X,Y), A); }  // (Y-X) + A

function comboVal(state, orientation, terms){
  let sum = 0;
  for(const t of terms){
    const effectiveFace = orientation.swap ? (t.face === 'front' ? 'back' : 'front') : t.face;
    const map = effectiveFace === 'front' ? ROT_F_MAP : ROT_B_MAP;
    const rotatedPos = rotateN(map, t.pos, orientation.n);
    sum += t.sign * readPos(state, effectiveFace, rotatedPos);
  }
  return mod12(sum);
}

// Tommy 7s base memo (your calcs). face 'front' = UPPERCASE, 'back' = lowercase (x2-labeled).
const TOMMY_M1 = [ T_(-1,'back','D'), T_(1,'back','C') ];                                                              // -d+c
const TOMMY_M2 = [ T_(-1,'back','R'), T_(1,'back','DR'), T_(-1,'front','L'), T_(1,'front','U') ];                      // -r+dr-L+U
const TOMMY_M3 = [ T_(-1,'front','U'), T_(1,'front','L') ];                                                            // -U+L
const TOMMY_M4 = [ T_(-1,'back','R'), T_(1,'back','D') ];                                                              // -r+d
const TOMMY_M5 = [ T_(-1,'front','U'), T_(1,'front','UR'), T_(-1,'front','D'), T_(1,'front','C'),
             T_(-1,'back','UL'), T_(1,'back','L'), T_(1,'back','R') ];                                                 // -U+UR-D+C-ul+l+r
const TOMMY_M6 = [ T_(-1,'back','C'), T_(1,'back','U'), T_(1,'back','D'),
             T_(-1,'front','L'), T_(1,'front','UL'), T_(-1,'front','R'), T_(1,'front','DR') ];                         // -c+u+d-L+UL-R+DR

// RHS expressions for the two "fake" cases' constraints
const rhsFakeAnkh = [ T_(-1,'front','D'), T_(1,'front','C'), T_(-1,'front','R'), T_(1,'front','DR'), T_(-1,'back','U'), T_(1,'back','L') ]; // D to C + R to DR + u to l
const rhsFakeLine = [ T_(-1,'front','R'), T_(1,'front','D'), T_(-1,'back','L'), T_(1,'back','UL'), T_(-1,'back','U'), T_(1,'back','C') ];   // R to D + l to ul + u to c

// ============ p6s cases ============
// checks: array of {a:terms, b:terms, neg:bool} -- comboVal(a) === comboVal(b), or === -comboVal(b) if neg
// answerFormulas: ordered [{label, combo}] (or {label, note} for non-numeric steps) shown by "Show answer"
const CASE_GROUPS = [
  { title:'Group 1 — UR cases', cases: [
    { name:'L shape', desc:'c = d = r',
      checks:[ {a:S('back','C'),b:S('back','D')}, {a:S('back','D'),b:S('back','R')} ],
      answerFormulas: () => {
        const m1 = addC( toC('back','DR','R'), toC('front','U','L') );        // dr to r + U to L
        const m2 = toC('front','U','L');                                       // U to L
        const m3 = negC( addC( toC('front','C','U'), S('front','D'), toC('back','L','UL') ) ); // -(C to U + D + l to ul)
        const m4 = addC( toC('back','DR','D'), S('back','U'), toC('front','R','DR'), toC('front','L','UL') ); // dr to d + u + R to DR + L to UL
        return [ {label:'m1',combo:m1}, {label:'m2',combo:m2}, {label:'m3',combo:m3}, {label:'m4',combo:m4} ];
      } },
    { name:'Line', desc:'c = u = d',
      checks:[ {a:S('back','C'),b:S('back','U')}, {a:S('back','U'),b:S('back','D')} ],
      answerFormulas: () => {
        const m1 = addC( toC('back','DR','R'), toC('front','U','L') );
        const m2 = addC( toC('front','R','D'), toC('back','L','UL') );
        const m3 = toC('back','R','D');
        const m4 = applyToFirst(m2, 'front','U','L');
        const m5 = negC( addC( toC('front','C','L'), S('front','R') ) );
        const m6 = addC( toC('back','DR','R'), toC('back','UL','L'), S('back','C'), toC('front','U','UL'), toC('front','D','DR') );
        return [ {label:'m1',combo:m1}, {label:'m2',combo:m2}, {label:'m3',combo:m3}, {label:'m4',combo:m4}, {label:'m5',combo:m5}, {label:'m6',combo:m6} ];
      } },
    { name:'Hook', desc:'c = d,  u = l',
      checks:[ {a:S('back','C'),b:S('back','D')}, {a:S('back','U'),b:S('back','L')} ],
      answerFormulas: () => {
        const m1 = addC( toC('back','DR','R'), toC('front','U','L') );
        const m2 = toC('front','R','D');
        const m3 = toC('back','R','D');
        const m4 = applyToFirst(m2, 'front','U','L');
        const m5 = negC( addC( toC('front','C','L'), S('front','R'), toC('back','U','UL') ) );
        const m6 = addC( toC('back','DR','R'), S('back','L'), toC('front','U','UL'), toC('front','D','DR') );
        return [ {label:'m1',combo:m1}, {label:'m2',combo:m2}, {label:'m3',combo:m3}, {label:'m4',combo:m4}, {label:'m5',combo:m5}, {label:'m6',combo:m6} ];
      } },
    { name:'Slashless 1', desc:'c = d,  m5 = \u2212(m6)', checks:[ {a:S('back','C'),b:S('back','D')}, {a:TOMMY_M5,b:TOMMY_M6,neg:true} ],
      answerFormulas: () => {
        const n1 = addC( toC('back','DR','R'), toC('front','U','L') );        // dr to r + U to L
        const n2 = addC( toC('front','C','L'), S('front','D'), toC('back','L','UL') ); // C to L + D + l to ul
        const n3 = toC('back','R','D');                                       // r to d
        const n4 = applyToFirst(n2, 'front','U','L');                         // apply (this case's own) n2 to U, then U to L
        return [ {label:'n1',combo:n1}, {label:'n2',combo:n2}, {label:'n3',combo:n3}, {label:'n4',combo:n4} ];
      } },
    { name:'Fake Ankh', desc:'c = d,  m2 = D\u2192C + R\u2192DR + u\u2192l', checks:[ {a:S('back','C'),b:S('back','D')}, {a:TOMMY_M2,b:rhsFakeAnkh} ],
      answerFormulas: () => {
        const n1 = addC( toC('back','DR','R'), toC('front','U','L') );        // dr to r + U to L
        const n2 = toC('front','C','D');                                      // C to D
        const n3 = toC('back','R','D');                                       // r to d
        const n4 = applyToFirst(n2, 'front','U','L');                         // apply (this case's own) n2 to U, U to L
        const n5 = negC( addC( S('front','L'), toC('back','L','UL') ) );      // -(L + l to ul)
        const n6 = addC( S('back','L'), toC('front','L','UL') );              // l + L to UL
        return [ {label:'n1',combo:n1}, {label:'n2',combo:n2}, {label:'n3',combo:n3}, {label:'n4',combo:n4}, {label:'n5',combo:n5}, {label:'n6',combo:n6} ];
      } },
  ]},
  { title:'Group 2 — ul cases', cases: [
    { name:'Fall', desc:'c = d,  U = L',
      checks:[ {a:S('back','C'),b:S('back','D')}, {a:S('front','U'),b:S('front','L')} ],
      answerFormulas: () => {
        const m1 = toC('back','R','D');                                       // r to d
        const m2 = toC('back','R','DR');                                      // r to dr
        const m3 = negC( addC( toC('front','C','U'), S('front','D'), toC('back','L','UL'), toC('back','R','D') ) ); // -(C to U + D + l to ul + r to d)
        const m4 = addC( toC('back','DR','D'), S('back','U'), toC('front','R','DR'), toC('front','L','UL') );
        return [ {label:'m1',combo:m1}, {label:'m2',combo:m2}, {label:'m3',combo:m3}, {label:'m4',combo:m4} ];
      } },
    { name:'Ankh', desc:'c = d,  C = D',
      checks:[ {a:S('back','C'),b:S('back','D')}, {a:S('front','C'),b:S('front','D')} ],
      answerFormulas: () => {
        const m1 = addC( toC('front','DR','R'), toC('back','U','L') );        // DR to R + u to l
        const m2 = addC( toC('back','R','DR'), toC('front','L','U') );        // r to dr + L to U
        const m3 = applyToFirst(m1, 'back','R','D');                          // apply m1 to r, then r to d
        const m4 = toC('front','U','L');                                      // U to L
        const m5 = negC( addC( toC('front','DR','R'), S('front','L'), toC('back','U','UL') ) ); // -(DR to R + L + u to ul)
        const m6 = addC( toC('back','DR','R'), S('back','L'), toC('front','U','UL') );          // dr to r + l + U to UL
        return [ {label:'m1',combo:m1}, {label:'m2',combo:m2}, {label:'m3',combo:m3}, {label:'m4',combo:m4}, {label:'m5',combo:m5}, {label:'m6',combo:m6} ];
      } },
    { name:'Yah', desc:'c = d,  D = R',
      checks:[ {a:S('back','C'),b:S('back','D')}, {a:S('front','D'),b:S('front','R')} ],
      answerFormulas: () => {
        const m1 = toC('back','U','L');                                       // u to l
        const m2 = addC( toC('back','R','DR'), toC('front','L','U') );        // r to dr + L to U
        const m3 = applyToFirst(m1, 'back','R','D');                          // apply m1 to r, then r to d
        const m4 = toC('front','U','L');                                      // U to L
        const m5 = negC( addC( toC('front','C','L'), S('front','R'), toC('back','U','UL') ) );  // -(C to L + R + u to ul)
        const m6 = addC( toC('back','DR','R'), S('back','L'), toC('front','U','UL'), toC('front','D','DR') );
        return [ {label:'m1',combo:m1}, {label:'m2',combo:m2}, {label:'m3',combo:m3}, {label:'m4',combo:m4}, {label:'m5',combo:m5}, {label:'m6',combo:m6} ];
      } },
    { name:'Fake Line', desc:'c = d,  m2 = R\u2192D + l\u2192ul + u\u2192c', checks:[ {a:S('back','C'),b:S('back','D')}, {a:TOMMY_M2,b:rhsFakeLine} ],
      answerFormulas: () => {
        const n1 = toC('back','U','C');                                       // u to c
        const n2 = addC( toC('back','R','DR'), toC('front','L','U') );        // r to dr + L to U
        const n4 = toC('front','U','L');                                      // U to L
        const n5 = negC( addC( toC('front','C','U'), S('front','R'), toC('back','R','DR') ) ); // -(C to U + R + r to dr)
        const n6 = addC( toC('back','DR','R'), S('back','D'), toC('front','R','DR'), toC('front','U','UL') ); // dr to r + d + R to DR + U to UL
        return [ {label:'n1',combo:n1}, {label:'n2',combo:n2}, {label:'n3',note:'trace (no calculation \u2014 just track visually)'}, {label:'n4',combo:n4}, {label:'n5',combo:n5}, {label:'n6',combo:n6} ];
      } },
  ]},
  { title:'Group 3 — Misc', cases: [
    { name:'Right tilt', desc:'c = r,  C = U',
      checks:[ {a:S('back','C'),b:S('back','R')}, {a:S('front','C'),b:S('front','U')} ],
      answerFormulas: () => {
        const m1 = addC( toC('back','D','DR'), toC('front','UL','U') );       // d to dr + UL to U
        const m2 = toC('back','D','C');                                       // d to c
        const m3 = negC( addC( toC('back','L','UL'), S('front','D') ) );      // -(l to ul + D)
        const m4 = addC( toC('front','R','UR'), toC('front','L','UL'), toC('back','UR','U'), S('back','D') ); // R to UR + L to UL + ur to u + d
        return [ {label:'m1',combo:m1}, {label:'m2',combo:m2}, {label:'m3',combo:m3}, {label:'m4',combo:m4} ];
      } },
    { name:'Left tilt', desc:'c = l,  C = U (mirror of Right tilt)',
      checks:[ {a:S('back','C'),b:S('back','L')}, {a:S('front','C'),b:S('front','U')} ],
      answerFormulas: () => {
        const m1 = toC('back','D','C');                                       // d to c
        const m2 = addC( toC('back','D','DL'), toC('front','UR','U') );       // d to dl + UR to U
        const m3 = addC( toC('front','R','UR'), toC('front','L','UL'), toC('back','UL','U'), S('back','D') ); // R to UR + L to UL + ul to u + d
        const m4 = negC( addC( toC('back','R','UR'), S('front','D') ) );      // -(r to ur + D)
        return [ {label:'m1',combo:m1}, {label:'m2',combo:m2}, {label:'m3',combo:m3}, {label:'m4',combo:m4} ];
      } },
    { name:'Mirror Yah', desc:'c = r,  U = L',
      checks:[ {a:S('back','C'),b:S('back','R')}, {a:S('front','U'),b:S('front','L')} ],
      answerFormulas: () => {
        const m1 = toC('back','D','C');                                       // d to c
        const m2 = toC('back','D','DR');                                      // d to dr
        const m3 = negC( addC( toC('front','C','U'), S('front','D'), toC('back','L','UL') ) ); // -(C to U + D + l to ul)
        const m4 = addC( toC('back','DR','D'), S('back','U'), toC('front','R','DR'), toC('front','L','UL') );
        return [ {label:'m1',combo:m1}, {label:'m2',combo:m2}, {label:'m3',combo:m3}, {label:'m4',combo:m4} ];
      } },
    { name:'Slashless 2', desc:'d = r,  m5 = \u2212(m6)', checks:[ {a:S('back','D'),b:S('back','R')}, {a:TOMMY_M5,b:TOMMY_M6,neg:true} ],
      answerFormulas: () => {
        const n1 = toC('back','D','C');                                       // d to c
        const n2 = negC( addC( toC('back','L','UL'), toC('front','C','U'), S('front','D') ) ); // -(l to ul + C to U + D)
        const appliedAmt = addC(n2, toC('front','U','L'));
        const n3 = applyToSecond(appliedAmt, 'back','DR','R');                // apply (n2 + U to L) to r, then dr to r
        const n4 = toC('front','U','L');                                      // U to L
        return [ {label:'n1',combo:n1}, {label:'n2',combo:n2}, {label:'n3',combo:n3}, {label:'n4',combo:n4} ];
      } },
    { name:'Slashless 3', desc:'m2 = \u2212(m5) = m6', checks:[ {a:TOMMY_M2,b:TOMMY_M5,neg:true}, {a:TOMMY_M5,b:TOMMY_M6,neg:true} ],
      answerFormulas: () => {
        const n1 = toC('back','D','C');                                       // d to c
        const n2 = addC( toC('back','D','C'), toC('back','R','DR'), toC('front','L','U') ); // d to c + r to dr + L to U
        const n3 = applyToSecond(n1, 'back','R','D');                         // apply m1(=n1) to d, then r to d
        const n4 = toC('front','U','L');                                      // (Tommy-memo) U to L
        return [ {label:'n1',combo:n1}, {label:'n2',combo:n2}, {label:'n3',combo:n3}, {label:'n4',combo:n4} ];
      } },
  ]},
];
const ALL_CASES = CASE_GROUPS.flatMap(g => g.cases);

function checkCase(state, caseObj, orientation){
  for(const ch of caseObj.checks){
    const av = comboVal(state, orientation, ch.a);
    const bv = comboVal(state, orientation, ch.b);
    const target = ch.neg ? mod12(-bv) : bv;
    if(av !== target) return false;
  }
  return true;
}

function randomOrientation(){
  const n = Math.floor(Math.random()*4);
  const swap = Math.random() < 0.5;
  return {n, swap};
}

// A generated state can validly satisfy more than one of the 8 orientations at once (e.g. Right
// tilt's 2-term check can pass under both a plain rotation and a swap+shifted-rotation for the same
// state) -- both are genuinely correct, so collect every orientation that validates rather than
// picking just one.
function allValidOrientations(state, caseObj){
  const matches = [];
  for(const n of [0,1,2,3]){
    if(checkCase(state, caseObj, {n, swap:false})) matches.push({n, swap:false});
    if(checkCase(state, caseObj, {n, swap:true})) matches.push({n, swap:true});
  }
  return matches;
}

function generateForCase(caseObj, maxTries=20000){
  const sampledOrientation = randomOrientation();
  for(let i=0;i<maxTries;i++){
    const {state, tokens} = generateRawScramble();
    if(checkCase(state, caseObj, sampledOrientation)){
      const orientations = allValidOrientations(state, caseObj);
      return {state, tokens, orientation: sampledOrientation, orientations};
    }
  }
  return null;
}

// ============ UI: build checkbox groups ============
// A missing element here would otherwise throw at script-load time and silently prevent every
// statement after it in this file from ever running (including unrelated features) -- so every
// top-level listener attachment goes through this guard instead of a bare .addEventListener call.
function safeListen(idOrEl, event, handler, options){
  const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if(el) el.addEventListener(event, handler, options);
  else console.error('Element "' + idOrEl + '" not found in the page \u2014 check index.html matches this script.js (a stale/mismatched copy of one of the two files is the most common cause).');
}

const caseTableEl = document.getElementById('caseTable');
ALL_CASES.forEach((c,i)=> c._id = 'case_' + i);

const maxRows = Math.max(...CASE_GROUPS.map(g => g.cases.length));

// header row
const thead = document.createElement('tr');
CASE_GROUPS.forEach(group => {
  const th = document.createElement('th');
  th.textContent = group.title;
  thead.appendChild(th);
});
caseTableEl.appendChild(thead);

// body rows
for(let row = 0; row < maxRows; row++){
  const tr = document.createElement('tr');
  CASE_GROUPS.forEach(group => {
    const td = document.createElement('td');
    const c = group.cases[row];
    if(c){
      td.className = 'case-cell';
      td.innerHTML = `<div class="row">
        <input type="checkbox" id="${c._id}" checked>
        <label class="lbl" for="${c._id}"><span class="name">${c.name}</span><span class="desc">${c.desc}</span></label>
      </div>`;
    } else {
      td.className = 'case-cell empty';
    }
    tr.appendChild(td);
  });
  caseTableEl.appendChild(tr);
}

safeListen('selectAllBtn', 'click', () => {
  ALL_CASES.forEach(c => document.getElementById(c._id).checked = true);
});
safeListen('clearAllBtn', 'click', () => {
  ALL_CASES.forEach(c => document.getElementById(c._id).checked = false);
});

function getCheckedCases(){
  return ALL_CASES.filter(c => document.getElementById(c._id).checked);
}

// ============ Drawing ============
function dialSVG(value){
  const rad = (value%12)*(Math.PI/6) - Math.PI/2;
  const cx=28, cy=28, r=24;
  const hx = cx + Math.cos(rad)*(r-6), hy = cy + Math.sin(rad)*(r-6);
  return `<svg class="dial" viewBox="0 0 56 56">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#1e222b" stroke="#3a4050" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="1.6" fill="#5b8cff"/>
    <line x1="${cx}" y1="${cy}" x2="${hx.toFixed(2)}" y2="${hy.toFixed(2)}" stroke="#5b8cff" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;
}
function renderFace(title, grid){
  const order = ['UL','U','UR','L','C','R','DL','D','DR'];
  let cells = '';
  for(const k of order) cells += `<div class="dial-cell">${dialSVG(grid[k])}<div class="dial-label">${k}</div></div>`;
  return `<div class="face"><h3>${title}</h3><div class="grid3">${cells}</div></div>`;
}
function renderState(state){
  const origFront = { UL:state.fCorner.UL, U:state.fEdge.U, UR:state.fCorner.UR, L:state.fEdge.L, C:state.fC, R:state.fEdge.R, DL:state.fCorner.DL, D:state.fEdge.D, DR:state.fCorner.DR };
  const y2Grid = {};
  for(const y2label of ['UL','U','UR','L','C','R','DL','D','DR']) y2Grid[y2label] = readPosPhys(state,'back',Y2_TO_PHYS[y2label]);
  // the scramble ends with a y2, so the puzzle is left holding what was originally the back
  // face-up toward the solver -- swap which grid gets the "Front" label accordingly.
  document.getElementById('drawWrap').innerHTML = renderFace('Front', y2Grid) + renderFace('Back', origFront);
}

// ============ Generate / answer / history ============
const scrambleBox = document.getElementById('scrambleBox');
const metaTag = document.getElementById('metaTag');
const answerBox = document.getElementById('answerBox');
const reviewBox = document.getElementById('reviewBox');
let currentTokens = [], currentResult = null;
let scrambleHistory = []; // each entry: { tokens, state, orientations, caseObj }

function renderScrambleTokens(tokens){
  scrambleBox.innerHTML = tokens.map(t => t==='y2' ? '<span class="tag">y2</span>' : t).join(' ');
}

function hideAnswer(){
  answerBox.classList.remove('show');
  answerBox.innerHTML = '';
  document.getElementById('answerBtn').textContent = 'Show answer';
}

function formatSigned(v){ return v >= 7 ? (v - 12) : v; }

function getApplicableCaseNames(state){
  return ALL_CASES.filter(c => allValidOrientations(state, c).length > 0).map(c => c.name);
}

// Builds answer HTML for every p6s case that applies to this scramble -- not just the one it was
// generated for. Some scrambles happen to also satisfy other cases' constraints (e.g. an L-shape
// scramble can sometimes also be read as Fall or Mirror Yah), and it's useful to see all of them.
function buildAnswerHtml(entry){
  const { state, caseObj: intendedCase } = entry;
  const matches = ALL_CASES
    .map(c => ({ caseObj: c, orientations: allValidOrientations(state, c) }))
    .filter(m => m.orientations.length > 0);
  matches.sort((a,b) => (a.caseObj === intendedCase ? -1 : b.caseObj === intendedCase ? 1 : 0));

  let html = '';
  matches.forEach((m, mi) => {
    const isIntended = (m.caseObj === intendedCase);
    html += `<div class="caseline">${m.caseObj.name}${isIntended ? '' : ' \u2014 also applies'} \u2014 ${m.caseObj.desc}</div>`;
    m.orientations.forEach((orientation, idx) => {
      html += `<div style="color:var(--dim); font-size:11.5px; margin-top:${idx>0?'10px':'2px'};">orientation${m.orientations.length>1?' '+(idx+1):''} (${orientationName(orientation)}):</div>`;
      for(const entryFormula of m.caseObj.answerFormulas()){
        if(entryFormula.note){ html += `${entryFormula.label}: ${entryFormula.note}<br>`; }
        else { html += `${entryFormula.label}: ${formatSigned(comboVal(state, orientation, entryFormula.combo))}<br>`; }
      }
    });
    if(mi < matches.length - 1) html += `<div style="border-top:1px solid var(--border); margin:12px 0;"></div>`;
  });
  return html;
}

// Always reflects the most recently generated scramble -- this never navigates backward.
function renderCurrentScramble(entry){
  currentTokens = entry.tokens;
  currentResult = entry;
  hideAnswer();
  renderScrambleTokens(entry.tokens);
  renderState(entry.state);
  metaTag.textContent = 'case: ' + entry.caseObj.name + '   |   ' + entry.orientations.length + ' valid orientation' + (entry.orientations.length>1?'s':'') + ' found';
  const reviewBtn = document.getElementById('reviewPrevBtn');
  if(reviewBtn) reviewBtn.disabled = (scrambleHistory.length < 2);
  else console.error('reviewPrevBtn element not found in the page \u2014 check index.html matches this script.js');
  resetVirtualClockToCurrent();
}

// Shows the scramble immediately before the current one, plus its answer, in a separate panel --
// the current scramble on screen is untouched.
function showReviewEntry(){
  if(scrambleHistory.length < 2){ reviewBox.classList.remove('show'); return; }
  const entry = scrambleHistory[scrambleHistory.length - 2];
  const tokensHtml = entry.tokens.map(t => t==='y2' ? '<span class="tag">y2</span>' : t).join(' ');
  reviewBox.innerHTML = `<div class="review-title">Previous scramble</div>
    <div class="review-scramble">${tokensHtml}</div>
    <div class="review-orient">${buildAnswerHtml(entry)}</div>`;
  reviewBox.classList.add('show');
}

function generateNewScramble(){
  const checked = getCheckedCases();
  if(checked.length === 0){ scrambleBox.textContent = 'Check at least one case first.'; return; }
  const caseObj = checked[Math.floor(Math.random()*checked.length)];
  scrambleBox.textContent = 'Searching...';
  hideAnswer();
  setTimeout(() => {
    const result = generateForCase(caseObj);
    if(!result){ scrambleBox.textContent = 'Could not find a matching scramble for ' + caseObj.name + ' — try again.'; return; }
    const entry = { ...result, caseObj };
    scrambleHistory.push(entry);
    renderCurrentScramble(entry);
  }, 10);
}

safeListen('genBtn', 'click', generateNewScramble);

safeListen('reviewPrevBtn', 'click', showReviewEntry);

safeListen('copyBtn', 'click', () => {
  if(currentTokens.length===0) return;
  navigator.clipboard.writeText(currentTokens.join(' '));
});

safeListen('answerBtn', 'click', () => {
  if(!currentResult){ return; }
  if(answerBox.classList.contains('show')){ hideAnswer(); return; }
  answerBox.innerHTML = buildAnswerHtml(currentResult);
  answerBox.classList.add('show');
  document.getElementById('answerBtn').textContent = 'Hide answer';
});

// ============ Virtual Clock (interactive) ============
function cloneState(s){
  return { fCorner:{...s.fCorner}, fEdge:{...s.fEdge}, fC:s.fC, bEdge:{...s.bEdge}, bC:s.bC };
}

let vcState = newState();
// Pins store a FIXED mechanical fact (which linkage side each corner engages), independent of
// viewing side -- 'front' or 'back'. This does not change when the view is flipped/rotated; only
// the pin badge's visual up/down indicator (computed at render time) is relative to the current view.
let vcPins = { UL:'front', UR:'front', DL:'front', DR:'front' };

// The view's current orientation, tracked as a genuine element of the 8-element symmetry group
// (rotation k=0..3, flipped s=0 or 1) so that composing x2/y2/z/z' always accumulates correctly --
// e.g. x2 then y2 lands at the same place as z2, rather than each button being an independent toggle.
let vcRotK = 0, vcFlipS = 0;
let appMode = 'scramble'; // 'scramble' | 'virtual'

const VC_GRID_ORDER = ['UL','U','UR','L','C','R','DL','D','DR'];
const VC_CORNERS = ['UL','UR','DL','DR'];

// Canonical resolver: for view state (k,s), s=1 is always expressed via the x2 convention
// internally (verified equivalent to y2 wherever the two overlap, since y2 = z2 . x2 in this group).
function vcGridSlotToPhysical(gridLabel, k, s){
  if(s === 0) return rotateN(ROT_B_MAP, gridLabel, k);
  return X2_TO_PHYS[rotateN(ROT_F_MAP, gridLabel, k)];
}
function vcGridSlotValue(gridLabel){
  const phys = vcGridSlotToPhysical(gridLabel, vcRotK, vcFlipS);
  return vcFlipS ? readPosPhys(vcState, 'back', phys) : readPosPhys(vcState, 'front', phys);
}

// Composition rules for applying each control on top of the CURRENT (k,s), derived from the D4
// relation f*z = z^-1*f (f=x2). Verified independently against pure function-composition before
// being wired in here -- see the conversation's derivation/testing for x2-then-y2 = z2, etc.
function vcApplyZ(){ [vcRotK, vcFlipS] = vcFlipS===0 ? [(vcRotK+1)%4, 0] : [(vcRotK+3)%4, 1]; }
function vcApplyZPrime(){ [vcRotK, vcFlipS] = vcFlipS===0 ? [(vcRotK+3)%4, 0] : [(vcRotK+1)%4, 1]; }
function vcApplyX2(){ vcFlipS = 1 - vcFlipS; }
function vcApplyY2(){ vcRotK = (vcRotK+2)%4; vcFlipS = 1 - vcFlipS; }

function vcGetPinGroup(physicalCorner){
  const st = vcPins[physicalCorner];
  return { state: st, group: VC_CORNERS.filter(c => vcPins[c] === st) };
}
// n is always "clockwise as the user currently sees it, dragging on screen right now" -- but
// applyFrontMove/applyBackMove each expect their amount in a SPECIFIC convention (front-view-CW or
// back-view-CW respectively). Those only match the raw screen drag when the engaged linkage side
// (the pin's fixed mechanical state) equals the side currently being viewed; otherwise the sign
// must flip, since viewing a physical rotation from the opposite side always reverses its apparent
// direction. This is independent of the pin's rendered up/down badge, which is view-relative.
function vcTurnCorner(physicalCorner, n){
  if(n === 0) return;
  const {state: pinState, group} = vcGetPinGroup(physicalCorner);
  const engagingFront = (pinState === 'front');
  const viewingFront = (vcFlipS === 0);
  const signedN = (engagingFront === viewingFront) ? n : -n;
  if(engagingFront) applyFrontMove(vcState, group, signedN);
  else applyBackMove(vcState, group, signedN);
}

function resetVirtualClockToCurrent(){
  if(!currentResult) return;
  vcState = cloneState(currentResult.state);
  vcPins = { UL:'front', UR:'front', DL:'front', DR:'front' };
  vcRotK = 0; vcFlipS = 0;
  vcApplyY2(); // start the view y2 away from the identity orientation, per request
  renderVirtualClock();
}

function isVirtualClockSolved(){
  const s = vcState;
  return s.fCorner.UL===0 && s.fCorner.UR===0 && s.fCorner.DL===0 && s.fCorner.DR===0 &&
         s.fEdge.U===0 && s.fEdge.D===0 && s.fEdge.L===0 && s.fEdge.R===0 && s.fC===0 &&
         s.bEdge.U===0 && s.bEdge.D===0 && s.bEdge.L===0 && s.bEdge.R===0 && s.bC===0;
}

const vcCells = {}; // gridLabel -> { cellEl, handEl }
const vcPinEls = {}; // physical-corner-independent: keyed by the GRID CORNER SLOT it's currently drawn at

function vcScreenAngle(dx, dy){
  return Math.atan2(dx, -dy) * 180 / Math.PI; // 0deg = 12 o'clock, clockwise-positive
}

function attachDrag(cellEl, gridLabel){
  let session = null;
  cellEl.addEventListener('pointerdown', (e) => {
    if(typeof timerState !== 'undefined' && timerState === 'inspecting') advanceTimer();
    const rect = cellEl.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    const angle = vcScreenAngle(e.clientX - cx, e.clientY - cy);
    const phys = vcGridSlotToPhysical(gridLabel, vcRotK, vcFlipS);
    session = { cx, cy, lastAngle: angle, unwrapped: 0, appliedSteps: 0, physicalCorner: phys };
    if(cellEl.setPointerCapture) cellEl.setPointerCapture(e.pointerId);
  });
  cellEl.addEventListener('pointermove', (e) => {
    if(!session) return;
    const angle = vcScreenAngle(e.clientX - session.cx, e.clientY - session.cy);
    let delta = angle - session.lastAngle;
    if(delta > 180) delta -= 360;
    if(delta < -180) delta += 360;
    session.unwrapped += delta;
    session.lastAngle = angle;
    const totalSteps = Math.round(session.unwrapped / 30); // 30deg per hour notch
    const diff = totalSteps - session.appliedSteps;
    if(diff !== 0){
      vcTurnCorner(session.physicalCorner, diff);
      session.appliedSteps = totalSteps;
      renderVirtualClock();
    }
  });
  const endDrag = () => { session = null; };
  cellEl.addEventListener('pointerup', endDrag);
  cellEl.addEventListener('pointercancel', endDrag);
}

// Pixel offsets for the 4 inner grid-line intersections, so pins sit in the gaps between dials
// rather than overlapping a corner dial's face. Matches the CSS: 84px cells, 10px gaps.
const VC_PIN_OFFSET = { UL:[89,89], UR:[183,89], DL:[89,183], DR:[183,183] };

function buildVirtualClockDOM(){
  const vcGridEl = document.getElementById('vcGrid');
  if(!vcGridEl){ console.error('vcGrid element not found \u2014 check index.html matches this script.js'); return; }
  vcGridEl.innerHTML = '';
  for(const gridLabel of VC_GRID_ORDER){
    const cell = document.createElement('div');
    cell.className = 'vc-cell' + (VC_CORNERS.includes(gridLabel) ? ' corner' : '');
    const hand = document.createElement('div');
    hand.className = 'vc-hand';
    cell.appendChild(hand);
    const dot = document.createElement('div');
    dot.className = 'vc-center-dot';
    cell.appendChild(dot);
    const marker = document.createElement('div');
    marker.className = 'vc-marker';
    cell.appendChild(marker);
    vcCells[gridLabel] = { cellEl: cell, handEl: hand, markerEl: marker };
    if(VC_CORNERS.includes(gridLabel)) attachDrag(cell, gridLabel);
    vcGridEl.appendChild(cell);
  }

  // Pins are separate elements positioned in the gaps between dials, one per grid-corner-slot
  // (not tied to a single physical corner, since which physical corner appears there can change
  // when the view is flipped/rotated -- the pin's own physical target is resolved at render/click time).
  for(const gridLabel of VC_CORNERS){
    const pin = document.createElement('div');
    pin.className = 'vc-pin';
    const [x, y] = VC_PIN_OFFSET[gridLabel];
    pin.style.left = x + 'px';
    pin.style.top = y + 'px';
    pin.addEventListener('click', (e) => {
      if(e.stopPropagation) e.stopPropagation();
      const phys = vcGridSlotToPhysical(gridLabel, vcRotK, vcFlipS);
      vcPins[phys] = vcPins[phys] === 'front' ? 'back' : 'front';
      renderVirtualClock();
    });
    vcPinEls[gridLabel] = pin;
    vcGridEl.appendChild(pin);
  }
}

function renderVirtualClock(){
  // Rotating the whole physical clock (z/z') doesn't just remap which dial's VALUE appears at which
  // grid slot -- every dial's own printed face (including its "12" reference point) physically
  // rotates along with the whole object. faceAngle captures that: e.g. one z-press means every
  // dial's own 12 o'clock marking is now 90deg clockwise from straight up.
  // Verified against a properly-composed (front/back paired) angle tracker across thousands of random
  // multi-step sequences -- a naive "k*90 + (s?180:0)" formula diverges for odd k when s=1, so this
  // uses a direct lookup instead of a formula to eliminate that class of error entirely.
  const FACE_ANGLE_TABLE = { '0,0':0,'1,0':90,'2,0':180,'3,0':270, '0,1':180,'1,1':90,'2,1':0,'3,1':270 };
  const faceAngle = FACE_ANGLE_TABLE[vcRotK + ',' + vcFlipS];
  for(const gridLabel of VC_GRID_ORDER){
    const cellInfo = vcCells[gridLabel];
    if(!cellInfo) continue;
    const val = vcGridSlotValue(gridLabel);
    const handAngle = (val % 12) * 30 + faceAngle;
    cellInfo.handEl.style.transform = 'rotate(' + handAngle + 'deg)';
    const rad = faceAngle * Math.PI / 180;
    const markerRadius = 36;
    cellInfo.markerEl.style.left = (42 + markerRadius * Math.sin(rad)) + 'px';
    cellInfo.markerEl.style.top = (42 - markerRadius * Math.cos(rad)) + 'px';
  }
  // A pin's mechanical state is fixed (which side it engages), but its VISUAL up/down badge is
  // relative to the side currently being viewed: a front-engaging pin looks "up" when viewing the
  // front, but looks "down" from the back (and vice versa) -- flipping the view should visually
  // invert every pin's apparent state, exactly like a real clock.
  const viewingFront = (vcFlipS === 0);
  for(const gridLabel of VC_CORNERS){
    const pinEl = vcPinEls[gridLabel];
    if(!pinEl) continue;
    const phys = vcGridSlotToPhysical(gridLabel, vcRotK, vcFlipS);
    const mechanicalFront = vcPins[phys] === 'front';
    const isUp = viewingFront ? mechanicalFront : !mechanicalFront;
    pinEl.classList.toggle('up', isUp);
    pinEl.title = 'Pin ' + (isUp ? 'up' : 'down') + ' (click to toggle)';
  }
  const viewLabel = document.getElementById('vcViewLabel');
  if(viewLabel){
    const sideLabel = vcFlipS ? 'Back' : 'Front';
    viewLabel.textContent = 'Viewing: ' + sideLabel + (vcRotK ? ' + rotated ' + vcRotK*90 + '\u00b0' : '');
  }
}

safeListen('vcFlipX2Btn', 'click', () => { vcApplyX2(); renderVirtualClock(); });
safeListen('vcFlipY2Btn', 'click', () => { vcApplyY2(); renderVirtualClock(); });
safeListen('vcZBtn', 'click', () => { vcApplyZ(); renderVirtualClock(); });
safeListen('vcZPrimeBtn', 'click', () => { vcApplyZPrime(); renderVirtualClock(); });

safeListen('modeScrambleBtn', 'click', () => {
  appMode = 'scramble';
  const sBtn = document.getElementById('modeScrambleBtn'), vBtn = document.getElementById('modeVirtualBtn');
  if(sBtn) sBtn.classList.add('active');
  if(vBtn) vBtn.classList.remove('active');
  document.getElementById('drawWrap').style.display = '';
  document.getElementById('virtualClockWrap').style.display = 'none';
});
safeListen('modeVirtualBtn', 'click', () => {
  appMode = 'virtual';
  const sBtn = document.getElementById('modeScrambleBtn'), vBtn = document.getElementById('modeVirtualBtn');
  if(vBtn) vBtn.classList.add('active');
  if(sBtn) sBtn.classList.remove('active');
  document.getElementById('drawWrap').style.display = 'none';
  document.getElementById('virtualClockWrap').style.display = '';
  resetVirtualClockToCurrent();
});

buildVirtualClockDOM();

// ============ Inspection + solve timer ============
// States: 'idle' -> (space/tap) -> 'inspecting' -> (space/tap) -> 'solving' -> (space/tap) -> 'stopped' -> (space/tap) -> 'inspecting' ...
const timerBox = document.getElementById('timerBox');
const timerDisplay = document.getElementById('timerDisplay');
const timerNote = document.getElementById('timerNote');

let timerState = 'idle';
let phaseStartMs = null;
let inspectionMs = null;
let timerIntervalId = null;

function formatSeconds(ms, decimals){
  return (ms / 1000).toFixed(decimals);
}

function updateTimerDisplay(){
  if(timerState === 'inspecting'){
    const elapsed = performance.now() - phaseStartMs;
    timerDisplay.textContent = formatSeconds(elapsed, 1) + 's';
    timerDisplay.className = 'timer-display big inspecting';
  } else if(timerState === 'solving'){
    const elapsed = performance.now() - phaseStartMs;
    timerDisplay.textContent = formatSeconds(elapsed, 2);
    timerDisplay.className = 'timer-display big solving';
  }
}

function startInterval(){
  if(timerIntervalId) clearInterval(timerIntervalId);
  timerIntervalId = setInterval(updateTimerDisplay, 30);
}
function stopInterval(){
  if(timerIntervalId){ clearInterval(timerIntervalId); timerIntervalId = null; }
}

function advanceTimer(){
  const now = performance.now();
  if(timerState === 'idle' || timerState === 'stopped'){
    // start inspection
    timerState = 'inspecting';
    phaseStartMs = now;
    inspectionMs = null;
    timerNote.textContent = '';
    startInterval();
    updateTimerDisplay();
  } else if(timerState === 'inspecting'){
    // end inspection, start solve
    inspectionMs = now - phaseStartMs;
    timerState = 'solving';
    phaseStartMs = now;
    updateTimerDisplay();
  } else if(timerState === 'solving'){
    // stop solve, compute result
    const solveMs = now - phaseStartMs;
    stopInterval();
    timerState = 'stopped';

    if(appMode === 'virtual' && !isVirtualClockSolved()){
      timerDisplay.textContent = 'DNF';
      timerDisplay.className = 'timer-display big dnf';
      timerNote.textContent = 'puzzle not solved';
      recordResult({ value: null, dnf: true, penalty: false, raw: solveMs, caseName: currentResult ? currentResult.caseObj.name : null, alternatives: currentResult ? getApplicableCaseNames(currentResult.state) : [] });
      generateNewScramble();
      return;
    }

    const inspectionSec = inspectionMs / 1000;
    const solveCaseName = currentResult ? currentResult.caseObj.name : null;
    const solveAlternatives = currentResult ? getApplicableCaseNames(currentResult.state) : [];

    if(inspectionSec >= 17){
      timerDisplay.textContent = 'DNF';
      timerDisplay.className = 'timer-display big dnf';
      timerNote.textContent = 'inspection was ' + formatSeconds(inspectionMs,1) + 's (17s or over \u2014 DNF)';
      recordResult({ value: null, dnf: true, penalty: false, raw: solveMs, caseName: solveCaseName, alternatives: solveAlternatives });
    } else if(inspectionSec >= 15){
      const finalMs = solveMs + 2000;
      timerDisplay.textContent = formatSeconds(finalMs, 2) + '+';
      timerDisplay.className = 'timer-display big';
      timerNote.textContent = '+2s penalty \u2014 inspection was ' + formatSeconds(inspectionMs,1) + 's (15\u201317s)';
      recordResult({ value: finalMs, dnf: false, penalty: true, raw: solveMs, caseName: solveCaseName, alternatives: solveAlternatives });
    } else {
      timerDisplay.textContent = formatSeconds(solveMs, 2);
      timerDisplay.className = 'timer-display big';
      timerNote.textContent = 'inspection was ' + formatSeconds(inspectionMs,1) + 's \u2014 no penalty';
      recordResult({ value: solveMs, dnf: false, penalty: false, raw: solveMs, caseName: solveCaseName, alternatives: solveAlternatives });
    }

    generateNewScramble();
  }
}

safeListen(timerBox, 'click', advanceTimer);
safeListen(timerBox, 'touchstart', (e) => { e.preventDefault(); advanceTimer(); }, {passive:false});

document.addEventListener('keydown', (e) => {
  if(e.code === 'Space'){
    if(e.repeat) return; // ignore key-repeat while held
    e.preventDefault();
    advanceTimer();
  }
});

// ============ Statistics ============
let solveResults = []; // chronological: { value: ms|null, dnf, penalty, raw }

function sortVal(r){ return r.dnf ? Infinity : r.value; }

function trimmedAvgOf(window, trimEachSide){
  const n = window.length;
  const sorted = window.slice().sort((a,b) => sortVal(a) - sortVal(b));
  const trimmed = sorted.slice(trimEachSide, n - trimEachSide);
  if(trimmed.some(r => r.dnf)) return 'DNF';
  const sum = trimmed.reduce((s,r) => s + r.value, 0);
  return sum / trimmed.length;
}

function currentStat(results, windowSize, trimEachSide){
  if(results.length < windowSize) return null;
  return trimmedAvgOf(results.slice(-windowSize), trimEachSide);
}

function bestStat(results, windowSize, trimEachSide){
  let best = null;
  for(let i=0; i+windowSize<=results.length; i++){
    const val = trimmedAvgOf(results.slice(i, i+windowSize), trimEachSide);
    if(val !== 'DNF' && (best===null || val < best)) best = val;
  }
  return best;
}

function currentSingle(results){
  if(results.length===0) return null;
  const last = results[results.length-1];
  return last.dnf ? 'DNF' : last.value;
}
function bestSingle(results){
  let best = null;
  for(const r of results) if(!r.dnf && (best===null || r.value < best)) best = r.value;
  return best;
}

function fmtStat(v){
  if(v === null) return '\u2013';
  if(v === 'DNF') return 'DNF';
  return (v/1000).toFixed(2);
}

const STAT_DEFS = [
  { label:'single', windowSize:1,   trim:0 },
  { label:'mo3',    windowSize:3,   trim:0 },
  { label:'ao5',    windowSize:5,   trim:1 },
  { label:'ao12',   windowSize:12,  trim:1 },
  { label:'ao25',   windowSize:25,  trim:2 },
  { label:'ao100',  windowSize:100, trim:5 },
];

const statsTable = document.getElementById('statsTable');
const resultsList = document.getElementById('resultsList');
let statsFilterCase = 'all'; // 'all' or a specific case name

(function populateStatsFilterOptions(){
  const sel = document.getElementById('statsFilterSelect');
  if(!sel) return;
  for(const group of CASE_GROUPS){
    for(const c of group.cases){
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      sel.appendChild(opt);
    }
  }
})();

function getFilteredResults(){
  if(statsFilterCase === 'all') return solveResults;
  return solveResults.filter(r => r.caseName === statsFilterCase);
}

function renderStats(){
  const filtered = getFilteredResults();
  let html = '<tr><th>stat</th><th>current</th><th>best</th></tr>';
  for(const def of STAT_DEFS){
    let cur, best;
    if(def.label === 'single'){ cur = currentSingle(filtered); best = bestSingle(filtered); }
    else { cur = currentStat(filtered, def.windowSize, def.trim); best = bestStat(filtered, def.windowSize, def.trim); }
    html += `<tr><td class="label">${def.label}</td><td>${fmtStat(cur)}</td><td>${fmtStat(best)}</td></tr>`;
  }
  statsTable.innerHTML = html;
}

function renderResultsList(){
  if(solveResults.length === 0){
    resultsList.innerHTML = '<div class="results-empty">No solves yet.</div>';
    return;
  }
  let html = '';
  for(let i = solveResults.length - 1; i >= 0; i--){
    const r = solveResults[i];
    const num = i + 1;
    let caseHtml;
    if(r.alternatives && r.alternatives.length > 1){
      const opts = r.alternatives.map(name => `<option value="${name}"${name===r.caseName?' selected':''}>${name}</option>`).join('');
      caseHtml = `<select class="case-select" data-idx="${i}">${opts}</select>`;
    } else {
      caseHtml = `<span class="case-label">${r.caseName || ''}</span>`;
    }
    if(r.dnf){
      html += `<div class="result-row dnf"><span><span class="result-num">${num}.</span>DNF</span>${caseHtml}</div>`;
    } else {
      const penaltyTag = r.penalty ? '<span class="penalty-tag">+2</span>' : '';
      html += `<div class="result-row"><span><span class="result-num">${num}.</span>${(r.value/1000).toFixed(2)}${penaltyTag}</span>${caseHtml}</div>`;
    }
  }
  resultsList.innerHTML = html;
}

safeListen(resultsList, 'change', (e) => {
  if(e.target && e.target.classList.contains('case-select')){
    const idx = parseInt(e.target.getAttribute('data-idx'), 10);
    solveResults[idx].caseName = e.target.value;
    renderStats();
  }
});

safeListen('statsFilterSelect', 'change', (e) => {
  statsFilterCase = e.target.value;
  renderStats();
});

function recordResult(result){
  solveResults.push(result);
  dnfUndoInfo = null; // a new solve invalidates any pending undo from a previous DNF-marking
  try { renderStats(); } catch(err){ console.error('renderStats failed:', err); }
  try { renderResultsList(); } catch(err){ console.error('renderResultsList failed:', err); }
  updateDnfButton();
}

// Marking the last solve as DNF (and undoing that) -- a single level of undo, invalidated by any
// new solve so it can't be used to retroactively edit older history.
let dnfUndoInfo = null; // { index, originalEntry } or null

function updateDnfButton(){
  const btn = document.getElementById('dnfBtn');
  if(!btn) return;
  if(dnfUndoInfo){
    btn.textContent = 'Undo DNF';
    btn.disabled = false;
  } else {
    btn.textContent = 'DNF last solve';
    btn.disabled = solveResults.length === 0 || solveResults[solveResults.length-1].dnf;
  }
}

safeListen('dnfBtn', 'click', () => {
  if(dnfUndoInfo){
    solveResults[dnfUndoInfo.index] = dnfUndoInfo.originalEntry;
    dnfUndoInfo = null;
  } else {
    if(solveResults.length === 0) return;
    const idx = solveResults.length - 1;
    const entry = solveResults[idx];
    if(entry.dnf) return;
    dnfUndoInfo = { index: idx, originalEntry: { ...entry } };
    solveResults[idx] = { value: null, dnf: true, penalty: false, raw: entry.raw };
  }
  try { renderStats(); } catch(err){ console.error('renderStats failed:', err); }
  try { renderResultsList(); } catch(err){ console.error('renderResultsList failed:', err); }
  updateDnfButton();
});

renderStats(); // draw the empty table on load
updateDnfButton();
