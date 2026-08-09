const $ = id => document.getElementById(id);
let currentChannel = null;
let player = null;

const api = (path, params) => {
  const q = new URLSearchParams({...params, key: CONFIG.apiKey});
  return `https://www.googleapis.com/youtube/v3/${path}?${q}`;
};

function show(view) {
  ["channelsView","videosView","playerView"].forEach(id => $(id).classList.add("hidden"));
  $(view).classList.remove("hidden");
}

function init() {
  if (!CONFIG.apiKey || CONFIG.apiKey.includes("LISAA_")) {
    $("status").textContent = "Lisää YouTube Data API v3 -avain tiedostoon config.js.";
  }
  renderChannels();
  $("homeBtn").onclick = () => { show("channelsView"); };
  $("channelsBtn").onclick = () => show("channelsView");
  $("backBtn").onclick = () => history.back();
  $("playerBack").onclick = () => {
    if (player) { player.destroy(); player = null; }
    show("videosView");
  };
}

function renderChannels() {
  const box = $("channels");
  box.innerHTML = "";
  CONFIG.channels.forEach(ch => {
    const b = document.createElement("button");
    b.className = "channel";
    b.textContent = ch.name;
    b.onclick = () => loadChannel(ch);
    box.appendChild(b);
  });
}

async function loadChannel(ch) {
  currentChannel = ch;
  $("channelTitle").textContent = ch.name;
  $("videos").innerHTML = "";
  $("videoStatus").textContent = "Ladataan videoita…";
  show("videosView");

  try {
    const c = await fetch(api("channels", {
      part: "contentDetails",
      id: ch.id
    })).then(r => r.json());

    if (c.error) throw new Error(c.error.message);
    const uploads = c.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) throw new Error("Kanavan uploads-soittolistaa ei löytynyt.");

    const data = await fetch(api("playlistItems", {
      part: "snippet,contentDetails",
      playlistId: uploads,
      maxResults: CONFIG.videosPerChannel
    })).then(r => r.json());

    if (data.error) throw new Error(data.error.message);
    renderVideos(data.items || []);
    $("videoStatus").textContent = data.items?.length ? "" : "Videoita ei löytynyt.";
  } catch (e) {
    $("videoStatus").textContent = "Virhe: " + e.message;
  }
}

function renderVideos(items) {
  const box = $("videos");
  box.innerHTML = "";
  items.forEach(item => {
    const s = item.snippet;
    const id = item.contentDetails?.videoId;
    if (!id) return;

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <img class="thumb" src="${escapeAttr(s.thumbnails?.medium?.url || s.thumbnails?.default?.url || "")}" alt="">
      <div class="card-body">
        <div class="title">${escapeHtml(s.title)}</div>
        <div class="date">${formatDate(s.publishedAt)}</div>
      </div>`;
    card.onclick = () => openPlayer(id, s.title);
    box.appendChild(card);
  });
}

function openPlayer(videoId, title) {
  $("playerTitle").textContent = title;
  show("playerView");
  const iframe = document.createElement("iframe");
  iframe.src =
    "https://www.youtube.com/embed/" + encodeURIComponent(videoId) +
    "?autoplay=1&playsinline=1&rel=0&modestbranding=1&fs=1";
  iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  iframe.allowFullscreen = true;
  $("player").replaceChildren(iframe);
}

function formatDate(v) {
  try { return new Intl.DateTimeFormat("fi-FI",{dateStyle:"medium"}).format(new Date(v)); }
  catch { return ""; }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

init();
