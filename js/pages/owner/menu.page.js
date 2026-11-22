let selectedCheckinId = null;
let selectedUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('owner');
    if (!authData) return;
    
    await loadTodayCheckins();
    await loadMenuOptions();
});

// 1. Ambil data check-in HARI INI saja
async function loadTodayCheckins() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    try {
        // Ambil checkin hari ini
        const { data: checkins, error: errCheckin } = await supabaseClient
            .from('checkins')
            .select('id, created_at, user_id')
            .gte('created_at', today.toISOString())
            .order('created_at', { ascending: false });

        if (errCheckin) throw errCheckin;

        const listEl = document.getElementById('checkinList');
        
        if (!checkins || checkins.length === 0) {
            listEl.innerHTML = '<p class="font-muted text-center" style="margin-top: 50px;">Belum ada pelanggan yang check-in hari ini.</p>';
            return;
        }

        // Ambil nama profil
        const userIds = [...new Set(checkins.map(c => c.user_id))];
        const { data: profiles, error: errProfile } = await supabaseClient
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);

        if (errProfile) throw errProfile;

        const profileMap = {};
        profiles.forEach(p => profileMap[p.id] = p.full_name);

        // Render
        listEl.innerHTML = checkins.map(c => {
            const time = new Date(c.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const name = profileMap[c.user_id] || 'Pelanggan';
            
            return `
                <div class="checkin-card">
                    <div class="customer-info">
                        <h4>${name}</h4>
                        <p>Check-in: ${time} WIB</p>
                    </div>
                    <button class="btn btn-primary" style="width: auto; padding: 8px 15px; font-size: 12px;" onclick="openOrderModal('${c.id}', '${c.user_id}', '${name}')">
                        + Pesanan
                    </button>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error(error);
        document.getElementById('checkinList').innerHTML = '<p class="text-red">Gagal memuat data.</p>';
    }
}

// 2. Load menu buat modal
async function loadMenuOptions() {
    const { data } = await supabaseClient.from('master_menus').select('*').order('name');
    const select = document.getElementById('modalMenuSelect');
    if (!data) return;
    
    data.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.text = `${m.name} - Rp ${m.price.toLocaleString('id-ID')}`;
        opt.dataset.name = m.name;
        opt.dataset.price = m.price;
        select.appendChild(opt);
    });
}

// 3. Buka Modal
function openOrderModal(checkinId, userId, customerName) {
    selectedCheckinId = checkinId;
    selectedUserId = userId;
    document.getElementById('modalCustomerName').innerText = `Pesanan: ${customerName}`;
    document.getElementById('orderModal').classList.add('active');
}

// 4. Tutup Modal
function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('active');
    document.getElementById('modalMenuSelect').value = "";
    selectedCheckinId = null;
    selectedUserId = null;
}

// 5. Simpan Pesanan
async function saveOrderToCustomer() {
    const select = document.getElementById('modalMenuSelect');
    const selectedMenu = select.options[select.selectedIndex];

    if (!selectedMenu.value) return showPopup('Gagal', 'Pilih menu dulu!', 'error');

    try {
        const { error } = await supabaseClient.from('order_history').insert({
            user_id: selectedUserId,
            checkin_id: selectedCheckinId,
            menu_name: selectedMenu.dataset.name,
            price: parseInt(selectedMenu.dataset.price)
        });

        if (error) throw error;
        
        showPopup('Berhasil', 'Pesanan berhasil ditambahkan.', 'success');
        closeOrderModal();
        
    } catch (error) {
        showPopup('Gagal', error.message, 'error');
    }
}