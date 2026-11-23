let currentUser = null;
let cart = [];
let selectedMemberId = null;
let selectedCustomerType = 'guest';

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('owner');
    if (!authData) return;
    currentUser = authData.user;

    await loadMenus();
    await loadTodayMembers();
});

async function loadMenus() {
    const { data } = await supabaseClient.from('master_menus').select('*').eq('is_available', true).order('name');
    const grid = document.getElementById('menuGrid');
    if (!data) return;

    if (data.length === 0) {
        grid.innerHTML = '<p class="font-muted">Belum ada menu.</p>';
        return;
    }

    grid.innerHTML = data.map(m => `
        <div class="menu-card ${m.stock <= 0 ? 'disabled' : ''}" onclick="addToCart('${m.id}', '${m.name}', ${m.price})">
            <h4>${m.name}</h4>
            <p>Rp ${m.price.toLocaleString('id-ID')}</p>
            <small>Stok: ${m.stock}</small>
        </div>
    `).join('');
}

async function loadTodayMembers() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: checkins } = await supabaseClient.from('checkins').select('id, user_id').gte('created_at', today.toISOString()).order('created_at', { ascending: false });

    const select = document.getElementById('memberSelect');
    select.innerHTML = '<option value="">-- Pilih Member (Check-in) --</option>';

    if (!checkins || checkins.length === 0) {
        select.innerHTML = '<option value="">Belum ada member check-in hari ini</option>';
        return;
    }

    const userIds = [...new Set(checkins.map(c => c.user_id))];
    const { data: profiles } = await supabaseClient.from('profiles').select('id, full_name').in('id', userIds);
    
    const profileMap = {};
    profiles.forEach(p => profileMap[p.id] = p.full_name);

    checkins.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.user_id; 
        opt.text = profileMap[c.user_id] || 'Anonim';
        select.appendChild(opt);
    });
}

function switchCustomerType(type) {
    selectedCustomerType = type;
    document.getElementById('tabGuest').classList.toggle('active', type === 'guest');
    document.getElementById('tabMember').classList.toggle('active', type === 'member');
    document.getElementById('memberSelectSection').style.display = type === 'member' ? 'block' : 'none';
    clearCart(); 
}

function selectMember() {
    selectedMemberId = document.getElementById('memberSelect').value;
}

function addToCart(id, name, price) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ id, name, price, qty: 1 });
    }
    renderCart();
}

function updateQty(id, change) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    
    item.qty += change;
    if (item.qty <= 0) {
        cart = cart.filter(i => i.id !== id);
    }
    renderCart();
}

function renderCart() {
    const listEl = document.getElementById('cartList');
    const countEl = document.getElementById('cartCount');
    
    if (cart.length === 0) {
        listEl.innerHTML = '<p class="font-muted text-center" style="font-size: 12px; margin-top: 20px;">Keranjang kosong</p>';
        countEl.innerText = '0 Item';
        document.getElementById('subtotalText').innerText = 'Rp 0';
        document.getElementById('totalText').innerText = 'Rp 0';
        calculateChange();
        return;
    }

    let total = 0;
    let totalQty = 0;
    
    listEl.innerHTML = cart.map(item => {
        total += item.price * item.qty;
        totalQty += item.qty;
        return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h5>${item.name}</h5>
                    <p>Rp ${item.price.toLocaleString('id-ID')}</p>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
                </div>
            </div>
        `;
    }).join('');
    
    countEl.innerText = `${totalQty} Item`;
    document.getElementById('subtotalText').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    document.getElementById('totalText').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    calculateChange();
}

function calculateChange() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const paid = parseInt(document.getElementById('paymentInput').value) || 0;
    const change = paid - total;
    
    const changeEl = document.getElementById('changeText');
    if (change < 0) {
        changeEl.innerText = 'Kurang';
        changeEl.style.color = 'var(--accent-red)';
    } else {
        changeEl.innerText = `Rp ${change.toLocaleString('id-ID')}`;
        changeEl.style.color = 'var(--success)';
    }
}

function clearCart() {
    cart = [];
    document.getElementById('paymentInput').value = '';
    renderCart();
}

async function processPayment() {
    if (cart.length === 0) return showPopup('Gagal', 'Keranjang masih kosong!', 'error');
    
    let totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let paid = parseInt(document.getElementById('paymentInput').value) || 0;

    if (paid < totalPrice) return showPopup('Gagal', 'Uang bayar kurang!', 'error');
    if (selectedCustomerType === 'member' && !selectedMemberId) {
        return showPopup('Gagal', 'Pilih member terlebih dahulu!', 'error');
    }

    try {
        const { data: trx, error: trxErr } = await supabaseClient.from('transactions').insert({
            total_price: totalPrice,
            customer_type: selectedCustomerType,
            user_id: selectedCustomerType === 'member' ? selectedMemberId : null
        }).select().single();

        if (trxErr) throw trxErr;

        const items = cart.map(item => ({
            transaction_id: trx.id,
            menu_id: item.id,
            menu_name: item.name,
            qty: item.qty,
            price: item.price
        }));
        await supabaseClient.from('transaction_items').insert(items);

        for (let item of cart) {
            const { data: resep } = await supabaseClient.from('resep_menu').select('bahan_id, takaran').eq('menu_id', item.id);

            if (resep && resep.length > 0) {
                for (let r of resep) {
                    await supabaseClient.rpc('decrease_bahan_stock', { p_bahan_id: r.bahan_id, p_qty: r.takaran * item.qty });
                }
            } else {
                await supabaseClient.rpc('decrease_stock', { p_menu_id: item.id, p_qty: item.qty });
            }
            
            if (selectedCustomerType === 'member') {
                const { data: checkin } = await supabaseClient.from('checkins').select('id').eq('user_id', selectedMemberId).order('created_at', { ascending: false }).limit(1).single();
                if (checkin) {
                    await supabaseClient.from('order_history').insert({
                        user_id: selectedMemberId,
                        checkin_id: checkin.id,
                        menu_name: item.name,
                        price: item.price * item.qty
                    });
                }
            }
        }

        showReceipt(trx.id, totalPrice, paid);
        clearCart();
        await loadMenus(); 

    } catch (error) {
        showPopup('Gagal', 'Transaksi gagal: ' + error.message, 'error');
    }
}

function showReceipt(trxId, total, paid) {
    const change = paid - total;
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

    // --- STRUKTUR BARU (PERSIS JOFIE) ---
    let strukHTML = `
        <div class="struk-wrapper">
            <div class="struk-header">
                <img src="../../../assets/images/logo-wide.png.png" alt="Logo">
                <h3>Offense Coffee</h3>
                <p>Jl. Nibung<br>Medan</p>
                <p>IG @OFFENSECOFFEE</p>
            </div>

            <div class="struk-divider"></div>

            <div class="struk-info">
                <div class="row"><span>Pesanan: 0-${String(Math.floor(Math.random()*100)).padStart(2,'0')}</span><span>Kasir: Owner</span></div>
                <div class="row"><span>POS: POS 1</span><span>${selectedCustomerType === 'member' ? 'Member' : 'Guest'}</span></div>
            </div>

            <div class="struk-divider"></div>

            <div class="struk-items">
    `;

    cart.forEach((item) => {
        strukHTML += `
            <div class="item-block">
                <div class="item-title">${item.name.toUpperCase()}</div>
                <div class="item-detail">
                    <span>${item.qty} x ${item.price.toLocaleString('id-ID')}</span>
                    <span>${(item.price * item.qty).toLocaleString('id-ID')}</span>
                </div>
            </div>
        `;
    });

    strukHTML += `
            </div>

            <div class="struk-divider"></div>

            <div class="struk-totals">
                <div class="total-row bold" style="font-size: 16px;">
                    <span>TOTAL</span>
                    <span>${total.toLocaleString('id-ID')}</span>
                </div>
                <div class="total-row"><span>Bayar (Tunai)</span><span>${paid.toLocaleString('id-ID')}</span></div>
                <div class="total-row"><span>Kembalian</span><span>${change.toLocaleString('id-ID')}</span></div>
                <div class="total-row" style="margin-top: 10px;"><span>Banyak Item: ${cart.reduce((sum, item) => sum + item.qty, 0)}</span></div>
            </div>

            <div class="struk-divider"></div>

            <div class="struk-footer">
                <p>Terima kasih atas pembelian Anda!</p>
                <p style="margin-top: 15px;">${dateStr} ${timeStr} &nbsp; #9-1008</p>
            </div>
        </div>
    `;

    document.getElementById('receiptContent').innerHTML = strukHTML;
    document.getElementById('receiptModal').classList.add('active');
}

function closeReceipt() {
    document.getElementById('receiptModal').classList.remove('active');
}

// FUNGSI PRINT BARU (TIDAK MERUSAK HALAMAN)
function printReceipt() {
    const printContent = document.getElementById('receiptContent').innerHTML;
    
    // Buka tab baru untuk print
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    // Tulis HTML persis seperti struk JOFIE
    printWindow.document.write(`
        <html>
        <head>
            <title>Cetak Struk</title>
            <style>
                /* Paksa font Arial dan hitam pekat */
                body { 
                    font-family: Arial, Helvetica, sans-serif; 
                    font-size: 11px; 
                    color: #000; 
                    width: 58mm; 
                    margin: 0 auto; 
                    padding: 5px; 
                    font-weight: bold;
                }
                .struk-wrapper { width: 100%; }
                .struk-header { text-align: center; }
                .struk-header img { width: 60px; filter: grayscale(100%) contrast(300%); margin-bottom: 5px; }
                .struk-header h3 { font-size: 14px; margin: 5px 0; font-weight: 900; }
                .struk-header p { margin: 2px 0; font-size: 11px; }
                .struk-divider { border-top: 1px dashed #000; margin: 8px 0; }
                .row, .item-detail, .total-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                .item-title { font-weight: 900; margin-top: 5px; font-size: 12px; }
                .item-detail { padding-left: 0; }
                .total-row.bold { font-weight: 900; font-size: 13px; }
                .struk-footer { text-align: center; margin-top: 10px; font-size: 10px; }
            </style>
        </head>
        <body>
            ${printContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close(); // Otomatis tutup tab setelah print
    }, 500);
}