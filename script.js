document.addEventListener('DOMContentLoaded', () => { initializeApp(); });
let currentTab = 'video';
let currentTheme = 'light';
let editingContentId = null;
let dragSrcEl = null;
function initializeApp() {
  loadContent();
  updateStats();
  setupEventListeners();
  setTheme(localStorage.getItem('theme') || 'light');
}
function updateStats() {
  let content = getStoredContent();
  let total = content.length;
  let favCount = content.filter(item => item.favorite).length;
  document.getElementById('totalCount').textContent = total;
  document.getElementById('favoriteCount').textContent = favCount;
}
function setupEventListeners() {
  document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
  document.getElementById('menuClose').addEventListener('click', toggleSidebar);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('addContentBtn').addEventListener('click', showModal);
  document.getElementById('cancelAdd').addEventListener('click', hideModal);
  document.getElementById('submitContent').addEventListener('click', addContent);
  document.getElementById('closeDetailBtn').addEventListener('click', closeDetailModal);
  document.getElementById('editContentBtn').addEventListener('click', handleEdit);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { switchTab(e.target.dataset.tab); });
  });
  document.querySelector('.modal-content').addEventListener('submit', (e) => {
    e.preventDefault();
    addContent();
  });
  document.getElementById('searchInput').addEventListener('input', debounce(filterContent, 300));
  document.getElementById('categoryFilter').addEventListener('change', filterContent);
  document.getElementById('sortFilter').addEventListener('change', sortContent);
  document.getElementById('favoriteFilter').addEventListener('change', filterContent);
  document.addEventListener('click', (e) => {
    let card = e.target.closest('.content-card');
    if (card) openDetailModal(card.dataset.id);
  });
}
async function addContent() {
  showLoading();
  try {
    const content = await createContentObject();
    let storedContent = getStoredContent();
    if (editingContentId) {
      const index = storedContent.findIndex(item => item.id === editingContentId);
      if (index !== -1) storedContent[index] = content;
    } else {
      content.id = Date.now();
      storedContent.push(content);
    }
    localStorage.setItem('content', JSON.stringify(storedContent));
    showToast(editingContentId ? 'Content updated!' : 'Content added!');
    await animateContentUpdate();
    hideModal();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    hideLoading();
  }
}
async function createContentObject() {
  const content = {
    id: editingContentId || Date.now(),
    type: currentTab,
    favorite: false,
    createdAt: new Date().toISOString()
  };
  function getValue(id) {
    const el = document.getElementById(id);
    if (!el.value.trim()) throw new Error(id + ' is required');
    return el.value.trim();
  }
  switch (currentTab) {
    case 'video':
      const url = getValue('videoUrl');
      const contentInfo = extractContentId(url);
      if (!contentInfo) throw new Error('Invalid YouTube URL');
      Object.assign(content, {
        ...contentInfo,
        title: getValue('videoTitle'),
        category: getValue('videoCategory')
      });
      break;
    case 'pdf':
      const fileInput = document.getElementById('pdfUpload');
      if (!fileInput.files.length) throw new Error('No PDF file selected');
      const file = fileInput.files[0];
      content.data = await readFileAsDataURL(file);
      content.title = getValue('pdfTitle');
      content.category = getValue('pdfCategory');
      break;
    case 'article':
      Object.assign(content, {
        title: getValue('articleTitle'),
        category: getValue('articleCategory'),
        content: getValue('articleContent')
      });
      break;
  }
  return content;
}
function extractContentId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/,
    /(?:youtube\.com\/playlist\?list=|&list=)([\w-]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return { videoId: match[1], isPlaylist: pattern.source.includes('list=') };
  }
  return null;
}
function loadContent() {
  const container = document.getElementById('contentContainer');
  container.innerHTML = '';
  const items = getFilteredSortedContent();
  items.forEach(item => {
    const card = createContentCard(item);
    container.appendChild(card);
    setupCardInteractions(card);
  });
  updateStats();
}
function createContentCard(item) {
  const card = document.createElement('div');
  card.className = 'content-card';
  card.dataset.id = item.id;
  card.innerHTML = `<i class="${item.favorite ? 'fas' : 'far'} fa-star"></i>
    <h3>${item.title}</h3>
    <p>${item.category} | ${new Date(item.createdAt).toLocaleString()}</p>`;
  return card;
}
function setupCardInteractions(card) {
  card.draggable = true;
  card.addEventListener('dragstart', handleDragStart);
  card.addEventListener('dragover', handleDragOver);
  card.addEventListener('drop', handleDrop);
  const star = card.querySelector('.fa-star');
  star.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(card.dataset.id);
  });
}
function animateElement(element, property, from, to, duration, unit = '', easingFunc) {
  easingFunc = easingFunc || function(t) { return t; };
  return new Promise(resolve => {
    const startTime = performance.now();
    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      element.style[property] = from + (to - from) * easingFunc(progress) + unit;
      if (progress < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}
async function animateContentUpdate() {
  const container = document.getElementById('contentContainer');
  await animateElement(container, 'opacity', 1, 0, 300);
  loadContent();
  await animateElement(container, 'opacity', 0, 1, 300);
}
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('active')) {
    Promise.all([
      animateElement(sidebar, 'opacity', 1, 0, 300),
      animateElement(sidebar, 'transform', 0, -100, 300, '%')
    ]).then(() => {
      sidebar.classList.remove('active');
      sidebar.style.opacity = '1';
    });
  } else {
    sidebar.style.opacity = '0';
    sidebar.classList.add('active');
    Promise.all([
      animateElement(sidebar, 'opacity', 0, 1, 300),
      animateElement(sidebar, 'transform', -100, 0, 300, '%')
    ]);
  }
}
function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(currentTheme);
  document.getElementById('themeToggle').querySelector('i').className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}
async function showModal() {
  const modal = document.getElementById('addModal');
  modal.classList.add('active');
  const content = modal.querySelector('.modal-content');
  content.style.transform = 'scale(0.8)';
  content.style.opacity = '0';
  await Promise.all([
    animateElement(content, 'opacity', 0, 1, 300),
    animateElement(content, 'transform', 0.8, 1, 300)
  ]);
}
async function hideModal() {
  const modal = document.getElementById('addModal');
  const content = modal.querySelector('.modal-content');
  await Promise.all([
    animateElement(content, 'opacity', 1, 0, 300),
    animateElement(content, 'transform', 1, 0.8, 300)
  ]);
  modal.classList.remove('active');
  clearForm();
}
function clearForm() {
  document.querySelectorAll('#addModal input, #addModal textarea, #addModal select').forEach(input => {
    input.value = '';
  });
  editingContentId = null;
  currentTab = 'video';
  switchTab('video');
}
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.dataset.tab === tab);
  });
}
function showLoading() {
  document.getElementById('loadingOverlay').classList.add('active');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('active');
}
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + (isError ? 'error' : 'success');
  toast.style.display = 'block';
  animateElement(toast, 'opacity', 0, 1, 300).then(() => {
    setTimeout(() => {
      animateElement(toast, 'opacity', 1, 0, 300).then(() => {
        toast.style.display = 'none';
      });
    }, 3000);
  });
}
function openDetailModal(id) {
  const item = getStoredContent().find(item => item.id === parseInt(id));
  if (!item) return;
  const detailModal = document.getElementById('detailModal');
  detailModal.dataset.editingId = id;
  detailModal.classList.add('active');
  const content = detailModal.querySelector('.modal-content');
  content.style.transform = 'scale(0.8)';
  content.style.opacity = '0';
  document.getElementById('detailContent').innerHTML = `<h3>${item.title}</h3>
    <p>Category: ${item.category}</p>
    <p>Created: ${new Date(item.createdAt).toLocaleString()}</p>
    ${getContentPreview(item)}`;
  Promise.all([
    animateElement(content, 'opacity', 0, 1, 300),
    animateElement(content, 'transform', 0.8, 1, 300)
  ]);
}
function getContentPreview(item) {
  const previews = {
    video: () => `<iframe src="https://www.youtube.com/embed/${item.videoId}" allowfullscreen></iframe>`,
    pdf: () => `<embed src="${item.data}" type="application/pdf">`,
    article: () => `<div class="article-preview">${item.content}</div>`
  };
  return previews[item.type]();
}
function closeDetailModal() {
  const detailModal = document.getElementById('detailModal');
  const content = detailModal.querySelector('.modal-content');
  animateElement(content, 'opacity', 1, 0, 300).then(() => {
    detailModal.classList.remove('active');
  });
}
function deleteContent(id) {
  let stored = getStoredContent().filter(item => item.id !== parseInt(id));
  localStorage.setItem('content', JSON.stringify(stored));
  showToast('Content deleted');
  loadContent();
  closeDetailModal();
}
function handleEdit() {
  const id = document.getElementById('detailModal').dataset.editingId;
  editContent(id);
}
function editContent(id) {
  let stored = getStoredContent();
  let content = stored.find(item => item.id === parseInt(id));
  if (!content) return;
  editingContentId = content.id;
  switch (content.type) {
    case 'video':
      document.getElementById('videoUrl').value = content.videoId ? 'https://youtu.be/' + content.videoId : '';
      document.getElementById('videoTitle').value = content.title;
      document.getElementById('videoCategory').value = content.category;
      switchTab('video');
      break;
    case 'pdf':
      document.getElementById('pdfTitle').value = content.title;
      document.getElementById('pdfCategory').value = content.category;
      switchTab('pdf');
      break;
    case 'article':
      document.getElementById('articleTitle').value = content.title;
      document.getElementById('articleCategory').value = content.category;
      document.getElementById('articleContent').value = content.content;
      switchTab('article');
      break;
  }
  showModal();
}
function handleDragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.outerHTML);
  this.classList.add('dragging');
}
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function handleDrop(e) {
  e.stopPropagation();
  if (dragSrcEl !== this) {
    this.parentNode.removeChild(dragSrcEl);
    this.insertAdjacentHTML('beforebegin', dragSrcEl.outerHTML);
    updateOrderInLocalStorage();
    loadContent();
  }
}
function updateOrderInLocalStorage() {
  const cards = Array.from(document.querySelectorAll('.content-card'));
  const order = cards.map(card => parseInt(card.dataset.id));
  let stored = getStoredContent().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  localStorage.setItem('content', JSON.stringify(stored));
}
function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}
function getStoredContent() {
  try {
    return JSON.parse(localStorage.getItem('content')) || [];
  } catch {
    return [];
  }
}
function getFilteredSortedContent() {
  let content = getStoredContent();
  return applySort(applyFilters(content));
}
function applyFilters(content) {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  const favorites = document.getElementById('favoriteFilter').checked;
  return content.filter(item => (!search || item.title.toLowerCase().includes(search)) && (!category || item.category === category) && (!favorites || item.favorite));
}
function applySort(content) {
  const sortBy = document.getElementById('sortFilter').value;
  return content.sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    return (b.favorite - a.favorite) || (new Date(b.createdAt) - new Date(a.createdAt));
  });
}
function filterContent() {
  loadContent();
}
function sortContent() {
  loadContent();
}
function toggleFavorite(id) {
  let stored = getStoredContent();
  let index = stored.findIndex(item => item.id === parseInt(id));
  if (index !== -1) {
    stored[index].favorite = !stored[index].favorite;
    localStorage.setItem('content', JSON.stringify(stored));
    loadContent();
  }
}
async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
