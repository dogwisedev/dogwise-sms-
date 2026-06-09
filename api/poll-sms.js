<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dogwise Academy — Talk to Alma</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Fraunces:ital,wght@0,600;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --sage:    #4a7c59;
    --sage-lt: #e8f2eb;
    --ink:     #1a1f1c;
    --muted:   #6b7570;
    --border:  #dde4df;
    --bg:      #f7f9f7;
    --white:   #ffffff;
    --bubble-Alma: #ffffff;
    --bubble-user: #4a7c59;
    --red:     #c0392b;
  }

  html, body {
    height: 100%;
    background: var(--bg);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 15px;
    color: var(--ink);
  }

  /* ── Layout ── */
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-width: 680px;
    margin: 0 auto;
    background: var(--white);
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--white);
    flex-shrink: 0;
  }
  .avatar {
    width: 42px; height: 42px;
    background: var(--sage-lt);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }
  .header-text h1 {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 17px;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.2;
  }
  .header-text p {
    font-size: 12px;
    color: var(--muted);
    margin-top: 1px;
  }
  .status-dot {
    width: 8px; height: 8px;
    background: #4caf50;
    border-radius: 50%;
    display: inline-block;
    margin-right: 5px;
  }

  /* ── Messages ── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px 20px 12px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    scroll-behavior: smooth;
  }

  .msg-row {
    display: flex;
    gap: 10px;
    max-width: 88%;
  }
  .msg-row.Alma { align-self: flex-start; }
  .msg-row.user { align-self: flex-end; flex-direction: row-reverse; }

  .msg-avatar {
    width: 30px; height: 30px;
    background: var(--sage-lt);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .bubble {
    padding: 11px 14px;
    border-radius: 16px;
    line-height: 1.55;
    font-size: 14.5px;
    max-width: 100%;
  }
  .Alma .bubble {
    background: var(--bubble-Alma);
    border: 1px solid var(--border);
    border-top-left-radius: 4px;
    color: var(--ink);
  }
  .user .bubble {
    background: var(--bubble-user);
    color: white;
    border-top-right-radius: 4px;
  }

  /* Typing indicator */
  .typing-dots {
    display: flex; gap: 4px; align-items: center;
    padding: 14px 16px;
  }
  .typing-dots span {
    width: 7px; height: 7px;
    background: var(--border);
    border-radius: 50%;
    animation: bounce 1.2s infinite;
  }
  .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); background: var(--border); }
    30% { transform: translateY(-5px); background: var(--sage); }
  }

  /* ── Input area ── */
  .input-area {
    border-top: 1px solid var(--border);
    padding: 12px 16px;
    background: var(--white);
    flex-shrink: 0;
  }
  .input-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  textarea {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 22px;
    font-family: inherit;
    font-size: 14px;
    color: var(--ink);
    resize: none;
    outline: none;
    line-height: 1.4;
    max-height: 120px;
    min-height: 42px;
    overflow-y: auto;
    background: var(--bg);
    transition: border-color 0.15s;
  }
  textarea:focus { border-color: var(--sage); }
  textarea::placeholder { color: var(--muted); }

  button#send {
    width: 42px; height: 42px;
    border-radius: 50%;
    border: none;
    background: var(--sage);
    color: white;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, transform 0.1s;
  }
  button#send:hover { background: #3d6a4a; }
  button#send:active { transform: scale(0.93); }
  button#send:disabled { background: var(--border); cursor: default; }
  button#send svg { width: 18px; height: 18px; }

  .input-hint {
    font-size: 11px;
    color: var(--muted);
    margin-top: 6px;
    text-align: center;
  }

  /* Debug panel (hidden by default) */
  #debug {
    display: none;
    font-size: 11px;
    font-family: monospace;
    background: #f0f4f0;
    border-top: 1px solid var(--border);
    padding: 8px 16px;
    color: var(--muted);
    max-height: 80px;
    overflow-y: auto;
    flex-shrink: 0;
  }
  #hs-loader { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; }
  #chat-area { display: none; flex: 1; flex-direction: column; overflow: hidden; }
</style>
</head>
<body>

<div class="shell">

  <div class="header">
    <div class="avatar">🐾</div>
    <div class="header-text">
      <h1>Alma — Dogwise Academy</h1>
      <p><span class="status-dot"></span>Training Consultant · Usually replies in seconds</p>
    </div>
  </div>

  <!-- HubSpot deal loader -->
  <div id="hs-loader">
    <div style="width:100%;max-width:420px;text-align:center;">
      <div style="font-size:32px;margin-bottom:12px;">🔗</div>
      <p style="font-family:'Fraunces',serif;font-size:17px;font-weight:600;color:var(--ink);margin-bottom:6px;">Load a HubSpot deal</p>
      <p style="font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.5;">Paste the deal URL or ID to pre-load the dog's info. Or skip to start a blank conversation.</p>
      <input id="deal-url-input" type="text" placeholder="Deal URL or ID number" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;margin-bottom:10px;box-sizing:border-box;outline:none;" />
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;">
        <button id="load-deal-btn" style="padding:10px 20px;background:var(--sage);color:white;border:none;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;">Load deal</button>
        <button id="skip-hs-btn" style="padding:10px 20px;background:var(--bg);color:var(--muted);border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;">Skip, start blank</button>
      </div>
      <p id="loader-status" style="font-size:12px;color:var(--muted);min-height:18px;"></p>
    </div>
  </div>

  <!-- Chat area (hidden until loader done) -->
  <div id="chat-area">
    <div class="messages" id="messages"></div>
    <div class="input-area">
      <div class="input-row">
        <textarea id="input" placeholder="Tell me about your dog…" rows="1"></textarea>
        <button id="send" aria-label="Send message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <p class="input-hint">Press Enter to send · Shift+Enter for new line</p>
    </div>
  </div>

  <div id="debug"></div>

</div>

<script>
// ─────────────────────────────────────────────────────────────
//  DOGWISE SALES BOT — V3
//  + HubSpot deal loader (sandbox: paste deal URL)
//  + HubSpot task creation when call agreed
//  + Personality: natural, no em-dash, occasional imperfection
// ─────────────────────────────────────────────────────────────

const GROQ_KEY = "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";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// HubSpot calls go via /api/hs-proxy on Vercel (token is server-side)

// ── Trainer list ─────────────────────────────────────────────
const TRAINERS = [
  { name: "Michael Jackson",       lat: 40.7027, lon: -73.9432, city: "Brooklyn",          state: "NY" },
  { name: "Alma Santiago",         lat: 40.7611, lon: -73.3283, city: "Deer Park",          state: "NY" },
  { name: "Amanda Kranz",          lat: 41.5965, lon: -73.9130, city: "Wappingers Falls",   state: "NY" },
  { name: "Mike Colt",             lat: 40.9740, lon: -75.0255, city: "Columbia",           state: "NJ" },
  { name: "Nyeem Calhoun",         lat: 39.4515, lon: -74.7273, city: "Mays Landing",       state: "NJ" },
  { name: "Eddie Bonilla",         lat: 42.7380, lon: -71.3780, city: "Pelham",             state: "NH" },
  { name: "Drew Thompson",         lat: 41.2174, lon: -73.2165, city: "Bridgeport",         state: "CT" },
  { name: "Jen Hagarman",          lat: 39.7957, lon: -76.9811, city: "Hanover",            state: "PA" },
  { name: "David Lewis",           lat: 38.7493, lon: -76.6083, city: "Dunkirk",            state: "MD" },
  { name: "Diamond Warren",        lat: 39.2904, lon: -76.6122, city: "Baltimore",          state: "MD" },
  { name: "Shelby Fleming",        lat: 38.8520, lon: -76.6224, city: "Harwood",            state: "MD" },
  { name: "April Crawford",        lat: 36.7123, lon: -76.2441, city: "Chesapeake",         state: "VA" },
  { name: "Jason Lewis",           lat: 34.2668, lon: -80.8436, city: "Ridgeway",           state: "SC" },
  { name: "Theresa Strickland",    lat: 34.0371, lon: -84.4233, city: "Roswell",            state: "GA" },
  { name: "Opal O'Brien",          lat: 33.7850, lon: -84.0730, city: "Stone Mountain",     state: "GA" },
  { name: "Jarret Price",          lat: 32.5520, lon: -83.6970, city: "Kathleen",           state: "GA" },
  { name: "Allie Lopez",           lat: 34.0537, lon: -84.0725, city: "Suwanee",            state: "GA" },
  { name: "Rina Sullivan",         lat: 27.9358, lon: -80.6595, city: "Grant-Valkaria",     state: "FL" },
  { name: "Tammy Leatherwood",     lat: 28.9517, lon: -81.3031, city: "Orange City",        state: "FL" },
  { name: "James Guillory",        lat: 28.1472, lon: -82.5716, city: "Odessa",             state: "FL" },
  { name: "Tracie Dulniak",        lat: 26.0926, lon: -80.1623, city: "Fort Lauderdale",    state: "FL" },
  { name: "Melina Molinare",       lat: 25.7530, lon: -80.2350, city: "Miami",              state: "FL" },
  { name: "Bailey Preston",        lat: 42.6398, lon: -83.3499, city: "Waterford Township", state: "MI" },
  { name: "Nicole Murray",         lat: 39.8120, lon: -86.1770, city: "Indianapolis",       state: "IN" },
  { name: "Jonathon Glenn",        lat: 39.8350, lon: -86.0550, city: "Indianapolis",       state: "IN" },
  { name: "Brandon Edmonds",       lat: 41.7620, lon: -87.5640, city: "Chicago",            state: "IL" },
  { name: "Cedric Coleman",        lat: 41.2675, lon: -88.2189, city: "Braidwood",          state: "IL" },
  { name: "Wildon Bloodworth",     lat: 30.1869, lon: -97.9514, city: "Austin",             state: "TX" },
  { name: "Cassandra Anderson",    lat: 30.1170, lon: -94.1922, city: "Beaumont",           state: "TX" },
  { name: "Joi Martin",            lat: 29.6873, lon: -95.2544, city: "Houston",            state: "TX" },
  { name: "Felicity Houston",      lat: 33.2546, lon: -97.0903, city: "Denton",             state: "TX" },
  { name: "Ashlyn Rechtiene",      lat: 39.5028, lon:-104.7670, city: "Parker",             state: "CO" },
  { name: "Jerry Self",            lat: 33.5683, lon:-112.3090, city: "Peoria",             state: "AZ" },
  { name: "Njoud Aghabi",          lat: 33.7570, lon:-118.1350, city: "Long Beach",         state: "CA" },
  { name: "Ryan Chudacoff",        lat: 34.4140, lon:-117.5020, city: "Phelan",             state: "CA" },
  { name: "Priscilla Rodriguez",   lat: 33.9401, lon:-118.1332, city: "Downey",             state: "CA" },
  { name: "Jessica Walsh",         lat: 35.1340, lon:-117.9770, city: "California City",    state: "CA" },
  { name: "Joseph Serrano",        lat: 36.1464, lon:-118.7595, city: "Springville",        state: "CA" },
  { name: "Olivia Sheehan",        lat: 37.7320, lon:-121.4300, city: "Tracy",              state: "CA" },
  { name: "Karen Arguello",        lat: 38.6810, lon:-120.8430, city: "El Dorado",          state: "CA" },
  { name: "Heather Truax",         lat: 47.7440, lon:-122.3450, city: "Shoreline",          state: "WA" },
  { name: "Jordan Williams",       lat: 41.4060, lon: -81.5550, city: "Maple Heights",      state: "OH" },
  { name: "Ava Santana",           lat: 42.5036, lon: -72.3121, city: "New Salem",          state: "MA" },
];

const PREMIUM_STATES = ["AZ","CA","CT","FL","MA","NJ","NY","WA"];

// ── Location helpers ─────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
const zipCache = {};
async function zipToCoords(zip) {
  if (zipCache[zip]) return zipCache[zip];
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.places?.[0]) return null;
    const result = { lat: parseFloat(d.places[0].latitude), lon: parseFloat(d.places[0].longitude), city: d.places[0]["place name"], state: d.places[0]["state abbreviation"] };
    zipCache[zip] = result; return result;
  } catch { return null; }
}
function closestTrainer(userLat, userLon) {
  let best = null, bestDist = Infinity;
  for (const t of TRAINERS) {
    const d = haversine(userLat, userLon, t.lat, t.lon);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best ? { ...best, distanceMiles: Math.round(bestDist) } : null;
}
function getPricingContext(rec, stateAbb) {
  if (!rec) return "Programs range from $2,000 for a 2-week puppy program up to $8,000 for an 8-week intensive. Once I know more about your dog I can give you an exact number.";
  const isPremium = stateAbb && PREMIUM_STATES.includes(stateAbb);
  const price = (rec.weeks * 1000 * (isPremium ? 1.1 : 1.0)).toLocaleString();
  return `The ${rec.program} (${rec.weeks} weeks) is $${price}${isPremium ? " (premium market rate)" : ""}. There's a $1,000 deposit to hold the spot and payment plans are available.`;
}

// ── Dog + context profile ────────────────────────────────────
const profile = {
  // From HubSpot
  hubspotDealId:   null,
  hubspotOwnerId:  null,
  hubspotContactId:null,
  clientFirstName: null,
  clientPhone:     null,
  // Dog info
  dogName:        null,
  ageMonths:      null,
  isLargeBreed:   null,
  breed:          null,
  customerNotes:  null,  // raw notes from form
  // Behaviour flags
  hasAggression:  false,
  biteHistory:    false,
  skinBroken:     false,
  excitementBite: false,
  hasAnxiety:     false,
  realAnxiety:    null,
  isRescue:       false,
  rescueRestart:  null,
  hasObedience:   false,
  // Location
  zip:            null,
  userCity:       null,
  userState:      null,
  closestTrainer: null,
  // State
  callAgreed:     false,
  taskCreated:    false,
  emailTaskCreated: false,
  clientEmail:    null,
};

// ── HubSpot loader ───────────────────────────────────────────
async function loadHubSpotDeal(dealId) {
  setLoaderStatus("Loading deal...");
  try {
    // Call our Vercel proxy (avoids CORS)
    const proxyRes = await fetch(`https://ai-responder-taupe.vercel.app/api/hs-proxy?dealId=${dealId}`);
    if (!proxyRes.ok) {
      const err = await proxyRes.json();
      setLoaderStatus("Deal not found. Check the ID."); return;
    }
    const data = await proxyRes.json();
    const dp = data.deal;
    const cp = data.contact;

    profile.hubspotDealId   = dealId;
    profile.hubspotContactId= data.contactId || null;
    profile.hubspotOwnerId  = dp.hubspot_owner_id;
    profile.dogName         = dp.k9___dog_name || null;
    profile.breed           = dp.what_is_the_breed_of_the_dog_s__ || null;

    // Age: HubSpot stores as a range string e.g. "3+ years" or "Under 6 months"
    const ageRaw = dp.what_are_the_dog_s__age_s__ || "";
    profile.ageMonths = parseAgeRange(ageRaw);

    // Notes: combine both fields
    const notes = [dp.note_from_customer, dp.additional_details]
      .filter(n => n && n !== "null" && n.trim() !== "")
      .join(" | ");
    profile.customerNotes = notes || null;

    // Large breed detection
    if (profile.breed) {
      const largeBreedsRx = /rottweiler|pitbull|pit bull|shepherd|mastiff|great dane|doberman|cane corso|bullmastiff|bernese|saint bernard|weimaraner|ridgeback|dogo|boerboel|husky|malamute/i;
      profile.isLargeBreed = largeBreedsRx.test(profile.breed);
    }

    // Contact info
    if (cp) {
      profile.clientFirstName = cp.firstname || null;
      profile.clientPhone     = cp.phone || null;
      profile.clientEmail     = cp.email || null;
    }

    // ZIP: try contact zip_code first, then deal location/name
    const zipSources = [cp?.zip_code, dp.location, dp.dealname];
    for (const src of zipSources) {
      const m = (src || "").match(/\b\d{5}\b/);
      if (m) { profile.zip = m[0]; break; }
    }
    if (profile.zip) {
      const coords = await zipToCoords(profile.zip);
      if (coords) {
        profile.userCity  = coords.city;
        profile.userState = coords.state;
        profile.closestTrainer = closestTrainer(coords.lat, coords.lon);
      }
    }

    // Show success and hide loader
    const dogLabel = profile.dogName || "dog";
    const breedLabel = profile.breed ? ` (${profile.breed})` : "";
    setLoaderStatus(`Loaded: ${profile.clientFirstName || "Customer"}'s ${dogLabel}${breedLabel}`, true);
    setTimeout(() => hideLoader(), 1200);
    startChat();

  } catch(e) {
    setLoaderStatus("Error loading deal: " + e.message);
    log("HubSpot error: " + e.message);
  }
}

function parseAgeRange(str) {
  if (!str) return null;
  const s = str.toLowerCase();
  if (s.includes("under 6") || s.includes("< 6")) return 3;
  if (s.includes("6 month") && s.includes("1 year")) return 9;
  if (s.includes("1") && s.includes("2 year")) return 18;
  if (s.includes("2") && s.includes("3 year")) return 30;
  if (s.includes("3+") || s.includes("3 year")) return 42;
  if (s.includes("4+") || s.includes("4 year")) return 48;
  if (s.includes("5+") || s.includes("5 year")) return 60;
  if (s.includes("7+") || s.includes("7 year")) return 84;
  const numMatch = str.match(/(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1]);
    // If looks like years (small number), convert
    if (n <= 20) return n * 12;
    return n; // assume months
  }
  return null;
}

// ── HubSpot task creator ─────────────────────────────────────
async function createCallTask() {
  if (profile.taskCreated || !profile.hubspotDealId) return;
  try {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 2); // due in 2 hours

    const taskPayload = {
      dealId: profile.hubspotDealId,
      properties: {
        hs_task_subject:  `Call requested - ${profile.clientFirstName || "Lead"} re: ${profile.dogName || "dog"} (${profile.breed || "breed unknown"})`,
        hs_task_body:     `Customer agreed to a call during AI chat. Dog: ${profile.dogName || "unknown"}, Breed: ${profile.breed || "unknown"}, Age: ${profile.ageMonths ? Math.round(profile.ageMonths/12*10)/10 + " yrs" : "unknown"}. Notes: ${profile.customerNotes || "none"}`,
        hs_task_type:     "CALL",
        hs_task_priority: "HIGH",
        hs_timestamp:     dueDate.getTime().toString(),
        hubspot_owner_id: profile.hubspotOwnerId || "",
      }
    };

    const taskRes = await fetch("https://ai-responder-taupe.vercel.app/api/hs-proxy?action=createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskPayload)
    });

    if (taskRes.ok) {
      const result = await taskRes.json();
      profile.taskCreated = true;
      log("Task created: " + result.taskId);
    }
  } catch(e) { log("Task error: " + e.message); }
}

// ── Email task creator ───────────────────────────────────────
async function createEmailTask() {
  if (!profile.hubspotDealId) return;
  try {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 1);
    const taskPayload = {
      dealId: profile.hubspotDealId,
      properties: {
        hs_task_subject:  `Send details email - ${profile.clientFirstName || "Lead"} re: ${profile.dogName || "dog"} (${profile.breed || "breed unknown"})`,
        hs_task_body:     `Customer asked for full details email with price and payment plans. Email: ${profile.clientEmail || "check contact"}. Program discussed: ${getRecommendation()?.program || "TBC"} - ${getRecommendation()?.weeks || "?"} weeks.`,
        hs_task_type:     "EMAIL",
        hs_task_priority: "HIGH",
        hs_timestamp:     dueDate.getTime().toString(),
        hubspot_owner_id: profile.hubspotOwnerId || "",
      }
    };
    const taskRes = await fetch("https://ai-responder-taupe.vercel.app/api/hs-proxy?action=createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskPayload)
    });
    if (taskRes.ok) { const r = await taskRes.json(); log("Email task: " + r.taskId); }
  } catch(e) { log("Email task err: " + e.message); }
}

// ── HubSpot deal updater ─────────────────────────────────────
async function updateDealProps(properties) {
  if (!profile.hubspotDealId) return;
  try {
    await fetch(`https://ai-responder-taupe.vercel.app/api/hs-proxy?action=updateDeal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId: profile.hubspotDealId, properties })
    });
  } catch(e) { log("Update deal err: " + e.message); }
}

// Builds a short running summary for note_from_customer
function buildChatSummary() {
  const parts = [];
  if (profile.dogName)    parts.push(profile.dogName);
  if (profile.breed)      parts.push(profile.breed);
  if (profile.ageMonths)  parts.push(`${Math.round(profile.ageMonths)}mo`);
  if (profile.hasAggression) parts.push(profile.skinBroken ? "bite+skin" : profile.excitementBite ? "excitement bite" : "aggression");
  if (profile.realAnxiety === true) parts.push("confirmed anxiety");
  else if (profile.hasAnxiety) parts.push("possible anxiety");
  if (profile.isRescue)   parts.push("rescue");
  const rec = getRecommendation();
  if (rec) parts.push(`→ ${rec.program} ${rec.weeks}wk`);
  if (profile.callAgreed) parts.push("CALL AGREED");
  if (profile.emailTaskCreated) parts.push("EMAIL REQUESTED");
  return `[AI Chat] ${parts.join(", ")}`;
}

// ── Program decision engine ──────────────────────────────────
function getRecommendation() {
  const a = profile.ageMonths;
  if (a === null) return null;
  if (profile.hasAggression || profile.biteHistory) {
    if (profile.excitementBite && a < 18)
      return { program: "Adolescent Essentials", weeks: 3, reason: "young dog, excitement bite - impulse control not aggression rehab" };
    if (profile.skinBroken && !profile.excitementBite)
      return { program: "Reactivity & Aggression Reset", weeks: 6, reason: "bite with broken skin requires the full 6-week program" };
    const weeks = a >= 48 ? 6 : 5;
    return { program: "Reactivity & Aggression Reset", weeks, reason: a >= 48 ? "older dog with established aggression patterns" : "aggression without skin break" };
  }
  if (profile.realAnxiety === true)
    return { program: "Anxiety Support", weeks: 4, reason: "confirmed anxiety - separation panic, storms, unable to settle" };
  if (profile.isRescue && profile.rescueRestart === true)
    return { program: "Rescue Restart", weeks: 4, reason: "rescue with unknown history and shut-down or fearful behaviour" };
  if (a <= 6) {
    if (profile.isLargeBreed) return { program: "Big Puppy", weeks: 3, reason: "large breed puppy - build structure before size becomes a problem" };
    return { program: "Puppy Foundations", weeks: 2, reason: "young puppy - foundation training and house manners" };
  }
  if (a <= 12) return { program: "Adolescent Essentials", weeks: 3, reason: "adolescent phase - manners and impulse control" };
  if (profile.hasObedience && (profile.isLargeBreed || a > 18))
    return { program: "Strong Companion", weeks: 4, reason: "knows the basics but needs reliability in real-world situations" };
  return { program: "Adolescent Essentials", weeks: a <= 18 ? 3 : 4, reason: "adult dog needing reliable structure and obedience" };
}

// ── System prompt ────────────────────────────────────────────
function buildSystemPrompt() {
  const rec = getRecommendation();
  const pricing = getPricingContext(rec, profile.userState);
  const trainerInfo = profile.closestTrainer
    ? `Closest trainer to this customer: ${profile.closestTrainer.city}, ${profile.closestTrainer.state} (${profile.closestTrainer.distanceMiles} miles from them). Use this if they ask where we are or who would train their dog. Do not give a personal address.`
    : `Customer location unknown. If they ask where we are, ask for their ZIP so you can tell them the closest trainer.`;

  const hsContext = (profile.dogName || profile.breed || profile.customerNotes)
    ? `WHAT WE ALREADY KNOW (from their inquiry form):
- Customer name: ${profile.clientFirstName || "unknown"}
- Dog name: ${profile.dogName || "not given"}
- Breed: ${profile.breed || "not given"}
- Age from form: ${profile.ageMonths ? `approx ${Math.round(profile.ageMonths)} months` : "not given"}
- Customer's own notes: "${profile.customerNotes || "none"}"

Use this to ask smarter questions, not to repeat info back.`
    : `No prior info - cold conversation.`;

  // Tick-off checklist — [x] = known, [ ] = unknown, never invent unknowns
  const tick = (val, label, extra) => val ? `[x] ${label}: ${extra || val}` : `[ ] ${label}: UNKNOWN — do not guess, ask`;

  const ageTick = profile.ageMonths
    ? `[x] Age: ~${Math.round(profile.ageMonths)} months`
    : `[ ] Age: UNKNOWN — ask`;

  const breedTick = profile.breed
    ? `[x] Breed: ${profile.breed}${profile.isLargeBreed ? " (large)" : profile.isLargeBreed === false ? " (small/medium)" : ""}`
    : `[ ] Breed: UNKNOWN — ask`;

  const nameTick = profile.dogName
    ? `[x] Dog name: ${profile.dogName}`
    : `[ ] Dog name: UNKNOWN — ask early`;

  const aggTick = (profile.hasAggression || profile.biteHistory)
    ? `[x] Aggression: YES${profile.skinBroken ? " — skin broken" : profile.excitementBite ? " — excitement bite only" : " — no skin break confirmed"}`
    : profile.ageMonths
      ? `[ ] Aggression: not yet asked — probe gently`
      : `[ ] Aggression: not yet asked`;

  const anxTick = profile.realAnxiety === true
    ? `[x] Anxiety: CONFIRMED`
    : profile.hasAnxiety
      ? `[~] Anxiety: mentioned but not confirmed — sift further`
      : `[ ] Anxiety: not yet asked`;

  const rescueTick = profile.isRescue
    ? `[x] Rescue: yes${profile.rescueRestart === true ? " — unknown bg + shut down" : " — background unclear"}`
    : `[ ] Rescue: not yet asked`;

  const recLine = rec
    ? `[x] RECOMMENDATION LOCKED: ${rec.program}, ${rec.weeks} weeks — ${rec.reason}`
    : `[ ] Recommendation: not enough info yet`;

  const trainerLine = profile.closestTrainer
    ? `[x] Closest trainer: ${profile.closestTrainer.city}, ${profile.closestTrainer.state} (${profile.closestTrainer.distanceMiles}mi)`
    : `[ ] Location: unknown`;

  const profileCompact = `PROFILE CHECKLIST — only reference [x] items. Never invent or assume [ ] items.
${nameTick}
${ageTick}
${breedTick}
${aggTick}
${anxTick}
${rescueTick}
${recLine}
${trainerLine}${profile.clientEmail ? "\n[x] Email: " + profile.clientEmail : ""}${profile.clientPhone ? "\n[x] Phone: " + profile.clientPhone : ""}

STRICT RULE: If a field shows [ ] you do not know it. Do NOT guess, assume, or reference it. Ask instead.`;

  return `You are Alma, a Training Consultant at Dogwise Academy. Text conversation with a potential client.

PERSONA
- Warm, energetic, real - like a passionate trainer texting between sessions
- Conversational, not corporate. Occasional very minor typo or casual phrasing is fine ("gonna", "tbh", "lol" very sparingly)
- Short messages. One idea at a time.
- Light humour where it fits. Never jokey about aggression or safety.
- NEVER use em dashes (--). Use commas, "and", or a new sentence instead.
- Never say "Great question!" or any hollow filler.
- Your name is Alma. If asked if you're AI: "Ha, I wish - then I wouldn't have to answer messages on weekends"

GOAL
Get the customer to either agree to a phone call OR pay the deposit directly over text. A call is the preferred close because it converts better, but if they don't want a call, keep going over text and close with the deposit link. Never lose the customer just because they won't call.

${hsContext}

CONVERSATION FLOW
1. RAPPORT - Acknowledge what they shared. Show you get it. One warm question.
2. DISCOVERY - Fill gaps in the profile. One question per message. Probe red flags gently.
3. RECOMMENDATION - Name the program, weeks, price, one sentence why it fits THIS dog.
4. CALL OFFER (once) - Offer a call naturally once: "want to jump on a quick call so I can walk you through it?"
5. IF THEY DECLINE THE CALL - Don't push again immediately. Keep answering questions over text, handle objections, build confidence. Be genuinely helpful.
6. SECOND CALL OFFER - After handling their questions, try once more: "honestly a 5-min call is the easiest way to get you sorted - want to try that?"
7. IF THEY STILL DECLINE - Close over text. Send the deposit link. "I can send you the link to secure your spot right now if you're ready."
8. TEXT CLOSE - Some people just prefer text and that's totally fine. The deposit link works just as well.

CALL OFFER RULES
- Offer the call maximum 2 times total per conversation
- After 2 declines, stop mentioning the call and close over text instead
- Never say "I'd rather discuss on a call" - that's dismissive. If they want text, work with text.
- Don't end every single message with a call offer - that's spam

WHEN CALL IS AGREED
When the customer says yes to a call (any variation: "sure", "yeah", "that works", "sounds good"):
- Confirm briefly and warmly
- Ask for their number if you don't have it already (phone: ${profile.clientPhone || "unknown"})
- Tell them someone from the team will call them shortly
- Output this exact tag on its own line: [CALL_AGREED]

WHEN CLOSING OVER TEXT (no call)
When they've declined a call twice and seem ready:
- Tell them you can send a full details email with price, payment plan options and everything
- Ask to confirm their email: "is ${profile.clientEmail || "your email address"} still the best for you?"
- Output this exact tag on its own line: [EMAIL_REQUESTED]

DISCOVERY PRIORITIES (only ask what profile is missing, in this order)
- Dog name (ask early if not known - "what's their name?")
- Age (confirm if form gave a range)
- Breed/size
- Main behaviour problems  
- Bite or snap history - probe gently even if not raised
- Anxiety - sift real (panics alone, storms, trembles) from timid (new house, crate protest)
- Rescue background
- Obedience baseline

BITE/AGGRESSION (slow down here)
- Probe: snap or contact? Break skin?
- People minimise - "just a nip", "only once"
- Young dog + excitement + no aggression intent = Adolescent Essentials, not aggression program
- Real aggression = Reactivity & Aggression Reset 5-6 weeks

ANXIETY SIFT
Real: panics alone, trembles at storms, can't settle, destructive when left
Not real: new house 1 day, dislikes crate, barks at strangers, timid

LOCATION
${trainerInfo}
- We're a network of home-based trainers. Dog lives with the trainer during the program.

PRICING & VALUE
${pricing}
- Before recommendation: NEVER give a price. Say "I need to know a bit more about your dog before I can give you the right number" and keep gathering info. No ranges, no ballparks.
- If they keep pushing before recommendation: "I really want to get you an accurate number, not just a guess - bear with me one sec"
- After recommendation: give the price confidently then follow with the value prop naturally - something like: "We do free pickup and dropoff, you get daily videos the whole time so you can see exactly what's going on, and on the day you pick them up we spend a few hours with you training you on how to keep it going. Then 3 follow-up sessions after, plus lifetime support so we come back as many times as needed. I can shoot you over a full email with the details and payment plan options - is ${profile.clientEmail ? profile.clientEmail : "your email"} still the best address for you?"
- The value prop should feel natural and conversational, not like a bulleted list
- Always offer the details email after giving the price
- Never offer discounts
- When they confirm their email or say yes to the email: output [EMAIL_REQUESTED] on its own line

PROGRAMS
- Puppy Foundations (2 wks): 0-6 months, small/medium breeds
- Big Puppy (3 wks): 0-6 months, large breeds (Husky, GSD, Rottweiler, Mastiff etc.)
- Adolescent Essentials (3-4 wks): 6 months+, no complex issues
- Strong Companion (4-6 wks): 12m+, has basics, needs real-world control
- Rescue Restart (4 wks): rescue + unknown history + shut-down/fearful/skittish behaviour
- Anxiety Support (4 wks): confirmed anxiety (separation panic, storms, can't settle)
- Reactivity & Aggression Reset (5-6 wks): actual aggression, lunging, bite history

CRITICAL PROGRAM DISTINCTIONS
- Defensive/scared rescue dog with no bites = Rescue Restart or Anxiety Support, NOT Reactivity & Aggression Reset
- Small dog "aggression" is almost always fear-based = probe carefully before assuming aggression program
- Husky, GSD, Malamute under 6 months = Big Puppy (large breed), NOT Puppy Foundations
- Reactivity & Aggression Reset is for dogs that are genuinely dangerous, not just reactive or scared

WHAT WE DON'T DO (pivot, never just refuse)
- Full off-leash/competition: "we do solid recall and control - what's the main thing driving that?"
- Protection/guard/service dog: "not our area, but good obedience is the foundation for all of that - tell me more about what you're after"

CURRENT PROFILE
${profileCompact}

RULES
- Never recommend on the first response
- Only recommend when age + main issues + aggression/anxiety probed
- Never give free training tips
- Never use bullet points in messages
- One question per message maximum
- LOCKED RECOMMENDATION: When _recommendation is set in the profile JSON, that IS the program. Do not second-guess it, do not suggest alternatives, do not override it with your own reasoning. The program and weeks in _recommendation are final.
- When a customer questions the program or weeks, explain why it fits using the reason field. Do not change the recommendation.
- NEVER invent dog details not in the profile. If the profile says 6 years old, the dog is 6 years old.`;
}

// ── Conversation history ──────────────────────────────────────
const history = [];
let chatStarted = false;

// ── UI helpers ────────────────────────────────────────────────
const messagesEl = document.getElementById("messages");
const inputEl    = document.getElementById("input");
const sendBtn    = document.getElementById("send");
const debugEl    = document.getElementById("debug");
const loaderEl   = document.getElementById("hs-loader");

function addBubble(role, text) {
  // Strip the [CALL_AGREED] tag from display
  const display = text.replace(/\[CALL_AGREED\]/g, "").trim();
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;
  if (role === "Alma") {
    row.innerHTML = `<div class="msg-avatar">🐾</div><div class="bubble">${display.replace(/\n/g, "<br>")}</div>`;
  } else {
    row.innerHTML = `<div class="bubble">${display.replace(/\n/g, "<br>")}</div>`;
  }
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "msg-row Alma"; row.id = "typing";
  row.innerHTML = `<div class="msg-avatar">🐾</div><div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function hideTyping() { const t = document.getElementById("typing"); if (t) t.remove(); }
function log(msg) { debugEl.textContent = msg; }

function setLoaderStatus(msg, success = false) {
  const statusEl = document.getElementById("loader-status");
  if (statusEl) {
    statusEl.textContent = msg;
    statusEl.style.color = success ? "var(--sage)" : "var(--muted)";
  }
}
function hideLoader() {
  if (loaderEl) { loaderEl.style.display = "none"; loaderEl.style.visibility = "hidden"; }
  const ca = document.getElementById("chat-area");
  if (ca) { ca.style.display = "flex"; ca.style.visibility = "visible"; }
}

// ── Profile extractor ─────────────────────────────────────────
async function extractProfile(userMessage) {
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0,
        max_tokens: 300,
        messages: [
          { role: "system", content: `Extract dog profile data. Return ONLY valid JSON, no markdown:
{
  "ageMonths": number or null,
  "isLargeBreed": boolean or null,
  "breed": string or null,
  "hasAggression": boolean,
  "biteHistory": boolean,
  "skinBroken": boolean,
  "excitementBite": boolean,
  "hasAnxiety": boolean,
  "isRescue": boolean,
  "hasObedience": boolean,
  "zip": string or null
}
Large breeds (MUST set isLargeBreed=true): Rottweiler, Pitbull, Pit Bull, GSD, German Shepherd, Mastiff, Great Dane, Doberman, Cane Corso, Bullmastiff, Bernese Mountain Dog, Saint Bernard, Weimaraner, Rhodesian Ridgeback, Dogo Argentino, Boerboel, Siberian Husky, Alaskan Malamute, Akita, Boxer, Irish Wolfhound, Great Pyrenees. Small/medium breeds (isLargeBreed=false): Shih Tzu, Chihuahua, Poodle (toy/mini), Maltese, Yorkie, Pomeranian, Bichon, Cavalier, Dachshund, Beagle, Cocker Spaniel, Pug, Frenchie, Boston Terrier.
Age: "puppy"=3, "8 weeks"=2, "4 months"=4, "6 months"=6, "1 year"=12, "18 months"=18, "2 years"=24, "3 years"=36, "4 years"=48.
excitementBite=true only if young + accidental/play + no aggression pattern.
zip: 5-digit US ZIP only if explicitly mentioned.` },
          { role: "user", content: userMessage }
        ]
      })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch(e) { log("Extract err: " + e.message); return null; }
}

// ── Main reply ────────────────────────────────────────────────
async function getAlmaReply() {
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.55,
        max_tokens: 400,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          ...history
        ]
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Sorry, missed that - can you say it again?";
  } catch(e) { log("Reply err: " + e.message); return "Give me a second, something went wrong on my end!"; }
}

// ── Send flow ─────────────────────────────────────────────────
async function send() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = ""; inputEl.style.height = "42px";
  sendBtn.disabled = true;
  addBubble("user", text);
  history.push({ role: "user", content: text });
  showTyping();

  const extracted = await extractProfile(text);
  if (extracted) {
    if (extracted.ageMonths != null)    profile.ageMonths    = extracted.ageMonths;
    if (extracted.isLargeBreed != null) profile.isLargeBreed = extracted.isLargeBreed;
    if (extracted.breed)                profile.breed        = extracted.breed;
    if (extracted.hasAggression)        profile.hasAggression  = true;
    if (extracted.biteHistory)          profile.biteHistory    = true;
    if (extracted.skinBroken)           profile.skinBroken     = true;
    if (extracted.excitementBite)       profile.excitementBite = true;
    if (extracted.hasAnxiety)           profile.hasAnxiety     = true;
    if (extracted.isRescue)             profile.isRescue       = true;
    if (extracted.hasObedience)         profile.hasObedience   = true;
    if (extracted.zip && extracted.zip !== profile.zip) {
      profile.zip = extracted.zip;
      zipToCoords(extracted.zip).then(coords => {
        if (coords) {
          profile.userCity  = coords.city;
          profile.userState = coords.state;
          profile.closestTrainer = closestTrainer(coords.lat, coords.lon);
        }
      });
    }
    log("Profile: " + JSON.stringify(profile));
  }

  const reply = await getAlmaReply();
  hideTyping();
  addBubble("Alma", reply);
  history.push({ role: "assistant", content: reply });

  // Write dog name to HubSpot as soon as we get it
  if (profile.dogName && profile.hubspotDealId && !profile._dogNameSaved) {
    profile._dogNameSaved = true;
    updateDealProps({ k9___dog_name: profile.dogName });
  }
  // Update running summary on every message
  if (profile.hubspotDealId) {
    updateDealProps({ note_from_customer: buildChatSummary() });
  }

  // Detect call agreed
  if (!profile.callAgreed && reply.includes("[CALL_AGREED]")) {
    profile.callAgreed = true;
    createCallTask();
  }
  // Detect email requested
  if (!profile.emailTaskCreated && reply.includes("[EMAIL_REQUESTED]")) {
    profile.emailTaskCreated = true;
    createEmailTask();
  }

  sendBtn.disabled = false;
  inputEl.focus();
}

// ── Input events ──────────────────────────────────────────────
sendBtn.addEventListener("click", send);
inputEl.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
inputEl.addEventListener("input", () => { inputEl.style.height = "42px"; inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px"; });

// ── HubSpot loader UI ─────────────────────────────────────────
document.getElementById("load-deal-btn").addEventListener("click", async () => {
  const input = document.getElementById("deal-url-input").value.trim();
  // Accept full URL or just the deal ID
  const match = input.match(/\/deals?\/(\d+)/) || input.match(/\/record\/0-3\/(\d+)/) || input.match(/^(\d+)$/);
  if (!match) { setLoaderStatus("Paste a HubSpot deal URL or just the deal ID number."); return; }
  await loadHubSpotDeal(match[1]);
});

document.getElementById("skip-hs-btn").addEventListener("click", () => {
  hideLoader();
  startChat();
});

// ── Start chat ────────────────────────────────────────────────
function startChat() {
  if (chatStarted) return;
  chatStarted = true;

  const dogName = profile.dogName ? profile.dogName.charAt(0).toUpperCase() + profile.dogName.slice(1).toLowerCase() : null;
  const firstName = profile.clientFirstName ? profile.clientFirstName.charAt(0).toUpperCase() + profile.clientFirstName.slice(1).toLowerCase() : null;

  let opening;
  if (firstName && dogName) {
    opening = `Hey ${firstName}! I'm Alma from Dogwise Academy. So excited to hear about ${dogName} - tell me, what's the main thing you're struggling with right now?`;
  } else if (firstName) {
    opening = `Hey ${firstName}! Alma here from Dogwise Academy. Thanks for reaching out - tell me a bit about your dog, what's going on with them?`;
  } else if (dogName) {
    opening = `Hey! I'm Alma from Dogwise Academy. I can see you reached out about ${dogName} - what's the main thing you'd love to work on?`;
  } else {
    opening = `Hey! I'm Alma from Dogwise Academy - thanks for reaching out. Tell me about your dog, what's going on with them?`;
  }

  showTyping();
  setTimeout(() => {
    hideTyping();
    addBubble("Alma", opening);
    history.push({ role: "assistant", content: opening });
    inputEl.focus();
  }, 900);
}
</script>
</body>
</html>
