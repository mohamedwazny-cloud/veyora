/**
 * Veyroa Tech & Digital Solutions - POS & Online Catalog
 * Features: Automatic Firebase Firestore Cloud Sync (Project: veyora-98f00),
 * WhatsApp Direct Orders (+94 77 072 1167), Admin Security Mode,
 * Product Catalog with LKR Currency & Device Image Uploads.
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

// Preset Cartoon Icons for Custom New Product Addition
const PRESET_ICONS = [
  { name: 'Code', icon: 'fa-code' },
  { name: 'Laptop', icon: 'fa-laptop' },
  { name: 'Robot', icon: 'fa-robot' },
  { name: 'Gamepad', icon: 'fa-gamepad' },
  { name: 'Paintbrush', icon: 'fa-paintbrush' },
  { name: 'Server', icon: 'fa-server' },
  { name: 'Microchip', icon: 'fa-microchip' },
  { name: 'Lightbulb', icon: 'fa-lightbulb' },
  { name: 'Shield', icon: 'fa-shield-halved' },
  { name: 'Rocket', icon: 'fa-rocket' },
  { name: 'Wrench', icon: 'fa-wrench' },
  { name: 'Headphones', icon: 'fa-headphones' }
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
let adminPin = DEFAULT_ADMIN_PIN;
let db = null; // Firebase Firestore Database Reference

// Helper: Format LKR Currency
function formatLKR(amount) {
  return 'LKR ' + Number(amount).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Initialize Local Data & Firebase Firestore Sync
function initData() {
  const storedProds = localStorage.getItem('veyroa_products');
  if (storedProds) {
    try {
      const parsed = JSON.parse(storedProds);
      // Purge legacy sample placeholder items (prod-1 through prod-8)
      products = parsed.filter(p => !/^prod-[1-8]$/.test(p.id));
      saveProductsToStorage();
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

  const storedPin = localStorage.getItem('veyroa_admin_pin');
  if (storedPin) {
    adminPin = storedPin;
  }

  // Initialize Firebase Firestore Cloud Database
  initFirebaseFirestore();
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

        if (firebase.auth) {
          firebase.auth().signInAnonymously().catch(err => console.warn('Auth note:', err.message));
        }

        // Real-time Cloud Listener (Filter & delete legacy placeholders if present in cloud)
        db.collection('products').onSnapshot(snapshot => {
          if (!snapshot.empty) {
            const cloudProducts = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              const docId = doc.id;
              // Clean up legacy placeholders from Firestore
              if (/^prod-[1-8]$/.test(docId)) {
                db.collection('products').doc(docId).delete().catch(() => {});
              } else {
                cloudProducts.push({ id: docId, ...data });
              }
            });
            products = cloudProducts;
            saveProductsToStorage();
            renderProducts();
            console.log(`⚡ Firestore Live Sync: ${cloudProducts.length} custom products loaded!`);
          } else {
            products = [];
            saveProductsToStorage();
            renderProducts();
          }
        }, err => {
          console.warn('Firestore Snapshot Error:', err.message);
        });
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
          showToast('Firestore Permission Error! Enable "allow read, write: if true;" in Firebase Console.', 'warning');
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

window.saveFirebaseConfigKey = function(event) {
  event.preventDefault();
  const apiKey = document.getElementById('firebaseApiKeyInput').value.trim();
  if (!apiKey) {
    showToast('Please enter your Firebase Web API Key', 'warning');
    return;
  }

  localStorage.setItem('veyroa_firebase_apikey', apiKey);
  showToast('Firebase API Key saved! Connecting to Firestore...', 'success');
  initFirebaseFirestore();
  closeAdminModal();
};

function saveProductsToStorage() {
  localStorage.setItem('veyroa_products', JSON.stringify(products));
}

function saveSalesToStorage() {
  localStorage.setItem('veyroa_sales', JSON.stringify(salesHistory));
}

window.exportProductsJSON = function() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "products.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Downloaded products.json catalog file!', 'success');
};

// Admin Mode Controls
window.openAdminModal = function() {
  if (isAdminLoggedIn) {
    document.getElementById('adminModalLoggedIn').classList.remove('hidden');
    document.getElementById('adminModalLoginForm').classList.add('hidden');

    const apiKey = localStorage.getItem('veyroa_firebase_apikey') || '';
    if (document.getElementById('firebaseApiKeyInput')) {
      document.getElementById('firebaseApiKeyInput').value = apiKey;
    }
  } else {
    document.getElementById('adminPinInput').value = '';
    document.getElementById('adminModalLoggedIn').classList.add('hidden');
    document.getElementById('adminModalLoginForm').classList.remove('hidden');
  }
  document.getElementById('adminModal').classList.remove('hidden');
};

window.closeAdminModal = function() {
  document.getElementById('adminModal').classList.add('hidden');
};

window.handleAdminLogin = function(event) {
  event.preventDefault();
  const pinEntered = document.getElementById('adminPinInput').value.trim();

  if (pinEntered === adminPin) {
    isAdminLoggedIn = true;
    showToast('Admin Mode Unlocked!', 'success');
    closeAdminModal();
    updateAdminUI();
  } else {
    showToast('Incorrect Admin Password.', 'error');
  }
};

window.handleAdminLogout = function() {
  isAdminLoggedIn = false;
  showToast('Logged out of Admin Mode', 'info');
  closeAdminModal();
  updateAdminUI();
};

window.handleChangeAdminPin = function() {
  const newPin = prompt('Enter new Admin Password:');
  if (newPin && newPin.trim().length >= 4) {
    adminPin = newPin.trim();
    localStorage.setItem('veyroa_admin_pin', adminPin);
    showToast('Admin Password updated successfully!', 'success');
    closeAdminModal();
  } else if (newPin) {
    showToast('Password must be at least 4 characters', 'warning');
  }
};

function updateAdminUI() {
  const adminBtnText = document.getElementById('adminStatusText');
  const adminIcon = document.getElementById('adminStatusIcon');
  const adminBadge = document.getElementById('adminBadge');
  const resetBtn = document.getElementById('resetCatalogBtn');
  const historyNavBtn = document.getElementById('navBtnHistory');
  const addProductBtn = document.getElementById('addProductBtn');

  if (adminBtnText) {
    adminBtnText.textContent = isAdminLoggedIn ? 'Admin (Unlocked)' : 'Admin Lock';
  }
  if (adminIcon) {
    adminIcon.className = isAdminLoggedIn ? 'fa-solid fa-lock-open text-emerald-400' : 'fa-solid fa-lock text-amber-400';
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

  renderProducts();
}

// Render Product Catalog Grid
function renderProducts() {
  const grid = document.getElementById('productGrid');
  const emptyState = document.getElementById('emptyState');
  if (!grid) return;

  grid.innerHTML = '';

  const filtered = products.filter(p => {
    const matchesCat = (currentCategory === 'All') || (p.category === currentCategory);
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
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
    const isLongDescription = product.description.length > 75;

    // Check if in cart
    const cartItem = cart.find(item => item.id === product.id);
    const cartQty = cartItem ? cartItem.qty : 0;

    const card = document.createElement('div');
    card.className = 'cartoon-card flex flex-col justify-between p-4 bg-[#1e2246] border-3 border-[#2f366b] rounded-2xl relative transition-all duration-200';

    card.innerHTML = `
      <div>
        <!-- Top Badge & Stock -->
        <div class="flex items-center justify-between mb-3">
          <span class="cartoon-badge bg-[#232757] text-[#00e5ff] border-black">
            <i class="fa-solid ${product.icon || 'fa-box'} mr-1"></i> ${product.category}
          </span>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full border border-black ${product.stock > 0 ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'}">
            ${product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
          </span>
        </div>

        <!-- Product Image or Cartoon Banner -->
        <div class="w-full h-36 rounded-xl overflow-hidden mb-3 bg-[#151936] border-2 border-black relative group">
          ${product.image ?
            `<img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=80';" />` :
            `<div class="w-full h-full bg-gradient-to-r ${product.bgGradient || 'from-cyan-500 to-indigo-600'} flex items-center justify-center text-white">
              <i class="fa-solid ${product.icon || 'fa-cube'} text-5xl drop-shadow-md"></i>
            </div>`
          }
          <div class="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg border border-cyan-400 text-cyan-300 text-xs font-bold">
            Veyroa Tech
          </div>
        </div>

        <!-- Title & Price -->
        <div class="flex items-start justify-between gap-2 mb-1">
          <h3 class="font-bold text-lg text-white leading-snug group-hover:text-[#00e5ff] transition-colors">
            ${product.name}
          </h3>
        </div>

        <div class="text-xl font-extrabold text-[#00e5ff] mb-2 font-mono">
          ${formatLKR(product.price)}
        </div>

        <!-- Description (ALWAYS SHOWN) + Read More Button -->
        <div class="product-description-container">
          <p id="desc-${product.id}" class="product-description collapsed">
            ${product.description}
          </p>
          ${isLongDescription ? `
            <button onclick="toggleReadMore('${product.id}')" id="btn-desc-${product.id}" class="read-more-btn">
              <span>Read More</span> <i class="fa-solid fa-chevron-down text-xs ml-1"></i>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Action Footer -->
      <div class="pt-3 border-t border-[#2f366b]/80 flex items-center justify-between gap-2 mt-2">
        ${isAdminLoggedIn ? `
          <div class="flex items-center gap-1">
            <button onclick="editProductModal('${product.id}')" title="Edit Product (Admin)" class="w-8 h-8 rounded-lg bg-[#2b3060] hover:bg-cyan-500 hover:text-black text-slate-300 flex items-center justify-center border border-black transition-colors text-xs font-bold">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button onclick="deleteProduct('${product.id}')" title="Delete Product (Admin)" class="w-8 h-8 rounded-lg bg-[#2b3060] hover:bg-rose-500 hover:text-white text-slate-300 flex items-center justify-center border border-black transition-colors text-xs font-bold">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        ` : `
          <div class="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
            <i class="fa-solid fa-check text-emerald-400"></i> Direct Order
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
      icon: product.icon || 'fa-box',
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
      <div class="flex flex-col items-center justify-center py-12 text-center text-slate-400">
        <div class="w-16 h-16 rounded-2xl bg-[#151936] border-2 border-dashed border-[#2f366b] flex items-center justify-center text-slate-500 mb-3 text-2xl float-animation">
          <i class="fa-solid fa-basket-shopping"></i>
        </div>
        <p class="font-bold text-slate-300">Your cart is currently empty</p>
        <p class="text-xs text-slate-500 mt-1 max-w-[200px]">Click "+ Add to Cart" on any product to build an order.</p>
      </div>
    `;
  } else {
    cart.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'flex items-center justify-between p-3 bg-[#151936] border-2 border-[#2f366b] rounded-xl mb-2 animate-pop';

      itemEl.innerHTML = `
        <div class="flex-1 pr-2">
          <div class="flex items-center gap-2">
            <i class="fa-solid ${item.icon} text-cyan-400 text-xs"></i>
            <h4 class="font-bold text-sm text-white line-clamp-1">${item.name}</h4>
          </div>
          <div class="text-xs text-cyan-300 font-mono mt-0.5">
            ${formatLKR(item.price)} x ${item.qty} = <span class="font-bold text-white">${formatLKR(item.price * item.qty)}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div class="flex items-center bg-[#232757] rounded-lg p-1 border border-black gap-1">
            <button onclick="updateCartQty('${item.id}', -1)" class="qty-btn text-xs">-</button>
            <span class="font-bold text-sm px-1.5 min-w-[20px] text-center">${item.qty}</span>
            <button onclick="updateCartQty('${item.id}', 1)" class="qty-btn text-xs">+</button>
          </div>
          <button onclick="removeFromCart('${item.id}')" class="text-slate-400 hover:text-rose-400 p-1 text-xs">
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
  document.querySelectorAll('.filter-pill').forEach(pill => {
    if (pill.dataset.category === cat) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
  renderProducts();
};

// Search Filter Handling
window.handleSearch = function(query) {
  searchQuery = query;
  renderProducts();
};

// Add / Edit Product Modal Handlers & File Upload
window.handleImageFileUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('Image size is too large! Please choose an image under 5MB.', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Data = e.target.result;
    document.getElementById('prodImageInput').value = base64Data;

    const previewContainer = document.getElementById('imagePreviewContainer');
    const previewThumb = document.getElementById('imagePreviewThumb');
    if (previewContainer && previewThumb) {
      previewThumb.src = base64Data;
      previewContainer.classList.remove('hidden');
    }
    showToast('Image uploaded from device successfully!', 'success');
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
    showToast('Admin Mode PIN required to add or edit products', 'warning');
    return;
  }

  document.getElementById('modalTitle').textContent = 'Add New Product';
  document.getElementById('productIdInput').value = '';
  document.getElementById('prodNameInput').value = '';
  document.getElementById('prodCategoryInput').value = 'Web & Apps';
  document.getElementById('prodPriceInput').value = '';
  document.getElementById('prodStockInput').value = '10';
  document.getElementById('prodDescInput').value = '';
  document.getElementById('selectedIconInput').value = 'fa-cube';

  clearImageUpload();
  renderIconPicker('fa-cube');
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
  document.getElementById('prodCategoryInput').value = p.category;
  document.getElementById('prodPriceInput').value = p.price;
  document.getElementById('prodStockInput').value = p.stock;
  document.getElementById('prodDescInput').value = p.description;
  document.getElementById('prodImageInput').value = p.image || '';
  document.getElementById('selectedIconInput').value = p.icon || 'fa-cube';

  const previewContainer = document.getElementById('imagePreviewContainer');
  const previewThumb = document.getElementById('imagePreviewThumb');
  if (p.image && previewContainer && previewThumb) {
    previewThumb.src = p.image;
    previewContainer.classList.remove('hidden');
  } else {
    clearImageUpload();
  }

  renderIconPicker(p.icon || 'fa-cube');
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
      selectedIcon === item.icon ? 'border-cyan-400 bg-cyan-950 text-cyan-300 font-bold scale-105' : 'border-[#2f366b] bg-[#151936] text-slate-300 hover:border-slate-400'
    }`;
    btn.onclick = () => {
      document.getElementById('selectedIconInput').value = item.icon;
      renderIconPicker(item.icon);
    };
    btn.innerHTML = `<i class="fa-solid ${item.icon} text-lg"></i><span>${item.name}</span>`;
    container.appendChild(btn);
  });
}

// Save Product Form Submission
window.handleSaveProduct = function(event) {
  event.preventDefault();
  if (!isAdminLoggedIn) {
    showToast('Admin Mode required to save products', 'error');
    return;
  }

  const id = document.getElementById('productIdInput').value;
  const name = document.getElementById('prodNameInput').value.trim();
  const category = document.getElementById('prodCategoryInput').value;
  const price = parseFloat(document.getElementById('prodPriceInput').value) || 0;
  const stock = parseInt(document.getElementById('prodStockInput').value) || 0;
  const description = document.getElementById('prodDescInput').value.trim();
  const image = document.getElementById('prodImageInput').value.trim();
  const icon = document.getElementById('selectedIconInput').value || 'fa-box';

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
      bgGradient: 'from-cyan-500 to-indigo-600'
    };
    products.unshift(updatedProduct);
    showToast('New product added!', 'success');
  }

  if (updatedProduct) {
    syncProductToFirestore(updatedProduct);
  }

  saveProductsToStorage();
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
    historyList.innerHTML = `<div class="p-6 text-center text-slate-400">No WhatsApp orders recorded yet.</div>`;
    return;
  }

  salesHistory.slice(0, 15).forEach(sale => {
    const div = document.createElement('div');
    div.className = 'p-3 bg-[#151936] border border-[#2f366b] rounded-xl flex items-center justify-between text-xs';
    div.innerHTML = `
      <div>
        <div class="font-bold text-white flex items-center gap-2">
          <span>${sale.id}</span>
          <span class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] border border-emerald-700">WhatsApp Order</span>
        </div>
        <div class="text-slate-400 text-[10px] mt-0.5">${sale.date} • ${sale.items.length} items</div>
      </div>
      <div class="text-right font-mono font-bold text-cyan-300 text-sm">
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
    success: 'bg-emerald-600 text-white border-black',
    error: 'bg-rose-600 text-white border-black',
    warning: 'bg-amber-500 text-black border-black',
    info: 'bg-cyan-500 text-black border-black'
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
      btnPos.classList.add('bg-cyan-400', 'text-black', 'border-black');
      btnPos.classList.remove('text-slate-300');
    }
    if (btnHistory) {
      btnHistory.classList.remove('bg-cyan-400', 'text-black', 'border-black');
      btnHistory.classList.add('text-slate-300');
    }
  } else if (tabName === 'history') {
    if (posTab) posTab.classList.add('hidden');
    if (historyTab) historyTab.classList.remove('hidden');
    if (btnHistory) {
      btnHistory.classList.add('bg-cyan-400', 'text-black', 'border-black');
      btnHistory.classList.remove('text-slate-300');
    }
    if (btnPos) {
      btnPos.classList.remove('bg-cyan-400', 'text-black', 'border-black');
      btnPos.classList.add('text-slate-300');
    }
    renderSalesHistory();
  }
};

// Initialize Application on Page Load
document.addEventListener('DOMContentLoaded', () => {
  initData();
  renderProducts();
  renderCart();
  renderSalesHistory();
  updateAdminUI();
});
