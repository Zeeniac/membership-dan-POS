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
        // 1. Simpan Transaksi
        const { data: trx, error: trxErr } = await supabaseClient.from('transactions').insert({
            total_price: totalPrice,
            customer_type: selectedCustomerType,
            user_id: selectedCustomerType === 'member' ? selectedMemberId : null
        }).select().single();

        if (trxErr) throw trxErr;

        // 2. Simpan Item Transaksi
        const items = cart.map(item => ({
            transaction_id: trx.id,
            menu_id: item.id,
            menu_name: item.name,
            qty: item.qty,
            price: item.price
        }));
        await supabaseClient.from('transaction_items').insert(items);

        // 3. Potong Stok & Riwayat Member
        for (let item of cart) {
            await supabaseClient.rpc('decrease_stock', { p_menu_id: item.id, p_qty: item.qty });
            
            if (selectedCustomerType === 'member') {
                const { data: checkin } = await supabaseClient.from('checkins')
                    .select('id').eq('user_id', selectedMemberId).order('created_at', { ascending: false }).limit(1).single();
                
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

        // 4. Tampilkan Struk
        showReceipt(trx.id, totalPrice, paid);
        
        // 5. Reset
        clearCart();
        await loadMenus(); // Reload stok terbaru

    } catch (error) {
        showPopup('Gagal', 'Transaksi gagal: ' + error.message, 'error');
    }
}

function showReceipt(trxId, total, paid) {
    const change = paid - total;
    let strukText = `================================\n       OFFENSE COFFEE       \n================================\n`;
    strukText += `ID: ${trxId.split('-')[0].toUpperCase()}\n`;
    strukText += `Tanggal: ${new Date().toLocaleString('id-ID')}\n`;
    strukText += `Tipe: ${selectedCustomerType === 'member' ? 'MEMBER' : 'GUEST'}\n`;
    strukText += `--------------------------------\n`;
    
    cart.forEach(item => {
        strukText += `${item.qty}x ${item.name.padEnd(10)} Rp ${(item.price * item.qty).toLocaleString('id-ID')}\n`;
    });
    
    strukText += `--------------------------------\n`;
    strukText += `TOTAL       : Rp ${total.toLocaleString('id-ID')}\n`;
    strukText += `BAYAR       : Rp ${paid.toLocaleString('id-ID')}\n`;
    strukText += `KEMBALI     : Rp ${change.toLocaleString('id-ID')}\n`;
    strukText += `================================\n`;
    strukText += `   Terima Kasih, Selamat Ngopi!  \n`;

    document.getElementById('receiptContent').innerHTML = `<pre>${strukText}</pre>`;
    document.getElementById('receiptModal').classList.add('active');
}

function closeReceipt() {
    document.getElementById('receiptModal').classList.remove('active');
}