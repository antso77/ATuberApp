let currentChannel=null;
let currentPage=0;
let pageTokens=[null];
const $=id=>document.getElementById(id);
function api(path,params){return "https://www.googleapis.com/youtube/v3/"+path+"?"+new URLSearchParams({...params,key:CONFIG.apiKey})}
function show(id){["channelsView","videosView","playerView"].forEach(x=>$(x).classList.add("hidden"));$(id).classList.remove("hidden")}
function init(){
  renderChannelList();
  $("homeBtn").onclick=()=>{closePlayer();show("channelsView")};
  $("channelsBtn").onclick=()=>show("channelsView");
  $("playerBack").onclick=()=>{closePlayer();show("videosView")};
  if(!CONFIG.apiKey||CONFIG.apiKey.includes("LISAA_"))$("status").textContent="Lisää YouTube Data API v3 -avain config.js-tiedostoon.";
}
function renderChannelList(){
  const box=$("channels"); box.innerHTML="";
  CONFIG.channels.forEach((channel,index)=>{
    const card=document.createElement("button"); card.className="channel-card";
    card.innerHTML='<img id="channel-logo-'+index+'" alt=""><div><div class="name">'+escapeHtml(channel.name)+'</div><div class="desc">Ladataan kanavan tietoja…</div></div>';
    card.onclick=()=>loadChannel(channel); box.appendChild(card); loadChannelSummary(channel,card);
  });
}
async function loadChannelSummary(channel,card){
  try{
    const data=await fetch(api("channels",{part:"snippet,statistics",id:channel.id})).then(r=>r.json());
    if(data.error)throw new Error(data.error.message); const item=data.items?.[0]; if(!item)throw new Error("Kanavaa ei löytynyt.");
    card.querySelector("img").src=item.snippet.thumbnails?.medium?.url||item.snippet.thumbnails?.default?.url||"";
    card.querySelector(".desc").textContent=item.snippet.description||"Ei kuvausta.";
  }catch(e){card.querySelector(".desc").textContent="Kanavan tietoja ei voitu ladata."}
}
async function loadChannel(channel){
  currentChannel=channel;
  currentPage=0;
  pageTokens=[null];

  show("videosView");
  $("channelHeader").innerHTML="";
  $("videos").innerHTML="";
  $("videoStatus").textContent="Ladataan kanavaa…";
  renderPagination();

  try{
    const cd=await fetch(api("channels",{
      part:"snippet,statistics,contentDetails",
      id:channel.id
    })).then(r=>r.json());

    if(cd.error)throw new Error(cd.error.message);

    const item=cd.items?.[0];
    if(!item)throw new Error("Kanavaa ei löytynyt.");

    renderChannelHeader(item);

    const uploads=item.contentDetails?.relatedPlaylists?.uploads;
    if(!uploads)throw new Error("Kanavan uploads-listaa ei löytynyt.");

    currentChannel.uploadsPlaylistId=uploads;

    await loadVideoPage(0);
  }catch(e){
    $("videoStatus").textContent="Virhe: "+e.message;
  }
}

async function loadVideoPage(page){
  if(!currentChannel?.uploadsPlaylistId)return;

  currentPage=page;
  $("videos").innerHTML="";
  $("videoStatus").textContent="Ladataan videoita…";

  const token=pageTokens[page];

  try{
    const params={
      part:"snippet,contentDetails",
      playlistId:currentChannel.uploadsPlaylistId,
      maxResults:CONFIG.videosPerChannel
    };

    if(token)params.pageToken=token;

    const data=await fetch(api("playlistItems",params)).then(r=>r.json());

    if(data.error)throw new Error(data.error.message);

    renderVideos(data.items||[]);

    pageTokens[page+1]=data.nextPageToken || null;

    $("videoStatus").textContent=data.items?.length
      ? ""
      : "Tällä sivulla ei ole videoita.";

    renderPagination();
    window.scrollTo({top:0,behavior:"smooth"});
  }catch(e){
    $("videoStatus").textContent="Virhe: "+e.message;
    renderPagination();
  }
}

function renderPagination(){
  let nav=$("pagination");

  if(!nav){
    nav=document.createElement("div");
    nav.id="pagination";
    nav.className="pagination";
    $("videosView").appendChild(nav);
  }

  nav.innerHTML="";

  const previous=document.createElement("button");
  previous.className="page-button";
  previous.textContent="← Uudemmat";
  previous.disabled=currentPage===0;
  previous.onclick=()=>loadVideoPage(currentPage-1);

  const page=document.createElement("span");
  page.className="page-number";
  page.textContent="Sivu "+(currentPage+1);

  const next=document.createElement("button");
  next.className="page-button";
  next.textContent="Vanhemmat →";
  next.disabled=!pageTokens[currentPage+1];
  next.onclick=()=>loadVideoPage(currentPage+1);

  nav.appendChild(previous);
  nav.appendChild(page);
  nav.appendChild(next);
}

function renderChannelHeader(item){
  const s=item.snippet,st=item.statistics||{},img=s.thumbnails?.high?.url||s.thumbnails?.medium?.url||s.thumbnails?.default?.url||"";
  const subs=st.subscriberCount?Number(st.subscriberCount).toLocaleString("fi-FI")+" tilaajaa":"";
  const views=st.viewCount?Number(st.viewCount).toLocaleString("fi-FI")+" katselukertaa":"";
  $("channelHeader").innerHTML='<div class="channel-hero"><img class="channel-logo" src="'+escapeAttr(img)+'" alt=""><div><div class="channel-name">'+escapeHtml(s.title)+'</div><div class="channel-description">'+escapeHtml(s.description||"Ei kuvausta.")+'</div><div class="channel-stats">'+escapeHtml([subs,views].filter(Boolean).join(" • "))+'</div></div></div>';
}
function renderVideos(items){
  const box=$("videos");box.innerHTML="";
  items.forEach(item=>{
    const s=item.snippet,id=item.contentDetails?.videoId;if(!id)return;
    const thumb=s.thumbnails?.high?.url||s.thumbnails?.medium?.url||s.thumbnails?.default?.url||"";
    const card=document.createElement("article");card.className="video-card";
    card.innerHTML='<img class="thumb" src="'+escapeAttr(thumb)+'" alt=""><div class="video-body"><div class="video-title">'+escapeHtml(s.title)+'</div><div class="video-date">'+formatDate(s.publishedAt)+'</div></div>';
    card.onclick=()=>openFullscreenVideo(id,s.title);box.appendChild(card);
  });
}
function openFullscreenVideo(videoId,title){
  $("playerTitle").textContent=title;show("playerView");
  const host=$("playerHost");host.innerHTML="";
  const iframe=document.createElement("iframe");
  iframe.src="https://www.youtube.com/embed/"+encodeURIComponent(videoId)+"?autoplay=1&playsinline=1&rel=0&modestbranding=1&fs=1";
  iframe.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
  iframe.setAttribute("allowfullscreen","");
  iframe.setAttribute("frameborder","0");
  host.appendChild(iframe);
  requestFullscreenNow(host);
}
function requestFullscreenNow(el){
  try{const fn=el.requestFullscreen||el.webkitRequestFullscreen||el.webkitRequestFullScreen||el.msRequestFullscreen;if(fn){const r=fn.call(el);if(r&&r.catch)r.catch(()=>{})}}catch(_){}
}
function closePlayer(){try{if(document.fullscreenElement)document.exitFullscreen()}catch(_){}$("playerHost").innerHTML=""}
function formatDate(v){try{return new Intl.DateTimeFormat("fi-FI",{dateStyle:"medium"}).format(new Date(v))}catch(_){return ""}}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function escapeAttr(s){return escapeHtml(s)}
init();
