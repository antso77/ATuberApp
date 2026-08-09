let currentChannel = null;
let currentPage = 0;
let pageTokens = [null];

const $ = id => document.getElementById(id);

function api(path, params) {
  const q = new URLSearchParams(params);
  q.set("key", CONFIG.apiKey);
  return "https://www.googleapis.com/youtube/v3/" + path + "?" + q.toString();
}

function show(id) {
  ["channelsView", "videosView", "playerView"].forEach(x => $(x).classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function init() {
  renderChannelList();

  $("homeBtn").onclick = () => {
    closePlayer();
    show("channelsView");
  };

  $("channelsBtn").onclick = () => {
    closePlayer();
    show("channelsView");
  };

  $("playerBack").onclick = () => {
    closePlayer();
    show("videosView");
  };

  if (!CONFIG.apiKey || CONFIG.apiKey.indexOf("LISAA_") === 0) {
    $("status").textContent = "Lisää YouTube Data API v3 -avain config.js-tiedostoon.";
  }
}

function renderChannelList() {
  const box = $("channels");
  box.innerHTML = "";

  CONFIG.channels.forEach((channel, index) => {
    const card = document.createElement("button");
    card.className = "channel-card";

    card.innerHTML =
      '<img id="channel-logo-' + index + '" alt="">' +
      '<div>' +
      '<div class="name">' + escapeHtml(channel.name) + '</div>' +
      '<div class="desc">Ladataan kanavan tietoja…</div>' +
      '</div>';

    card.onclick = function () {
      loadChannel(channel);
    };

    box.appendChild(card);
    loadChannelSummary(channel, card);
  });
}

async function loadChannelSummary(channel, card) {
  try {
    const response = await fetch(api("channels", {
      part: "snippet,statistics",
      id: channel.id
    }));

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const item = data.items && data.items.length ? data.items[0] : null;
    if (!item) {
      throw new Error("Kanavaa ei löytynyt.");
    }

    const image =
      (item.snippet.thumbnails.medium && item.snippet.thumbnails.medium.url) ||
      (item.snippet.thumbnails.default && item.snippet.thumbnails.default.url) ||
      "";

    card.querySelector("img").src = image;
    card.querySelector(".desc").textContent =
      item.snippet.description || "Ei kuvausta.";

  } catch (e) {
    card.querySelector(".desc").textContent =
      "Kanavan tietoja ei voitu ladata.";
  }
}

async function loadChannel(channel) {
  currentChannel = channel;
  currentPage = 0;
  pageTokens = [null];

  show("videosView");

  $("channelHeader").innerHTML = "";
  $("videos").innerHTML = "";
  $("videoStatus").textContent = "Ladataan kanavaa…";
  $("pagination").innerHTML = "";

  try {
    const response = await fetch(api("channels", {
      part: "snippet,statistics,contentDetails",
      id: channel.id
    }));

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const item = data.items && data.items.length ? data.items[0] : null;
    if (!item) {
      throw new Error("Kanavaa ei löytynyt.");
    }

    renderChannelHeader(item);

    const uploads =
      item.contentDetails &&
      item.contentDetails.relatedPlaylists &&
      item.contentDetails.relatedPlaylists.uploads;

    if (!uploads) {
      throw new Error("Kanavan videosoittolistaa ei löytynyt.");
    }

    currentChannel.uploadsPlaylistId = uploads;

    await loadVideoPage(0);

  } catch (e) {
    $("videoStatus").textContent = "Virhe: " + e.message;
  }
}

async function loadVideoPage(page) {
  if (!currentChannel || !currentChannel.uploadsPlaylistId) {
    $("videoStatus").textContent = "Kanavaa ei ole valittu.";
    return;
  }

  currentPage = page;
  $("videos").innerHTML = "";
  $("videoStatus").textContent = "Ladataan videoita…";

  try {
    const params = {
      part: "snippet,contentDetails",
      playlistId: currentChannel.uploadsPlaylistId,
      maxResults: CONFIG.videosPerChannel
    };

    const token = pageTokens[page];
    if (token) {
      params.pageToken = token;
    }

    const response = await fetch(api("playlistItems", params));
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    renderVideos(data.items || []);

    pageTokens[page + 1] = data.nextPageToken || null;

    if (!data.items || data.items.length === 0) {
      $("videoStatus").textContent = "Tällä sivulla ei ole videoita.";
    } else {
      $("videoStatus").textContent = "";
    }

    renderPagination();

    try {
      window.scrollTo(0, 0);
    } catch (_) {}

  } catch (e) {
    $("videoStatus").textContent = "Videoiden lataus epäonnistui: " + e.message;
    renderPagination();
  }
}

function renderPagination() {
  const nav = $("pagination");
  nav.innerHTML = "";

  const previous = document.createElement("button");
  previous.className = "page-button";
  previous.textContent = "← Uudemmat";
  previous.disabled = currentPage === 0;
  previous.onclick = function () {
    if (currentPage > 0) {
      loadVideoPage(currentPage - 1);
    }
  };

  const page = document.createElement("span");
  page.className = "page-number";
  page.textContent = "Sivu " + (currentPage + 1);

  const next = document.createElement("button");
  next.className = "page-button";
  next.textContent = "Vanhemmat →";
  next.disabled = !pageTokens[currentPage + 1];
  next.onclick = function () {
    if (pageTokens[currentPage + 1]) {
      loadVideoPage(currentPage + 1);
    }
  };

  nav.appendChild(previous);
  nav.appendChild(page);
  nav.appendChild(next);
}

function renderChannelHeader(item) {
  const s = item.snippet;
  const st = item.statistics || {};

  const thumbs = s.thumbnails || {};
  const img =
    (thumbs.high && thumbs.high.url) ||
    (thumbs.medium && thumbs.medium.url) ||
    (thumbs.default && thumbs.default.url) ||
    "";

  const subscribers = st.subscriberCount
    ? Number(st.subscriberCount).toLocaleString("fi-FI") + " tilaajaa"
    : "";

  const views = st.viewCount
    ? Number(st.viewCount).toLocaleString("fi-FI") + " katselukertaa"
    : "";

  $("channelHeader").innerHTML =
    '<div class="channel-hero">' +
      '<img class="channel-logo" src="' + escapeAttr(img) + '" alt="">' +
      '<div>' +
        '<div class="channel-name">' + escapeHtml(s.title) + '</div>' +
        '<div class="channel-description">' +
          escapeHtml(s.description || "Ei kuvausta.") +
        '</div>' +
        '<div class="channel-stats">' +
          escapeHtml([subscribers, views].filter(Boolean).join(" • ")) +
        '</div>' +
      '</div>' +
    '</div>';
}

function renderVideos(items) {
  const box = $("videos");
  box.innerHTML = "";

  items.forEach(item => {
    const s = item.snippet;
    const videoId =
      item.contentDetails && item.contentDetails.videoId;

    if (!videoId) return;

    const thumbs = s.thumbnails || {};
    const thumb =
      (thumbs.high && thumbs.high.url) ||
      (thumbs.medium && thumbs.medium.url) ||
      (thumbs.default && thumbs.default.url) ||
      "";

    const card = document.createElement("article");
    card.className = "video-card";

    card.innerHTML =
      '<img class="thumb" src="' + escapeAttr(thumb) + '" alt="">' +
      '<div class="video-body">' +
        '<div class="video-title">' + escapeHtml(s.title) + '</div>' +
        '<div class="video-date">' + formatDate(s.publishedAt) + '</div>' +
      '</div>';

    card.onclick = function () {
      openFullscreenVideo(videoId, s.title);
    };

    box.appendChild(card);
  });
}

function openFullscreenVideo(videoId, title) {
  $("playerTitle").textContent = title;
  show("playerView");

  const host = $("playerHost");
  host.innerHTML = "";

  const iframe = document.createElement("iframe");

  iframe.src =
    "https://www.youtube.com/embed/" +
    encodeURIComponent(videoId) +
    "?autoplay=1&playsinline=1&rel=0&modestbranding=1&fs=1";

  iframe.allow =
    "autoplay; encrypted-media; picture-in-picture; fullscreen";

  iframe.setAttribute("allowfullscreen", "");
  iframe.setAttribute("frameborder", "0");

  host.appendChild(iframe);

  requestFullscreenNow(host);
}

function requestFullscreenNow(element) {
  try {
    const fn =
      element.requestFullscreen ||
      element.webkitRequestFullscreen ||
      element.webkitRequestFullScreen ||
      element.msRequestFullscreen;

    if (fn) {
      const result = fn.call(element);
      if (result && result.catch) {
        result.catch(function () {});
      }
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c];
  });
}

function escapeAttr(value) {
  return escapeHtml(value);
}

init();
