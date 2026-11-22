document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('owner');
    if (!authData) return;
    await loadStats();
});

async function loadStats() {
    try {
        const today = new Date(); 
        today.setHours(0, 0, 0, 0);

        // 1. Pendapatan & Transaksi Kasir Hari Ini
        const { data: transactions } = await supabaseClient
            .from('transactions')
            .select('total_price')
            .gte('created_at', today.toISOString());
            
        const totalSales = transactions?.reduce((sum, trx) => sum + trx.total_price, 0) || 0;
        document.getElementById('totalSales').innerText = `Rp ${totalSales.toLocaleString('id-ID')}`;
        document.getElementById('totalTrx').innerText = transactions?.length || 0;

        // 2. Total Member (Customer)
        const { count: memberCount } = await supabaseClient
            .from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer');
        document.getElementById('totalMembers').innerText = memberCount || 0;

        // 3. Check-in Hari Ini
        const { count: checkinCount } = await supabaseClient
            .from('checkins').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());
        document.getElementById('totalCheckins').innerText = checkinCount || 0;

        // 4. Voucher Aktif & Redeem
        const { count: voucherCount } = await supabaseClient
            .from('vouchers').select('*', { count: 'exact', head: true }).eq('status', 'issued');
        document.getElementById('totalVouchers').innerText = voucherCount || 0;

        const { count: redeemedCount } = await supabaseClient
            .from('vouchers').select('*', { count: 'exact', head: true }).eq('status', 'redeemed');
        document.getElementById('totalRedeemed').innerText = redeemedCount || 0;

        // --- LEADERBOARD ---
        // (Kode leaderboard tetap sama seperti sebelumnya)
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const { data: orders } = await supabaseClient.from('order_history').select('user_id, price').gte('created_at', firstDayOfMonth);
        const spenderMap = {};
        orders?.forEach(o => spenderMap[o.user_id] = (spenderMap[o.user_id] || 0) + o.price);
        const sortedSpenders = Object.keys(spenderMap).map(id => ({ id, total: spenderMap[id] })).sort((a,b) => b.total - a.total).slice(0, 5);
        if (sortedSpenders.length > 0) {
            const { data: profiles } = await supabaseClient.from('profiles').select('id, full_name').in('id', sortedSpenders.map(s => s.id));
            const pMap = {}; profiles.forEach(p => pMap[p.id] = p.full_name);
            document.getElementById('ownerSpenderList').innerHTML = sortedSpenders.map((s, i) => `
                <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                    <span>#${i+1} ${pMap[s.id] || 'Anonim'}</span>
                    <span style="font-weight:bold; color:var(--accent-red);">Rp ${s.total.toLocaleString('id-ID')}</span>
                </div>
            `).join('');
        } else { document.getElementById('ownerSpenderList').innerHTML = '<p class="font-muted">Belum ada data.</p>'; }

        const { data: checkins } = await supabaseClient.from('checkins').select('user_id');
        const visitMap = {};
        checkins?.forEach(c => visitMap[c.user_id] = (visitMap[c.user_id] || 0) + 1);
        const sortedVisitors = Object.keys(visitMap).map(id => ({ id, count: visitMap[id] })).sort((a,b) => b.count - a.count).slice(0, 5);
        if (sortedVisitors.length > 0) {
            const { data: profiles } = await supabaseClient.from('profiles').select('id, full_name').in('id', sortedVisitors.map(v => v.id));
            const pMap = {}; profiles.forEach(p => pMap[p.id] = p.full_name);
            document.getElementById('ownerVisitorList').innerHTML = sortedVisitors.map((v, i) => `
                <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                    <span>#${i+1} ${pMap[v.id] || 'Anonim'}</span>
                    <span style="font-weight:bold; color:var(--warning);">${v.count} Kali</span>
                </div>
            `).join('');
        } else { document.getElementById('ownerVisitorList').innerHTML = '<p class="font-muted">Belum ada data.</p>'; }

    } catch (error) { console.error(error); }
}