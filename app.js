let currentSource = null;
let currentPage = 0;
let pageTokens = [null];

const $ = id => document.getElementById(id);

function api(path, params) {
  const q = new URLSearchParams(params);
  q.set("key", CONFIG.apiKey);
  return "https://www.googleapis.com/youtube/v3/" + path + "?" + q.toString();
}

function show(id) {
  ["homeView", "videosView", "playerView"].forEach(x => $(x).classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function init() {
  renderChannels();
  renderPlaylists();

  $("homeBtn").onclick = () => {
    closePlayer();
    show("homeView");
  };

  $("homeBackBtn").onclick = () => {
    closePlayer();
    show("homeView");
  };

  $("playerBack").onclick = () => {
    closePlayer();
    show("videosView");
  };

  if (!CONFIG.apiKey || CONFIG.apiKey.includes("LISAA_")) {
    $("status").textContent = "Lisää uusi YouTube Data API v3 -avain config.js-tiedostoon.";
  }
}

function renderChannels() {
  const box = $("channels");
  box.innerHTML = "";

  (CONFIG.channels || []).forEach((channel, index) => {
    const card = document.createElement("button");
    card.className = "source-card";

    card.innerHTML =
      '<img id="channel-logo-' + index + '" alt="">' +
      '<div>' +
        '<div class="name">' + esc(channel.name) + '</div>' +
        '<div class="desc">Ladataan kanavan tietoja…</div>' +
      '</div>';

    card.onclick = () => openChannel(channel);
    box.appendChild(card);
    loadChannelSummary(channel, card);
  });
}

function renderPlaylists() {
  const box = $("playlists");
  box.innerHTML = "";

  (CONFIG.playlists || []).forEach(playlist => {
    const card = document.createElement("button");
    card.className = "source-card";

    card.innerHTML =
      '<div class="playlist-icon">▶</div>' +
      '<div>' +
        '<div class="name">' + esc(playlist.name) + '</div>' +
        '<div class="desc">Ladataan soittolistan tietoja…</div>' +
      '</div>';

    card.onclick = () => openPlaylist(playlist);
    box.appendChild(card);
    loadPlaylistSummary(playlist, card);
  });

  if (!CONFIG.playlists || CONFIG.playlists.length === 0) {
    box.innerHTML = '<p class="status">Ei soittolistoja.</p>';
  }
}

async function loadChannelSummary(channel, card) {
  try {
    const data = await fetch(api("channels", {
      part: "snippet,statistics",
      id: channel.id
    })).then(r => r.json());

    if (data.error) throw new Error(data.error.message);

    const item = data.items?.[0];
    if (!item) throw new Error("Kanavaa ei löytynyt.");

    const thumbs = item.snippet.thumbnails || {};
    card.querySelector("img").src =
      thumbs.medium?.url || thumbs.default?.url || "";

    card.querySelector(".desc").textContent =
      item.snippet.description || "Ei kuvausta.";
  } catch (e) {
    card.querySelector(".desc").textContent =
      "Kanavan tietoja ei voitu ladata.";
  }
}

async function loadPlaylistSummary(playlist, card) {
  try {
    const data = await fetch(api("playlists", {
      part: "snippet,contentDetails",
      id: playlist.id
    })).then(r => r.json());

    if (data.error) throw new Error(data.error.message);

    const item = data.items?.[0];
    if (!item) throw new Error("Soittolistaa ei löytynyt.");

    const count = item.contentDetails?.itemCount || 0;
    card.querySelector(".desc").textContent =
      (item.snippet.description || "Ei kuvausta.") +
      " • " + count + " videota";
  } catch (e) {
    card.querySelector(".desc").textContent =
      "Soittolistan tietoja ei voitu ladata.";
  }
}

async function openChannel(channel) {
  currentSource = {
    type: "channel",
    name: channel.name,
    id: channel.id
  };

  showSourceLoading();

  try {
    const data = await fetch(api("channels", {
      part: "snippet,statistics,contentDetails",
      id: channel.id
    })).then(r => r.json());

    if (data.error) throw new Error(data.error.message);

    const item = data.items?.[0];
    if (!item) throw new Error("Kanavaa ei löytynyt.");

    const playlistId =
      item.contentDetails?.relatedPlaylists?.uploads;

    if (!playlistId) {
      throw new Error("Kanavan videosoittolistaa ei löytynyt.");
    }

    currentSource.playlistId = playlistId;
    renderChannelHeader(item);
    await loadPage(0);

  } catch (e) {
    $("videoStatus").textContent = "Virhe: " + e.message;
  }
}

async function openPlaylist(playlist) {
  currentSource = {
    type: "playlist",
    name: playlist.name,
    id: playlist.id,
    playlistId: playlist.id
  };

  showSourceLoading();

  try {
    const data = await fetch(api("playlists", {
      part: "snippet,contentDetails",
      id: playlist.id
    })).then(r => r.json());

    if (data.error) throw new Error(data.error.message);

    const item = data.items?.[0];
    if (!item) throw new Error("Soittolistaa ei löytynyt.");

    renderPlaylistHeader(item);
    await loadPage(0);

  } catch (e) {
    $("videoStatus").textContent = "Virhe: " + e.message;
  }
}

function showSourceLoading() {
  currentPage = 0;
  pageTokens = [null];

  show("videosView");
  $("sourceHeader").innerHTML = "";
  $("videos").innerHTML = "";
  $("videoStatus").textContent = "Ladataan…";
  $("pagination").innerHTML = "";
}

async function loadPage(page) {
  currentPage = page;
  $("videos").innerHTML = "";
  $("videoStatus").textContent = "Ladataan videoita…";

  try {
    const params = {
      part: "snippet,contentDetails",
      playlistId: currentSource.playlistId,
      maxResults: CONFIG.videosPerPage || 12
    };

    if (pageTokens[page]) {
      params.pageToken = pageTokens[page];
    }

    const data = await fetch(api("playlistItems", params))
      .then(r => r.json());

    if (data.error) throw new Error(data.error.message);

    renderVideos(data.items || []);

    pageTokens[page + 1] = data.nextPageToken || null;

    $("videoStatus").textContent =
      data.items?.length ? "" : "Videoita ei löytynyt.";

    renderPagination();

    window.scrollTo(0, 0);

  } catch (e) {
    $("videoStatus").textContent =
      "Videoiden lataus epäonnistui: " + e.message;
    renderPagination();
  }
}

function renderPagination() {
  const box = $("pagination");
  box.innerHTML = "";

  const prev = document.createElement("button");
  prev.className = "page-button";
  prev.textContent = "← Uudemmat";
  prev.disabled = currentPage === 0;
  prev.onclick = () => loadPage(currentPage - 1);

  const number = document.createElement("span");
  number.className = "page-number";
  number.textContent = "Sivu " + (currentPage + 1);

  const next = document.createElement("button");
  next.className = "page-button";
  next.textContent = "Vanhemmat →";
  next.disabled = !pageTokens[currentPage + 1];
  next.onclick = () => loadPage(currentPage + 1);

  box.append(prev, number, next);
}

function renderChannelHeader(item) {
  const s = item.snippet;
  const st = item.statistics || {};
  const thumbs = s.thumbnails || {};

  const img =
    thumbs.high?.url ||
    thumbs.medium?.url ||
    thumbs.default?.url || "";

  const subscribers = st.subscriberCount
    ? Number(st.subscriberCount).toLocaleString("fi-FI") + " tilaajaa"
    : "";

  const views = st.viewCount
    ? Number(st.viewCount).toLocaleString("fi-FI") + " katselukertaa"
    : "";

  $("sourceHeader").innerHTML =
    '<div class="source-header">' +
      '<img class="channel-logo" src="' + esc(img) + '" alt="">' +
      '<div>' +
        '<div class="source-name">' + esc(s.title) + '</div>' +
        '<div class="source-description">' +
          esc(s.description || "Ei kuvausta.") +
        '</div>' +
        '<div class="source-stats">' +
          esc([subscribers, views].filter(Boolean).join(" • ")) +
        '</div>' +
      '</div>' +
    '</div>';
}

function renderPlaylistHeader(item) {
  const s = item.snippet;
  const count = item.contentDetails?.itemCount || 0;

  $("sourceHeader").innerHTML =
    '<div class="source-header">' +
      '<div class="playlist-icon large">▶</div>' +
      '<div>' +
        '<div class="source-name">' + esc(s.title) + '</div>' +
        '<div class="source-description">' +
          esc(s.description || "Ei kuvausta.") +
        '</div>' +
        '<div class="source-stats">' +
          count + " videota" +
        '</div>' +
      '</div>' +
    '</div>';
}

function renderVideos(items) {
  const box = $("videos");
  box.innerHTML = "";

  items.forEach(item => {
    const id = item.contentDetails?.videoId;
    if (!id) return;

    const s = item.snippet;
    const thumbs = s.thumbnails || {};
    const thumb =
      thumbs.high?.url ||
      thumbs.medium?.url ||
      thumbs.default?.url || "";

    const card = document.createElement("article");
    card.className = "video-card";

    card.innerHTML =
      '<img class="thumb" src="' + esc(thumb) + '" alt="">' +
      '<div class="video-body">' +
        '<div class="video-title">' + esc(s.title) + '</div>' +
        '<div class="video-date">' + formatDate(s.publishedAt) + '</div>' +
      '</div>';

    card.onclick = () => openVideo(id, s.title);
    box.appendChild(card);
  });
}

function openVideo(id, title) {
  $("playerTitle").textContent = title;
  show("playerView");

  const host = $("playerHost");
  host.innerHTML = "";

  const iframe = document.createElement("iframe");

  iframe.src =
    "https://www.youtube.com/embed/" +
    encodeURIComponent(id) +
    "?autoplay=1&playsinline=1&rel=0&modestbranding=1&fs=1";

  iframe.allow =
    "autoplay; encrypted-media; picture-in-picture; fullscreen";

  iframe.allowFullscreen = true;
  iframe.frameBorder = "0";

  host.appendChild(iframe);
  requestFullscreenNow(host);
}

function requestFullscreenNow(el) {
  try {
    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.webkitRequestFullScreen;

    if (fn) {
      const result = fn.call(el);
      if (result?.catch) result.catch(() => {});
    }
  } catch (_) {}
}

function closePlayer() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
    }
  } catch (_) {}

  $("playerHost").innerHTML = "";
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("fi-FI", {
      dateStyle: "medium"
    }).format(new Date(value));
  } catch (_) {
    return "";
  }
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

init();
