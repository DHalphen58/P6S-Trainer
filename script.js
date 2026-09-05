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
  { title:'Group 2 — UL cases', cases: [
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

document.getElementById('selectAllBtn').addEventListener('click', () => {
  ALL_CASES.forEach(c => document.getElementById(c._id).checked = true);
});
document.getElementById('clearAllBtn').addEventListener('click', () => {
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

// ============ Generate / answer ============
const scrambleBox = document.getElementById('scrambleBox');
const metaTag = document.getElementById('metaTag');
const answerBox = document.getElementById('answerBox');
let currentTokens = [], currentResult = null;

function renderScrambleTokens(tokens){
  scrambleBox.innerHTML = tokens.map(t => t==='y2' ? '<span class="tag">y2</span>' : t).join(' ');
}

function hideAnswer(){
  answerBox.classList.remove('show');
  answerBox.innerHTML = '';
  document.getElementById('answerBtn').textContent = 'Show answer';
}

document.getElementById('genBtn').addEventListener('click', () => {
  const checked = getCheckedCases();
  if(checked.length === 0){ scrambleBox.textContent = 'Check at least one case first.'; return; }
  const caseObj = checked[Math.floor(Math.random()*checked.length)];
  scrambleBox.textContent = 'Searching...';
  hideAnswer();
  setTimeout(() => {
    const result = generateForCase(caseObj);
    if(!result){ scrambleBox.textContent = 'Could not find a matching scramble for ' + caseObj.name + ' — try again.'; return; }
    currentTokens = result.tokens;
    currentResult = { ...result, caseObj };
    renderScrambleTokens(result.tokens);
    renderState(result.state);
    metaTag.textContent = 'case: ' + caseObj.name + '   |   ' + result.orientations.length + ' valid orientation' + (result.orientations.length>1?'s':'') + ' found';
  }, 10);
});

document.getElementById('copyBtn').addEventListener('click', () => {
  if(currentTokens.length===0) return;
  navigator.clipboard.writeText(currentTokens.join(' '));
});

function formatSigned(v){ return v >= 7 ? (v - 12) : v; }

document.getElementById('answerBtn').addEventListener('click', () => {
  if(!currentResult){ return; }
  if(answerBox.classList.contains('show')){ hideAnswer(); return; }
  const {state, orientations, caseObj} = currentResult;
  let html = `<div class="caseline">${caseObj.name} — ${caseObj.desc}</div>`;
  orientations.forEach((orientation, idx) => {
    html += `<div style="color:var(--dim); font-size:11.5px; margin-top:${idx>0?'10px':'2px'};">orientation${orientations.length>1?' '+(idx+1):''} (${orientationName(orientation)}):</div>`;
    for(const entry of caseObj.answerFormulas()){
      if(entry.note){ html += `${entry.label}: ${entry.note}<br>`; }
      else { html += `${entry.label}: ${formatSigned(comboVal(state, orientation, entry.combo))}<br>`; }
    }
  });
  answerBox.innerHTML = html;
  answerBox.classList.add('show');
  document.getElementById('answerBtn').textContent = 'Hide answer';
});
