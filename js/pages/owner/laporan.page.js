document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('owner');
    if (!authData) return;
    
    // Default load hari ini
    await loadReport('harian');
});

async function loadReport(periode) {
    // Ubah tampilan tab
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab${periode.charAt(0).toUpperCase() + periode.slice(1)}`).classList.add('active');

    // Tentukan tanggal mulai
    const now = new Date();
    let startDate = new Date();
    
    if (periode === 'harian') {
        startDate.setHours(0, 0, 0, 0); // Hari ini jam 00:00
    } else if (periode === 'mingguan') {
        startDate.setDate(now.getDate() - 7); // 7 hari ke belakang
    } else if (periode === 'bulanan') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Tanggal 1 bulan ini
    }

    try {
        // 1. Ambil data transaksi
        const { data: transactions, error } = await supabaseClient
            .from('transactions')
            .select(`
                total_price,
                transaction_items (menu_name, qty)
            `)
            .gte('created_at', startDate.toISOString());

        if (error) throw error;

        // 2. Hitung Total Pendapatan & Transaksi
        let totalPendapatan = 0;
        const menuCount = {};

        transactions.forEach(trx => {
            totalPendapatan += trx.total_price;
            
            // Hitung menu terlaris
            if (trx.transaction_items) {
                trx.transaction_items.forEach(item => {
                    menuCount[item.menu_name] = (menuCount[item.menu_name] || 0) + item.qty;
                });
            }
        });

        document.getElementById('totalPendapatan').innerText = `Rp ${totalPendapatan.toLocaleString('id-ID')}`;
        document.getElementById('totalTransaksi').innerText = `${transactions.length} Transaksi`;

        // 3. Urutkan Menu Terlaris (Top 5)
        const sortedMenus = Object.keys(menuCount)
            .map(name => ({ name, qty: menuCount[name] }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);

        const listEl = document.getElementById('bestSellerList');
        if (sortedMenus.length === 0) {
            listEl.innerHTML = '<p class="font-muted">Belum ada penjualan.</p>';
            return;
        }

        listEl.innerHTML = sortedMenus.map((m, index) => `
            <div class="best-seller-item">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="font-weight: 800; color: var(--accent-red);">#${index + 1}</span>
                    <span>${m.name}</span>
                </div>
                <span style="font-weight: bold;">${m.qty} Porsi</span>
            </div>
        `).join('');

    } catch (error) {
        console.error(error);
        showPopup('Gagal', 'Gagal memuat laporan: ' + error.message, 'error');
    }
}