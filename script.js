let currentTab = 'video';

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeIcon = document.getElementById('themeIcon');
  if (savedTheme === 'dark') {
    themeIcon.classList.remove('fa-moon');
    themeIcon.classList.add('fa-sun');
  } else {
    themeIcon.classList.remove('fa-sun');
    themeIcon.classList.add('fa-moon');
  }
  loadContent();
});

function showModal() {
  document.getElementById('addModal').style.display = 'block';
}

function hideModal() {
  document.getElementById('addModal').style.display = 'none';
}

function switchTab(tab) {
  currentTab = tab;
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.classList.remove('active-tab');
    if (btn.textContent.toLowerCase() === tab) {
      btn.classList.add('active-tab');
    }
  });
  document.getElementById('videoForm').style.display = (tab === 'video') ? 'block' : 'none';
  document.getElementById('pdfForm').style.display = (tab === 'pdf') ? 'block' : 'none';
}

function isPlaylist(url) {
  return url.includes('list=') && !url.includes('watch?v=');
}

function extractContentId(url) {
  if (isPlaylist(url)) {
    const playlistRegex = /[?&]list=([^&]+)/i;
    const match = url.match(playlistRegex);
    return match ? { type: 'playlist', id: match[1] } : null;
  } else {
    const videoRegex = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(videoRegex);
    return match && match[2].length === 11 ? { type: 'video', id: match[2] } : null;
  }
}

function addContent() {
  if (currentTab === 'video') {
    const urlInput = document.getElementById('contentUrl');
    const titleInput = document.getElementById('contentTitle');
    const url = urlInput.value.trim();
    const title = titleInput.value.trim() || 'Untitled Video';
    if (!url) {
      alert('Please enter a YouTube URL or Playlist.');
      return;
    }
    const contentInfo = extractContentId(url);
    if (!contentInfo) {
      alert('Invalid YouTube URL or Playlist.');
      return;
    }
    let content = JSON.parse(localStorage.getItem('learningContent')) || [];
    content.push({ ...contentInfo, title: title });
    localStorage.setItem('learningContent', JSON.stringify(content));
    animateContentUpdate().then(() => { loadContent(); });
    hideModal();
    urlInput.value = '';
    titleInput.value = '';
  } else if (currentTab === 'pdf') {
    const fileInput = document.getElementById('pdfUpload');
    if (fileInput.files.length === 0) {
      alert('Please select a PDF file.');
      return;
    }
    const file = fileInput.files[0];
    const titleInput = document.getElementById('pdfTitle');
    const title = titleInput.value.trim() || file.name || 'Untitled PDF';
    const blobURL = URL.createObjectURL(file);
    let content = JSON.parse(localStorage.getItem('learningContent')) || [];
    content.push({ type: 'pdf', data: blobURL, title: title });
    localStorage.setItem('learningContent', JSON.stringify(content));
    animateContentUpdate().then(() => { loadContent(); });
    hideModal();
    fileInput.value = '';
    titleInput.value = '';
  }
}

function animateContentUpdate() {
  return new Promise(resolve => {
    const container = document.getElementById('contentContainer');
    container.style.transition = "opacity 0.5s ease-out";
    container.style.opacity = 0;
    setTimeout(() => { resolve(); }, 500);
  });
}

function removeContent(index) {
  const cards = document.querySelectorAll('.content-card');
  if (cards[index]) {
    const cardToRemove = cards[index];
    cardToRemove.classList.add('removing');
    cardToRemove.addEventListener('animationend', () => {
      let content = JSON.parse(localStorage.getItem('learningContent')) || [];
      if (index >= 0 && index < content.length) {
        if (content[index].type === 'pdf') {
          URL.revokeObjectURL(content[index].data);
        }
        content.splice(index, 1);
        localStorage.setItem('learningContent', JSON.stringify(content));
        loadContent();
      }
    });
  }
}

function loadContent() {
  const container = document.getElementById('contentContainer');
  container.style.opacity = 0;
  setTimeout(() => {
    container.innerHTML = '';
    let content = JSON.parse(localStorage.getItem('learningContent')) || [];
    content.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'content-card';
      let contentHTML = '';
      if (item.type === 'pdf') {
        contentHTML = `<embed class="pdf-viewer" src="${item.data}#toolbar=0" type="application/pdf">`;
        card.innerHTML = `
          ${contentHTML}
          <button class="preview-fullscreen-btn" onclick="previewPDFFullscreen('${item.data}')">Full Screen</button>
          <button class="remove-btn" onclick="removeContent(${index})">×</button>
          <div class="content-title">${item.title}</div>
        `;
      } else {
        const embedParams = new URLSearchParams({
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          disablekb: 1,
          controls: 1,
          iv_load_policy: 3,
          origin: window.location.origin
        });
        const paramsString = embedParams.toString();
        const embedUrl = (item.type === 'playlist')
          ? `https://www.youtube-nocookie.com/embed/videoseries?list=${item.id}&${paramsString}`
          : `https://www.youtube-nocookie.com/embed/${item.id}?${paramsString}`;
        contentHTML = `
          ${item.type === 'playlist' ? '<div class="playlist-label">Playlist</div>' : ''}
          <iframe class="video-player" 
                  src="${embedUrl}" 
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
                  allowfullscreen></iframe>
        `;
        card.innerHTML = `
          ${contentHTML}
          <button class="remove-btn" onclick="removeContent(${index})">×</button>
          <div class="content-title">${item.title}</div>
        `;
      }
      container.appendChild(card);
      if (item.type === 'pdf') {
        const pdfViewer = card.querySelector('.pdf-viewer');
        if (pdfViewer) {
          pdfViewer.style.cursor = 'pointer';
          pdfViewer.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement) {
              pdfViewer.requestFullscreen().catch(err => {
                console.error(`Error enabling full-screen mode: ${err.message} (${err.name})`);
              });
            } else {
              document.exitFullscreen();
            }
          });
        }
      }
    });
    container.style.transition = "opacity 0.5s ease-in";
    container.style.opacity = 1;
  }, 500);
}

function toggleTheme() {
  let currentTheme = localStorage.getItem('theme') || 'light';
  let newTheme = currentTheme === 'light' ? 'dark' : 'light';
  const themeIcon = document.getElementById('themeIcon');
  themeIcon.classList.add('theme-toggle-anim');
  setTimeout(() => {
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      themeIcon.classList.remove('fa-moon');
      themeIcon.classList.add('fa-sun');
    } else {
      themeIcon.classList.remove('fa-sun');
      themeIcon.classList.add('fa-moon');
    }
    themeIcon.classList.remove('theme-toggle-anim');
  }, 600);
}

function previewPDFFullscreen(pdfData) {
  const modal = document.getElementById('pdfFullscreenModal');
  const embed = document.getElementById('fullscreenPDFEmbed');
  embed.src = pdfData;
  modal.style.display = 'block';
  modal.requestFullscreen().catch(err => {
    console.error("Error entering full-screen mode:", err);
  });
}

function closePDFFullscreen() {
  const modal = document.getElementById('pdfFullscreenModal');
  modal.style.display = 'none';
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
}
