/* script.js — Etsy Keyword Finder
   - client-side generator using patterns, modifiers, synonyms
   - export & copy features
   - basic heuristic scoring (opportunity vs competition)
*/

// --- UTILITY FUNCTIONS ---------------------------------------------------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function slugify(s){ return (s||'').toString().trim().toLowerCase(); }
function unique(arr){ return Array.from(new Set(arr)); }
function sample(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// Basic synonyms / attribute lists (you can expand)
const modifiers = [
  'handmade','organic','personalized','custom','vintage','minimal','boho','cute','luxury','eco','modern',
  'rustic','gift','set','bundle','large','small','scented','unscented','iced','engraved','silver','gold'
];

const intents = ['gift for','for','with','made of','in','set of','pack of','for women','for men','for kids'];

const materials = ['wood','soy','resin','ceramic','cotton','linen','leather','sterling silver','gold plated','glass'];

const occasion = ['wedding','birthday','anniversary','christmas','valentine','mother\'s day','baby shower'];

const extraWords = ['best','cheap','top','unique','trending','popular','handcrafted','small business'];

// --- CORE GENERATION LOGIC -----------------------------------------------

function generateKeywords(seedRaw, category='', count=120){
  const seed = slugify(seedRaw);
  if(!seed) return [];

  const baseWords = seed.split(/[\s,-]+/).filter(Boolean);

  const pool = [];

  // 1) Basic forms: seed alone and seed + modifiers
  pool.push(seed);
  modifiers.slice(0,12).forEach(m=>{
    pool.push(`${m} ${seed}`);
    pool.push(`${seed} ${m}`);
  });

  // 2) Material-based combos
  materials.slice(0,8).forEach(mat=>{
    pool.push(`${seed} ${mat}`);
    pool.push(`${mat} ${seed}`);
  });

  // 3) Intent-based long-tails
  intents.forEach(it=>{
    pool.push(`${it} ${seed}`);
    pool.push(`${seed} ${it}`);
  });

  // 4) Occasion + seed
  occasion.forEach(o=>{
    pool.push(`${seed} for ${o}`);
    pool.push(`${o} ${seed}`);
  });

  // 5) Attribute + seed variations
  extraWords.forEach(w=>{
    pool.push(`${w} ${seed}`);
    pool.push(`${seed} ${w}`);
  });

  // 6) Word permutations of base words (useful for multi-word seeds)
  if(baseWords.length > 1){
    // combine adjectives and nouns
    for(let a of baseWords){
      for(let b of modifiers.slice(0,6)){
        pool.push(`${a} ${b}`);
        pool.push(`${b} ${a}`);
      }
    }
    // bigram joins
    pool.push(baseWords.join(' '));
    pool.push(baseWords.slice().reverse().join(' '));
  }

  // 7) Category-specific seeds
  if(category){
    pool.push(`${seed} ${slugify(category)}`);
    pool.push(`${slugify(category)} ${seed}`);
  }

  // 8) Expand with templated structures
  const templates = [
    `set of ${seed}`,
    `${seed} set`,
    `mini ${seed}`,
    `personalized ${seed}`,
    `${seed} gift`,
    `custom ${seed}`,
    `${seed} for sale`,
    `${seed} near me`,
    `${seed} online`,
  ];
  pool.push(...templates);

  // 9) Add some generated multi-word phrases by combining random modifiers
  for(let i=0;i<200;i++){
    const w1 = sample(modifiers);
    const w2 = sample(modifiers);
    pool.push(`${w1} ${seed} ${w2}`);
    pool.push(`${w1} ${sample(materials)} ${seed}`);
  }

  // Normalize, dedupe and limit
  const cleaned = unique(pool.map(s => s.replace(/\s+/g,' ').trim())).filter(Boolean);

  // If user requested many, but we used a limited generator, expand using repetition + numeric suffix variations
  let expanded = cleaned.slice();
  let idx=0;
  while(expanded.length < count && idx < cleaned.length){
    const s = cleaned[idx];
    expanded.push(`${s} - ${sample(['best','sale','2025','new','handmade'])}`);
    idx++;
  }

  // Final shuffle and limit
  const final = expanded.sort(()=>Math.random()-0.5).slice(0, Math.max(10, count));

  // Map to objects with heuristic scores
  return final.map(k=>{
    const len = k.split(' ').length;
    // Simple heuristic: shorter often more competitive; longer often better opportunity
    // We set opportunity score depending on length, presence of modifiers, and rarity of words
    let opportunity = 50;
    opportunity += Math.min(30, (len-1)*8); // longer gives more opportunity
    // reward presence of material/intent/occasion
    if(materials.some(m=>k.includes(m))) opportunity += 8;
    if(intents.some(it=>k.includes(it))) opportunity += 6;
    if(occasion.some(o=>k.includes(o))) opportunity += 6;
    // penalize very short keywords
    if(len <= 2) opportunity -= 12;
    // small randomness to diversify
    opportunity = Math.max(8, Math.min(98, Math.round(opportunity + (Math.random()*12-6))));

    // classify
    const cls = opportunity > 70 ? 'high' : (opportunity > 45 ? 'medium' : 'low');

    // estimated search volume (fake estimate) — for UI only
    const estVol = Math.max(10, Math.round((100 - opportunity) * (Math.random()*5 + 1)));

    return { keyword: k, opportunity, class: cls, estVol, length: len };
  });
}

// --- UI & INTERACTIONS --------------------------------------------------

const seedInput = document.getElementById('seed');
const catInput = document.getElementById('category');
const countInput = document.getElementById('count');
const generateBtn = document.getElementById('generateBtn');
const clearBtn = document.getElementById('clearBtn');
const listEl = document.getElementById('list');
const statsEl = document.getElementById('stats');
const statCount = document.getElementById('statCount');
const topSuggestion = document.getElementById('topSuggestion');
const resultsSub = document.getElementById('resultsSub');
const resultsTitle = document.getElementById('resultsTitle');
const titleIdeasEl = document.getElementById('titleIdeas');
const tagsEl = document.getElementById('tags');
const copyAllBtn = document.getElementById('copyAllBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const sortSelect = document.getElementById('sortSelect');
const filterInput = document.getElementById('filterInput');

// store current suggestions
let currentSuggestions = [];

function renderList(items){
  listEl.innerHTML = '';
  items.forEach(it=>{
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="left">
        <div class="kword">${escapeHtml(it.keyword)}</div>
        <div class="meta">${it.estVol} est. searches • ${it.length} words</div>
      </div>
      <div class="right">
        <div class="score ${it.class}">${it.opportunity}</div>
        <div style="height:6px"></div>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn small copyBtn">Copy</button>
          <button class="btn small ghost addTagBtn">+ Tag</button>
        </div>
      </div>
    `;
    // copy button
    div.querySelector('.copyBtn').addEventListener('click', ()=>{
      navigator.clipboard.writeText(it.keyword).then(()=> {
        flashMessage('Copied to clipboard');
      });
    });
    // add tag (append to tags)
    div.querySelector('.addTagBtn').addEventListener('click', ()=>{
      addTag(it.keyword);
    });

    listEl.appendChild(div);
  });
}

// escape for safety
function escapeHtml(text){
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}

function flashMessage(msg){
  resultsSub.textContent = msg;
  setTimeout(()=> {
    resultsSub.textContent = `${currentSuggestions.length} suggestions generated`;
  }, 1200);
}

function updateSidebar(items, seed){
  // Title ideas (top 5)
  const top = items.slice().sort((a,b)=>b.opportunity-a.opportunity).slice(0,5);
  titleIdeasEl.innerHTML = top.map(t=>`<div style="padding:8px 0">• ${escapeHtml(capitalizeTitle(t.keyword))}</div>`).join('');
  // Suggested tags (top short keywords)
  const tags = items.slice().sort((a,b)=> a.length - b.length ).slice(0,12).map(i=>i.keyword.split(' ').slice(0,3).join(' '));
  tagsEl.innerHTML = unique(tags).slice(0,12).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('');
}

function capitalizeTitle(s){
  return s.split(' ').map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
}

// generate, store, render
function runGenerate(){
  const seed = seedInput.value.trim();
  if(!seed){ alert('Please enter a seed keyword (e.g. "soy candle")'); return; }
  const cat = catInput.value;
  const count = Math.max(10, Math.min(500, parseInt(countInput.value) || 120));
  resultsTitle.textContent = `Suggestions for: "${seed}"`;
  resultsSub.textContent = 'Generating…';
  // generate
  const raw = generateKeywords(seed, cat, count);
  currentSuggestions = raw;
  applySortAndFilter();
  // stats
  statCount.textContent = currentSuggestions.length;
  topSuggestion.textContent = currentSuggestions.slice().sort((a,b)=>b.opportunity-a.opportunity)[0]?.keyword || '—';
  statsEl.classList.remove('hidden');
  resultsSub.textContent = `${currentSuggestions.length} suggestions generated`;
  updateSidebar(currentSuggestions, seed);
}

// sort & filter
function applySortAndFilter(){
  if(!currentSuggestions.length){ listEl.innerHTML=''; return; }
  let items = currentSuggestions.slice();
  // filter
  const f = (filterInput.value||'').toLowerCase().trim();
  if(f) items = items.filter(i => i.keyword.toLowerCase().includes(f));
  // sort
  const mode = sortSelect.value;
  if(mode === 'score-desc') items.sort((a,b)=>b.opportunity-a.opportunity);
  if(mode === 'score-asc') items.sort((a,b)=>a.opportunity-b.opportunity);
  if(mode === 'length-asc') items.sort((a,b)=>a.keyword.split(' ').length - b.keyword.split(' ').length);
  if(mode === 'length-desc') items.sort((a,b)=>b.keyword.split(' ').length - a.keyword.split(' ').length);
  renderList(items);
}

// add tag
function addTag(t){
  const cur = tagsEl.textContent.trim();
  const tag = t.split(' ').slice(0,3).join(' ');
  const existing = cur.split('\n').map(x=>x.trim()).filter(Boolean);
  if(!existing.includes(tag)){
    const span = document.createElement('span');
    span.className='tag';
    span.textContent = tag;
    tagsEl.appendChild(span);
  }
}

// copy all keywords
copyAllBtn.addEventListener('click', ()=>{
  if(!currentSuggestions.length) { alert('No suggestions to copy'); return; }
  const text = currentSuggestions.map(i=>i.keyword).join('\n');
  navigator.clipboard.writeText(text).then(()=> flashMessage('All keywords copied'));
});

// export CSV
exportCsvBtn.addEventListener('click', ()=>{
  if(!currentSuggestions.length) { alert('No suggestions to export'); return; }
  const rows = [['keyword','opportunity','estVol','length']];
  currentSuggestions.forEach(i => rows.push([`"${i.keyword.replace(/"/g,'""')}"`,i.opportunity,i.estVol,i.length]));
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'etsy-keywords.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  flashMessage('CSV exported');
});

// clear
clearBtn.addEventListener('click', ()=>{
  seedInput.value = ''; catInput.value=''; countInput.value = '120';
  listEl.innerHTML=''; currentSuggestions = []; statsEl.classList.add('hidden'); resultsTitle.textContent='Suggestions'; resultsSub.textContent='No results yet — enter a seed keyword and click Generate.';
  titleIdeasEl.innerHTML = 'No data yet'; tagsEl.innerHTML = '—';
});

// interactions
generateBtn.addEventListener('click', runGenerate);
sortSelect.addEventListener('change', applySortAndFilter);
filterInput.addEventListener('input', applySortAndFilter);

// copy visible snippet
document.getElementById('copyAllBtn').addEventListener('click', e => e.preventDefault());
document.getElementById('exportCsvBtn').addEventListener('click', e => e.preventDefault());

// dark toggle
const darkToggle = document.getElementById('darkToggle');
darkToggle.addEventListener('click', ()=>{
  document.body.classList.toggle('dark');
  darkToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
});

// helpers
function init(){
  resultsSub.textContent = 'No results yet — enter a seed keyword and click Generate.';
  titleIdeasEl.textContent = 'No data yet';
}
init();
