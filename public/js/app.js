/**
 * Veyroa Tech & Digital Solutions - POS & Online Catalog
 * Features: Mobile Accessories Cartoon Icons, Custom Categories,
 * Robust Firebase Firestore Cloud Sync (Project: veyora-98f00),
 * Firebase Email & Password Authentication + Security Rules,
 * WhatsApp Direct Orders (+94 77 072 1167), Device Image Uploads.
 */

const WHATSAPP_PHONE = '94770721167'; // Owner's WhatsApp Number
const DEFAULT_ADMIN_PIN = 'veyora2022@ihlas';

// Firebase Project Configuration for Veyroa Tech
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBTmUa0aqsD-gg4YlMqjiqYPuXtYhPd7LA",
  authDomain: "veyora-98f00.firebaseapp.com",
  projectId: "veyora-98f00",
  storageBucket: "veyora-98f00.firebasestorage.app",
  messagingSenderId: "916073293911",
  appId: "1:916073293911:web:157da00969dc9de23f5b12",
  measurementId: "G-N89YPKLPWC"
};

// Initial Default Products (Empty slate for live custom products)
const INITIAL_PRODUCTS = [];

// Base Default Categories (Focused on Mobile Accessories & Tech Services)
const BASE_CATEGORIES = [
  'Mobile Accessories',
  'Chargers & Cables',
  'Power Banks',
  'Audio & Headsets',
  'Cases & Covers',
  'Web & Digital Services'
];

// Updated Cartoon Icons (Focused on Mobile Accessories & Tech)
const PRESET_ICONS = [
  { name: 'Mobile', icon: 'fa-mobile-screen-button' },
  { name: 'Charger', icon: 'fa-plug' },
  { name: 'Power Bank', icon: 'fa-charging-station' },
  { name: 'Battery', icon: 'fa-battery-full' },
  { name: 'SIM Card', icon: 'fa-sim-card' },
  { name: 'SD Card', icon: 'fa-sd-card' },
  { name: 'Audio/Headset', icon: 'fa-headphones' },
  { name: 'Case/Protector', icon: 'fa-box-archive' }
];

// Application State
let products = [];
let cart = [];
let salesHistory = [];
let currentCategory = 'All';
let searchQuery = '';
let isTaxEnabled = false;
let discountLkr = 0;
let isAdminLoggedIn = false;
let currentAdminUser = null;
let db = null; // Firebase Firestore Database Reference

// Helper: Format LKR Currency
function formatLKR(amount) {
  return 'LKR ' + Number(amount || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Get All Unique Categories (Base + Custom)
function getAllCategories() {
  const customCats = products.map(p => p.category).filter(Boolean);
  const combined = Array.from(new Set([...BASE_CATEGORIES, ...customCats]));
  return combined;
}

// Render Dynamic Category Filter Pills in Bar
function renderCategoryPills() {
  const container = document.getElementById('categoryPillsContainer');
  if (!container) return;

  const categories = getAllCategories();
  container.innerHTML = '';

  // "All Products" Pill
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = `filter-pill ${currentCategory === 'All' ? 'active' : ''}`;
  allBtn.onclick = () => setCategory('All');
  allBtn.textContent = 'All Products';
  container.appendChild(allBtn);

  // Category Pills
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `filter-pill ${currentCategory.trim().toLowerCase() === cat.trim().toLowerCase() ? 'active' : ''}`;
    btn.onclick = () => setCategory(cat);

    let iconClass = 'fa-tag text-[#00b894]';
    if (cat === 'Mobile Accessories') iconClass = 'fa-mobile-screen-button text-[#00b894]';
    else if (cat === 'Chargers & Cables') iconClass = 'fa-plug text-amber-600';
    else if (cat === 'Power Banks') iconClass = 'fa-charging-station text-[#059669]';
    else if (cat === 'Audio & Headsets') iconClass = 'fa-headphones text-[#8b5cf6]';
    else if (cat === 'Cases & Covers') iconClass = 'fa-box-archive text-[#0284c7]';
    else if (cat === 'Web & Digital Services') iconClass = 'fa-laptop-code text-indigo-600';

    btn.innerHTML = `<i class="fa-solid ${iconClass} mr-1"></i> ${cat}`;
    container.appendChild(btn);
  });
}

// Populate Category Dropdown in Product Modal
function populateCategoryDropdown(selectedCategory = '') {
  const selectEl = document.getElementById('prodCategoryInput');
  if (!selectEl) return;

  const categories = getAllCategories();
  selectEl.innerHTML = '';

  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (selectedCategory && selectedCategory.trim().toLowerCase() === cat.trim().toLowerCase()) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });

  // Custom Category Option
  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = '+ Add New Custom Category...';
  selectEl.appendChild(customOpt);

  if (selectedCategory && !categories.includes(selectedCategory)) {
    const customExistingOpt = document.createElement('option');
    customExistingOpt.value = selectedCategory;
    customExistingOpt.textContent = selectedCategory;
    customExistingOpt.selected = true;
    selectEl.insertBefore(customExistingOpt, customOpt);
  }

  handleCategorySelectChange(selectEl.value);
}

window.handleCategorySelectChange = function(val) {
  const customContainer = document.getElementById('customCategoryContainer');
  const customInput = document.getElementById('customCategoryInput');

  if (val === '__custom__') {
    if (customContainer) customContainer.classList.remove('hidden');
    if (customInput) {
      customInput.value = '';
      customInput.focus();
    }
  } else {
    if (customContainer) customContainer.classList.add('hidden');
  }
};

// Initialize Local Data & Firebase Firestore Sync
function initData() {
  const storedProds = localStorage.getItem('veyroa_products');
  if (storedProds) {
    try {
      products = JSON.parse(storedProds);
    } catch (e) {
      products = [];
    }
  } else {
    products = [];
  }

  const storedSales = localStorage.getItem('veyroa_sales');
  if (storedSales) {
    try {
      salesHistory = JSON.parse(storedSales);
    } catch (e) {
      salesHistory = [];
    }
  }

  // Initialize Firebase Firestore Cloud Database
  initFirebaseFirestore();
}

function normalizeProduct(docId, data) {
  if (!data) return null;
  return {
    id: docId || data.id || ('prod-' + Date.now()),
    name: (data.name || data.title || data.productName || 'Untitled Product').toString(),
    category: (data.category || data.cat || 'Mobile Accessories').toString().trim(),
    price: parseFloat(data.price || data.cost || data.amount || 0),
    stock: parseInt(data.stock || data.quantity || data.qty || 0),
    description: (data.description || data.desc || data.details || '').toString(),
    image: (data.image || data.imageUrl || data.photo || data.img || '').toString(),
    icon: (data.icon || 'fa-mobile-screen-button').toString(),
    bgGradient: (data.bgGradient || 'from-[#1b1e58] to-[#00b894]').toString()
  };
}

function processFirestoreSnapshot(snapshot) {
  if (!snapshot || snapshot.empty) return false;

  const cloudProducts = [];
  snapshot.forEach(doc => {
    const normalized = normalizeProduct(doc.id, doc.data());
    if (normalized) cloudProducts.push(normalized);
  });

  if (cloudProducts.length > 0) {
    products = cloudProducts;
    saveProductsToStorage();
    renderCategoryPills();
    renderProducts();
    console.log(`⚡ Firestore Live Sync: Loaded ${cloudProducts.length} products!`, cloudProducts);
    return true;
  }
  return false;
}

function initFirebaseFirestore() {
  try {
    if (typeof firebase !== 'undefined') {
      let app = null;

      if (firebase.apps && firebase.apps.length > 0) {
        app = firebase.app();
      } else if (FIREBASE_CONFIG.apiKey) {
        app = firebase.initializeApp(FIREBASE_CONFIG);
      }

      if (app && firebase.firestore) {
        db = firebase.firestore();
        console.log('🔥 Connected to Firebase Firestore for project: veyora-98f00');

        // Enable Firestore Offline Persistence safely
        db.enablePersistence({ synchronizeTabs: true }).catch(err => {
          console.warn('Firestore Persistence Note:', err.code);
        });

        // Set up Firebase Auth State Listener
        if (firebase.auth) {
          firebase.auth().onAuthStateChanged(user => {
            if (user && !user.isAnonymous) {
              isAdminLoggedIn = true;
              currentAdminUser = user;
              console.log('🔒 Firebase Auth Admin Logged In:', user.email);
            } else {
              isAdminLoggedIn = false;
              currentAdminUser = null;
              console.log('🔓 Visitor Mode (Unauthenticated/Anonymous)');
            }
            updateAdminUI();
          });
        }

        // Direct Initial Fetch for Immediate Load (both 'products' and 'Products')
        db.collection('products').get().then(snapshot => {
          if (!processFirestoreSnapshot(snapshot)) {
            db.collection('Products').get().then(snap2 => {
              processFirestoreSnapshot(snap2);
            }).catch(() => {});
          }
        }).catch(err => {
          console.warn('Firestore initial fetch error:', err.message);
        });

        // Real-time Cloud Listener across all devices
        db.collection('products').onSnapshot(snapshot => {
          processFirestoreSnapshot(snapshot);
        }, err => {
          console.warn('Firestore Snapshot Error:', err.message);
        });

        // Secondary Real-time Listener for capital 'Products' fallback
        db.collection('Products').onSnapshot(snapshot => {
          processFirestoreSnapshot(snapshot);
        }, () => {});
      }
    }
  } catch (e) {
    console.warn('Firebase init note:', e.message);
  }
}

function syncProductToFirestore(product) {
  if (db) {
    db.collection('products').doc(product.id).set(product)
      .then(() => {
        console.log('✅ Firestore doc set globally:', product.id);
        showToast('Saved globally to Firestore Cloud!', 'success');
      })
      .catch(err => {
        console.error('❌ Firestore Write Error:', err);
        if (err.code === 'permission-denied') {
          showToast('Firestore Permission Error! Please log in as Admin via Firebase Auth.', 'warning');
        } else {
          showToast('Firestore Error: ' + err.message, 'error');
        }
      });
  } else {
    showToast('Saved locally. (Firebase initializing...)', 'info');
  }
}

function deleteProductFromFirestore(productId) {
  if (db) {
    db.collection('products').doc(productId).delete()
      .then(() => {
        console.log('✅ Firestore doc deleted globally:', productId);
        showToast('Deleted globally from Firestore!', 'info');
      })
      .catch(err => {
        console.error('❌ Firestore Delete Error:', err);
        showToast('Firestore Delete Error: ' + err.message, 'error');
      });
  }
}

function saveProductsToStorage() {
  localStorage.setItem('veyroa_products', JSON.stringify(products));
}

function saveSalesToStorage() {
  localStorage.setItem('veyroa_sales', JSON.stringify(salesHistory));
}

// Admin Mode Controls
window.openAdminModal = function() {
  if (isAdminLoggedIn && currentAdminUser) {
    document.getElementById('adminModalLoggedIn').classList.remove('hidden');
    document.getElementById('adminModalLoginForm').classList.add('hidden');

    const adminEmailDisplay = document.getElementById('adminEmailDisplay');
    if (adminEmailDisplay) {
      adminEmailDisplay.textContent = currentAdminUser.email || 'Admin User';
    }
  } else {
    document.getElementById('adminEmailInput').value = '';
    document.getElementById('adminPasswordInput').value = '';
    document.getElementById('adminModalLoggedIn').classList.add('hidden');
    document.getElementById('adminModalLoginForm').classList.remove('hidden');
  }
  document.getElementById('adminModal').classList.remove('hidden');
};

window.closeAdminModal = function() {
  document.getElementById('adminModal').classList.add('hidden');
};

// Handle Firebase Email/Password Login
window.handleAdminLogin = function(event) {
  event.preventDefault();
  const email = document.getElementById('adminEmailInput').value.trim();
  const password = document.getElementById('adminPasswordInput').value.trim();

  if (!email || !password) {
    showToast('Please enter both Admin Email and Password', 'warning');
    return;
  }

  if (typeof firebase !== 'undefined' && firebase.auth) {
    showToast('Authenticating with Firebase Auth...', 'info');

    firebase.auth().signInWithEmailAndPassword(email, password)
      .then(userCredential => {
        isAdminLoggedIn = true;
        currentAdminUser = userCredential.user;
        showToast(`Welcome Admin (${userCredential.user.email})!`, 'success');
        closeAdminModal();
        updateAdminUI();
      })
      .catch(err => {
        console.error('Firebase Auth Error:', err);
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          showToast('No account found! Please add this user in Firebase Console.', 'error');
        } else if (err.code === 'auth/wrong-password') {
          showToast('Incorrect Password! Please try again.', 'error');
        } else if (err.code === 'auth/invalid-email') {
          showToast('Invalid Email address format.', 'warning');
        } else {
          showToast('Auth Error: ' + err.message, 'error');
        }
      });
  } else {
    showToast('Firebase Auth SDK not initialized', 'error');
  }
};

// Handle Admin Sign Out
window.handleAdminLogout = function() {
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().signOut()
      .then(() => {
        isAdminLoggedIn = false;
        currentAdminUser = null;
        showToast('Signed out of Firebase Admin Mode', 'info');
        closeAdminModal();
        updateAdminUI();
      })
      .catch(err => {
        showToast('Sign out error: ' + err.message, 'error');
      });
  } else {
    isAdminLoggedIn = false;
    currentAdminUser = null;
    closeAdminModal();
    updateAdminUI();
  }
};

function updateAdminUI() {
  const adminBtnText = document.getElementById('adminStatusText');
  const adminIcon = document.getElementById('adminStatusIcon');
  const adminBadge = document.getElementById('adminBadge');
  const resetBtn = document.getElementById('resetCatalogBtn');
  const historyNavBtn = document.getElementById('navBtnHistory');
  const addProductBtn = document.getElementById('addProductBtn');
  const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');

  if (adminBtnText) {
    adminBtnText.textContent = isAdminLoggedIn ? 'Admin (Logged In)' : 'Admin Lock';
  }
  if (adminIcon) {
    adminIcon.className = isAdminLoggedIn ? 'fa-solid fa-user-check text-emerald-400' : 'fa-solid fa-lock text-amber-400';
  }
  if (adminBadge) {
    adminBadge.classList.toggle('hidden', !isAdminLoggedIn);
  }
  if (resetBtn) {
    resetBtn.classList.toggle('hidden', !isAdminLoggedIn);
  }
  if (historyNavBtn) {
    historyNavBtn.classList.toggle('hidden', !isAdminLoggedIn);
    if (!isAdminLoggedIn) {
      switchTab('pos');
    }
  }
  if (addProductBtn) {
    addProductBtn.classList.toggle('hidden', !isAdminLoggedIn);
  }
  if (emptyStateAddBtn) {
    emptyStateAddBtn.classList.toggle('hidden', !isAdminLoggedIn);
  }

  renderCategoryPills();
  renderProducts();
}

// Render Product Catalog Grid
function renderProducts() {
  const grid = document.getElementById('productGrid');
  const emptyState = document.getElementById('emptyState');
  if (!grid) return;

  grid.innerHTML = '';

  const filtered = products.filter(p => {
    const pName = (p.name || p.title || 'Untitled Product').toString().toLowerCase();
    const pDesc = (p.description || p.desc || p.details || '').toString().toLowerCase();
    const pCat = (p.category || 'Mobile Accessories').toString().trim().toLowerCase();
    const sQuery = searchQuery.toLowerCase().trim();

    const matchesCat = (currentCategory === 'All') || (pCat === currentCategory.trim().toLowerCase());
    const matchesSearch = sQuery === '' || pName.includes(sQuery) || pDesc.includes(sQuery) || pCat.includes(sQuery);
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.style.display = 'none';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  grid.style.display = 'grid';

  filtered.forEach(product => {
    const isLongDescription = (product.description || '').length > 40;

    // Check if in cart
    const cartItem = cart.find(item => item.id === product.id);
    const cartQty = cartItem ? cartItem.qty : 0;

    const card = document.createElement('div');
    card.className = 'cartoon-card flex flex-col justify-between p-4 bg-white border-3 border-[#0f172a] rounded-2xl relative transition-all duration-200';

    card.innerHTML = `
      <div>
        <!-- Top Badge & Stock -->
        <div class="flex items-center justify-between mb-3">
          <span class="cartoon-badge bg-slate-100 text-[#1b1e58] border-[#0f172a]">
            <i class="fa-solid ${product.icon || 'fa-mobile-screen-button'} mr-1 text-[#00b894]"></i> ${product.category || 'Mobile Accessories'}
          </span>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full border border-[#0f172a] ${product.stock > 0 ? 'bg-emerald-50 text-[#059669]' : 'bg-rose-50 text-rose-600'}">
            ${product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
          </span>
        </div>

        <!-- Product Image Banner with Instant Fallback -->
        <div class="w-full h-36 rounded-xl overflow-hidden mb-3 border-2 border-[#0f172a] relative group bg-gradient-to-r ${product.bgGradient || 'from-[#1b1e58] to-[#00b894]'} flex items-center justify-center">
          ${product.image ?
            `<img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 absolute inset-0 z-10" onerror="this.style.display='none';" />` :
            ''
          }
          <div class="w-full h-full flex items-center justify-center text-white">
            <i class="fa-solid ${product.icon || 'fa-mobile-screen-button'} text-5xl drop-shadow-md"></i>
          </div>
          <div class="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg border border-[#0f172a] text-[#1b1e58] text-xs font-bold shadow-sm z-20">
            Veyroa Tech
          </div>
        </div>

        <!-- Title & Price -->
        <div class="flex items-start justify-between gap-2 mb-1">
          <h3 class="font-bold text-lg text-[#0f172a] leading-snug group-hover:text-[#00b894] transition-colors">
            ${product.name}
          </h3>
        </div>

        <div class="text-xl font-extrabold text-[#059669] mb-2 font-mono">
          ${formatLKR(product.price)}
        </div>

        <!-- Description + Read More Button -->
        <div class="product-description-container">
          <p id="desc-${product.id}" class="product-description collapsed">
            ${product.description || 'No description provided.'}
          </p>
          ${isLongDescription ? `
            <button onclick="toggleReadMore('${product.id}')" id="btn-desc-${product.id}" class="read-more-btn">
              <span>Read More</span> <i class="fa-solid fa-chevron-down text-xs ml-1"></i>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Action Footer -->
      <div class="pt-3 border-t-2 border-slate-100 flex items-center justify-between gap-2 mt-2">
        ${isAdminLoggedIn ? `
          <div class="flex items-center gap-1">
            <button onclick="editProductModal('${product.id}')" title="Edit Product (Admin)" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-[#00b894] hover:text-white text-slate-700 flex items-center justify-center border border-[#0f172a] transition-colors text-xs font-bold">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button onclick="deleteProduct('${product.id}')" title="Delete Product (Admin)" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-700 flex items-center justify-center border border-[#0f172a] transition-colors text-xs font-bold">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        ` : `
          <div class="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
            <i class="fa-solid fa-check text-emerald-600"></i> Direct Order
          </div>
        `}

        <button
          onclick="addToCart('${product.id}')"
          ${product.stock <= 0 ? 'disabled' : ''}
          class="gradient-btn px-4 py-2 text-sm flex items-center gap-2 ${product.stock <= 0 ? 'opacity-50 cursor-not-allowed shadow-none' : ''}">
          <i class="fa-solid fa-cart-plus"></i>
          <span>${cartQty > 0 ? `Add (${cartQty})` : 'Add to Cart'}</span>
        </button>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Read More / Read Less Description Toggle
window.toggleReadMore = function(productId) {
  const descEl = document.getElementById(`desc-${productId}`);
  const btnEl = document.getElementById(`btn-desc-${productId}`);
  if (!descEl || !btnEl) return;

  if (descEl.classList.contains('collapsed')) {
    descEl.classList.remove('collapsed');
    descEl.classList.add('expanded');
    btnEl.innerHTML = `<span>Read Less</span> <i class="fa-solid fa-chevron-up text-xs ml-1"></i>`;
  } else {
    descEl.classList.remove('expanded');
    descEl.classList.add('collapsed');
    btnEl.innerHTML = `<span>Read More</span> <i class="fa-solid fa-chevron-down text-xs ml-1"></i>`;
  }
};

// Cart Logic
window.addToCart = function(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (product.stock <= 0) {
    showToast('Product is out of stock!', 'error');
    return;
  }

  const existing = cart.find(item => item.id === productId);
  if (existing) {
    if (existing.qty >= product.stock) {
      showToast(`Cannot add more. Only ${product.stock} items available.`, 'warning');
      return;
    }
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      qty: 1,
      category: product.category,
      icon: product.icon || 'fa-mobile-screen-button',
      maxStock: product.stock
    });
  }

  showToast(`Added "${product.name}" to cart`, 'success');
  renderCart();
  renderProducts();
};

window.updateCartQty = function(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  const product = products.find(p => p.id === productId);
  const maxStock = product ? product.stock : item.maxStock;

  const newQty = item.qty + delta;
  if (newQty <= 0) {
    removeFromCart(productId);
    return;
  }

  if (newQty > maxStock) {
    showToast(`Maximum available is ${maxStock}`, 'warning');
    return;
  }

  item.qty = newQty;
  renderCart();
  renderProducts();
};

window.removeFromCart = function(productId) {
  cart = cart.filter(i => i.id !== productId);
  renderCart();
  renderProducts();
};

window.clearCart = function() {
  if (cart.length === 0) return;
  cart = [];
  discountLkr = 0;
  renderCart();
  renderProducts();
  showToast('Cart cleared', 'info');
};

// Calculate Cart Totals
function getCartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const taxAmount = isTaxEnabled ? subtotal * 0.08 : 0; // 8% tax
  const discountedSubtotal = Math.max(0, subtotal - discountLkr);
  const total = discountedSubtotal + taxAmount;

  return { subtotal, taxAmount, discountedSubtotal, total };
}

// Render Cart Panel
function renderCart() {
  const cartContainer = document.getElementById('cartItems');
  const cartBadge = document.getElementById('cartBadge');
  const cartCountNav = document.getElementById('cartCountNav');

  const subtotalEl = document.getElementById('cartSubtotal');
  const taxEl = document.getElementById('cartTax');
  const totalEl = document.getElementById('cartTotal');

  if (!cartContainer) return;

  const totalItemsCount = cart.reduce((acc, item) => acc + item.qty, 0);
  if (cartBadge) {
    cartBadge.textContent = totalItemsCount;
    cartBadge.classList.toggle('hidden', totalItemsCount === 0);
  }
  if (cartCountNav) {
    cartCountNav.textContent = totalItemsCount;
  }

  cartContainer.innerHTML = '';

  if (cart.length === 0) {
    cartContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-center text-slate-500">
        <div class="w-16 h-16 rounded-2xl bg-[#f8fafc] border-2 border-dashed border-[#0f172a] flex items-center justify-center text-[#00b894] mb-3 text-2xl float-animation">
          <i class="fa-solid fa-basket-shopping"></i>
        </div>
        <p class="font-bold text-[#0f172a]">Your cart is currently empty</p>
        <p class="text-xs text-slate-500 mt-1 max-w-[200px]">Click "+ Add to Cart" on any product to build an order.</p>
      </div>
    `;
  } else {
    cart.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'flex items-center justify-between p-3 bg-[#f8fafc] border-2 border-[#0f172a] rounded-xl mb-2 animate-pop text-slate-800';

      itemEl.innerHTML = `
        <div class="flex-1 pr-2">
          <div class="flex items-center gap-2">
            <i class="fa-solid ${item.icon} text-[#00b894] text-xs"></i>
            <h4 class="font-bold text-sm text-[#0f172a] line-clamp-1">${item.name}</h4>
          </div>
          <div class="text-xs text-slate-600 font-mono mt-0.5">
            ${formatLKR(item.price)} x ${item.qty} = <span class="font-bold text-[#059669]">${formatLKR(item.price * item.qty)}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div class="flex items-center bg-white rounded-lg p-1 border border-[#0f172a] gap-1">
            <button onclick="updateCartQty('${item.id}', -1)" class="qty-btn text-xs">-</button>
            <span class="font-bold text-sm px-1.5 min-w-[20px] text-center text-[#0f172a]">${item.qty}</span>
            <button onclick="updateCartQty('${item.id}', 1)" class="qty-btn text-xs">+</button>
          </div>
          <button onclick="removeFromCart('${item.id}')" class="text-slate-400 hover:text-rose-600 p-1 text-xs">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
      `;
      cartContainer.appendChild(itemEl);
    });
  }

  // Update Summary
  const { subtotal, taxAmount, total } = getCartTotals();

  if (subtotalEl) subtotalEl.textContent = formatLKR(subtotal);
  if (taxEl) taxEl.textContent = formatLKR(taxAmount);
  if (totalEl) totalEl.textContent = formatLKR(total);

  const btnWhatsApp = document.getElementById('btnWhatsAppCheckout');
  if (btnWhatsApp) btnWhatsApp.disabled = cart.length === 0;

  // Update Mobile Sticky Bottom Order Bar
  const mobileBar = document.getElementById('mobileBottomBar');
  const mobileBadge = document.getElementById('mobileBarBadge');
  const mobileTotal = document.getElementById('mobileBarTotal');

  if (mobileBar) {
    mobileBar.classList.toggle('hidden', totalItemsCount === 0);
  }
  if (mobileBadge) {
    mobileBadge.textContent = totalItemsCount;
  }
  if (mobileTotal) {
    mobileTotal.textContent = formatLKR(total);
  }
}

window.scrollToCart = function() {
  const cartPanel = document.getElementById('cartPanel');
  if (cartPanel) {
    cartPanel.scrollIntoView({ behavior: 'smooth' });
  }
};

// Direct WhatsApp Ordering Function
window.sendWhatsAppOrder = function(customItems = null) {
  const itemsToOrder = customItems || cart;
  if (!itemsToOrder || itemsToOrder.length === 0) {
    showToast('Your cart is empty! Add products first.', 'warning');
    return;
  }

  const { subtotal, taxAmount, total } = getCartTotals();
  const orderId = 'VYR-WA-' + Math.floor(100000 + Math.random() * 900000);

  // Construct Structured Text Message for WhatsApp
  let message = `*NEW ORDER - VEYROA TECH & DIGITAL SOLUTIONS*\n`;
  message += `Order Reference: *#${orderId}*\n`;
  message += `Date: ${new Date().toLocaleString('en-LK')}\n`;
  message += `-------------------------------------------\n\n`;
  message += `📋 *ORDERED PRODUCTS*:\n`;

  itemsToOrder.forEach((item, index) => {
    message += `${index + 1}. *${item.name}*\n`;
    message += `   • Quantity: ${item.qty}\n`;
    message += `   • Price: ${formatLKR(item.price)} each\n`;
    message += `   • Item Subtotal: ${formatLKR(item.price * item.qty)}\n\n`;
  });

  message += `-------------------------------------------\n`;
  message += `💵 *Subtotal*: ${formatLKR(subtotal)}\n`;
  if (taxAmount > 0) {
    message += `🏛️ *Tax (8%)*: ${formatLKR(taxAmount)}\n`;
  }
  message += `💰 *TOTAL AMOUNT*: *${formatLKR(total)}*\n`;
  message += `-------------------------------------------\n`;
  message += `💳 *Payment Method*: Direct Bank Transfer / WhatsApp Negotiation\n\n`;
  message += `Hello Veyroa Tech! Please share your bank details so I can transfer ${formatLKR(total)} for this order. Thank you!`;

  // Encode URL
  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;

  // Save to sales history as WhatsApp order
  const saleRecord = {
    id: orderId,
    date: new Date().toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' }),
    timestamp: Date.now(),
    items: [...itemsToOrder],
    subtotal,
    taxAmount,
    total,
    paymentMethod: 'WhatsApp Direct',
    cashReceived: total,
    change: 0
  };

  // Deduct Stock
  itemsToOrder.forEach(cartItem => {
    const prod = products.find(p => p.id === cartItem.id);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - cartItem.qty);
      syncProductToFirestore(prod);
    }
  });

  saveProductsToStorage();
  salesHistory.unshift(saleRecord);
  saveSalesToStorage();

  // Clear Cart
  cart = [];
  renderCart();
  renderProducts();
  renderSalesHistory();

  // Open WhatsApp in new tab
  window.open(whatsappUrl, '_blank');
  showToast('Redirecting to WhatsApp to send order...', 'success');
};

// Category Filter Handling
window.setCategory = function(cat) {
  currentCategory = cat;
  renderCategoryPills();
  renderProducts();
};

// Search Filter Handling
window.handleSearch = function(query) {
  searchQuery = query;
  renderProducts();
};

// Add / Edit Product Modal Handlers & File Upload with Canvas Optimization
window.handleImageFileUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  showToast('Optimizing image...', 'info');

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Compress and resize image (max 600px) for fast Firestore cloud sync
      const canvas = document.createElement('canvas');
      const maxDim = 600;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
      document.getElementById('prodImageInput').value = compressedBase64;

      const previewContainer = document.getElementById('imagePreviewContainer');
      const previewThumb = document.getElementById('imagePreviewThumb');
      if (previewContainer && previewThumb) {
        previewThumb.src = compressedBase64;
        previewContainer.classList.remove('hidden');
      }
      showToast('Image optimized & ready for cloud sync!', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.clearImageUpload = function() {
  document.getElementById('prodImageInput').value = '';
  const fileInput = document.getElementById('prodFileInput');
  if (fileInput) fileInput.value = '';

  const previewContainer = document.getElementById('imagePreviewContainer');
  if (previewContainer) previewContainer.classList.add('hidden');
};

window.openAddProductModal = function() {
  if (!isAdminLoggedIn) {
    openAdminModal();
    showToast('Admin login required to add or edit products', 'warning');
    return;
  }

  document.getElementById('modalTitle').textContent = 'Add New Product';
  document.getElementById('productIdInput').value = '';
  document.getElementById('prodNameInput').value = '';
  document.getElementById('prodPriceInput').value = '';
  document.getElementById('prodStockInput').value = '10';
  document.getElementById('prodDescInput').value = '';
  document.getElementById('selectedIconInput').value = 'fa-mobile-screen-button';

  populateCategoryDropdown('Mobile Accessories');
  clearImageUpload();
  renderIconPicker('fa-mobile-screen-button');
  document.getElementById('productModal').classList.remove('hidden');
};

window.editProductModal = function(id) {
  if (!isAdminLoggedIn) {
    openAdminModal();
    return;
  }

  const p = products.find(prod => prod.id === id);
  if (!p) return;

  document.getElementById('modalTitle').textContent = 'Edit Product';
  document.getElementById('productIdInput').value = p.id;
  document.getElementById('prodNameInput').value = p.name;
  document.getElementById('prodPriceInput').value = p.price;
  document.getElementById('prodStockInput').value = p.stock;
  document.getElementById('prodDescInput').value = p.description;
  document.getElementById('prodImageInput').value = p.image || '';
  document.getElementById('selectedIconInput').value = p.icon || 'fa-mobile-screen-button';

  populateCategoryDropdown(p.category || 'Mobile Accessories');

  const previewContainer = document.getElementById('imagePreviewContainer');
  const previewThumb = document.getElementById('imagePreviewThumb');
  if (p.image && previewContainer && previewThumb) {
    previewThumb.src = p.image;
    previewContainer.classList.remove('hidden');
  } else {
    clearImageUpload();
  }

  renderIconPicker(p.icon || 'fa-mobile-screen-button');
  document.getElementById('productModal').classList.remove('hidden');
};

window.closeProductModal = function() {
  document.getElementById('productModal').classList.add('hidden');
};

function renderIconPicker(selectedIcon) {
  const container = document.getElementById('iconPickerGrid');
  if (!container) return;

  container.innerHTML = '';
  PRESET_ICONS.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `p-2 rounded-xl border-2 flex flex-col items-center justify-center text-xs gap-1 transition-all ${
      selectedIcon === item.icon ? 'border-[#00b894] bg-emerald-50 text-[#059669] font-bold scale-105 shadow-sm' : 'border-[#0f172a] bg-[#f8fafc] text-slate-700 hover:border-[#00b894]'
    }`;
    btn.onclick = () => {
      document.getElementById('selectedIconInput').value = item.icon;
      renderIconPicker(item.icon);
    };
    btn.innerHTML = `<i class="fa-solid ${item.icon} text-lg text-[#00b894]"></i><span>${item.name}</span>`;
    container.appendChild(btn);
  });
}

// Save Product Form Submission
window.handleSaveProduct = function(event) {
  event.preventDefault();
  if (!isAdminLoggedIn) {
    showToast('Admin login required to save products', 'error');
    return;
  }

  const id = document.getElementById('productIdInput').value;
  const name = document.getElementById('prodNameInput').value.trim();

  // Category Selection (Base dropdown vs Custom category)
  const catSelectVal = document.getElementById('prodCategoryInput').value;
  let category = catSelectVal;
  if (catSelectVal === '__custom__') {
    const customInputVal = document.getElementById('customCategoryInput').value.trim();
    category = customInputVal || 'Mobile Accessories';
  }

  const price = parseFloat(document.getElementById('prodPriceInput').value) || 0;
  const stock = parseInt(document.getElementById('prodStockInput').value) || 0;
  const description = document.getElementById('prodDescInput').value.trim();
  const image = document.getElementById('prodImageInput').value.trim();
  const icon = document.getElementById('selectedIconInput').value || 'fa-mobile-screen-button';

  if (!name || price <= 0 || !description) {
    showToast('Please fill in product name, valid price, and description', 'warning');
    return;
  }

  let updatedProduct = null;

  if (id) {
    // Edit existing
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      updatedProduct = {
        ...products[index],
        name,
        category,
        price,
        stock,
        description,
        image,
        icon
      };
      products[index] = updatedProduct;
      showToast('Product updated!', 'success');
    }
  } else {
    // Create new
    updatedProduct = {
      id: 'prod-' + Date.now(),
      name,
      category,
      price,
      stock,
      description,
      image,
      icon,
      bgGradient: 'from-[#1b1e58] to-[#00b894]'
    };
    products.unshift(updatedProduct);
    showToast('New product added!', 'success');
  }

  if (updatedProduct) {
    syncProductToFirestore(updatedProduct);
  }

  saveProductsToStorage();
  renderCategoryPills();
  renderProducts();
  closeProductModal();
};

window.deleteProduct = function(id) {
  if (!isAdminLoggedIn) {
    openAdminModal();
    return;
  }

  const prod = products.find(p => p.id === id);
  if (!prod) return;

  if (confirm(`Are you sure you want to delete "${prod.name}"?`)) {
    products = products.filter(p => p.id !== id);
    cart = cart.filter(c => c.id !== id);

    deleteProductFromFirestore(id);
    saveProductsToStorage();
    renderCategoryPills();
    renderProducts();
    renderCart();
    showToast('Product deleted', 'info');
  }
};

window.resetProductsToDefault = function() {
  if (!isAdminLoggedIn) {
    openAdminModal();
    return;
  }

  if (confirm('Clear all products from the store catalog?')) {
    if (db) {
      products.forEach(p => deleteProductFromFirestore(p.id));
    }
    products = [];
    saveProductsToStorage();
    renderCategoryPills();
    renderProducts();
    showToast('Catalog cleared!', 'info');
  }
};

window.toggleTax = function() {
  isTaxEnabled = !isTaxEnabled;
  const taxToggleBtn = document.getElementById('taxToggleBtn');
  if (taxToggleBtn) {
    taxToggleBtn.classList.toggle('bg-cyan-500', isTaxEnabled);
    taxToggleBtn.classList.toggle('text-black', isTaxEnabled);
    taxToggleBtn.classList.toggle('bg-[#232757]', !isTaxEnabled);
  }
  renderCart();
};

// Sales History & Analytics
function renderSalesHistory() {
  const historyList = document.getElementById('salesHistoryList');
  const totalRevenueEl = document.getElementById('totalRevenueVal');
  const totalOrdersEl = document.getElementById('totalOrdersVal');

  if (!historyList) return;

  const totalRev = salesHistory.reduce((sum, s) => sum + s.total, 0);
  if (totalRevenueEl) totalRevenueEl.textContent = formatLKR(totalRev);
  if (totalOrdersEl) totalOrdersEl.textContent = salesHistory.length;

  historyList.innerHTML = '';

  if (salesHistory.length === 0) {
    historyList.innerHTML = `<div class="p-6 text-center text-slate-500">No WhatsApp orders recorded yet.</div>`;
    return;
  }

  salesHistory.slice(0, 15).forEach(sale => {
    const div = document.createElement('div');
    div.className = 'p-3 bg-[#f8fafc] border-2 border-[#0f172a] rounded-xl flex items-center justify-between text-xs text-slate-800';
    div.innerHTML = `
      <div>
        <div class="font-bold text-[#0f172a] flex items-center gap-2">
          <span>${sale.id}</span>
          <span class="px-1.5 py-0.5 rounded bg-emerald-100 text-[#059669] text-[10px] border border-[#00b894] font-bold">WhatsApp Order</span>
        </div>
        <div class="text-slate-500 text-[10px] mt-0.5">${sale.date} • ${sale.items.length} items</div>
      </div>
      <div class="text-right font-mono font-bold text-[#059669] text-sm">
        ${formatLKR(sale.total)}
      </div>
    `;
    historyList.appendChild(div);
  });
}

// Simple Toast Notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    success: 'bg-[#059669] text-white border-[#0f172a]',
    error: 'bg-rose-600 text-white border-[#0f172a]',
    warning: 'bg-amber-500 text-black border-[#0f172a]',
    info: 'bg-[#1b1e58] text-white border-[#0f172a]'
  };

  toast.className = `px-4 py-2.5 rounded-xl border-2 font-bold text-sm shadow-lg flex items-center gap-2 animate-pop ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Navigation Tabs Handling (Store Front vs Sales History)
window.switchTab = function(tabName) {
  const posTab = document.getElementById('tabPosView');
  const historyTab = document.getElementById('tabHistoryView');
  const btnPos = document.getElementById('navBtnPos');
  const btnHistory = document.getElementById('navBtnHistory');

  if (tabName === 'pos') {
    if (posTab) posTab.classList.remove('hidden');
    if (historyTab) historyTab.classList.add('hidden');
    if (btnPos) {
      btnPos.classList.add('bg-[#1b1e58]', 'text-white', 'border-[#0f172a]');
      btnPos.classList.remove('text-slate-700');
    }
    if (btnHistory) {
      btnHistory.classList.remove('bg-[#1b1e58]', 'text-white', 'border-[#0f172a]');
      btnHistory.classList.add('text-slate-700');
    }
  } else if (tabName === 'history') {
    if (posTab) posTab.classList.add('hidden');
    if (historyTab) historyTab.classList.remove('hidden');
    if (btnHistory) {
      btnHistory.classList.add('bg-[#1b1e58]', 'text-white', 'border-[#0f172a]');
      btnHistory.classList.remove('text-slate-700');
    }
    if (btnPos) {
      btnPos.classList.remove('bg-[#1b1e58]', 'text-white', 'border-[#0f172a]');
      btnPos.classList.add('text-slate-700');
    }
    renderSalesHistory();
  }
};

// Initialize Application on Page Load
document.addEventListener('DOMContentLoaded', () => {
  initData();
  renderCategoryPills();
  renderProducts();
  renderCart();
  renderSalesHistory();
  updateAdminUI();
});
