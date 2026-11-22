document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('customer');
    if (!authData) return;
    await loadTopSpenders();
    await loadFrequentVisitors();
});

function getInitial(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
}

async function loadTopSpenders() {
    try {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { data: orders } = await supabaseClient.from('order_history').select('user_id, price').gte('created_at', firstDay);
        const map = {};
        orders?.forEach(o => map[o.user_id] = (map[o.user_id] || 0) + o.price);
        const sorted = Object.keys(map).map(id => ({ id, total: map[id] })).sort((a,b) => b.total - a.total).slice(0, 5);

        const listEl = document.getElementById('spenderList');
        if (sorted.length === 0) return listEl.innerHTML = '<p class="font-muted text-center" style="font-size:12px;">Belum ada data.</p>';

        const { data: profiles } = await supabaseClient.from('profiles').select('id, full_name').in('id', sorted.map(s => s.id));
        const pMap = {}; profiles.forEach(p => pMap[p.id] = p.full_name);

        listEl.innerHTML = sorted.map((s, i) => {
            const name = pMap[s.id] || 'Anonim';
            const rankClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
            return `
            <div class="lb-item">
                <div class="lb-rank ${rankClass}">${medal}</div>
                <div class="lb-avatar">${getInitial(name)}</div>
                <div class="lb-name">${name}</div>
                <div class="lb-score">Rp ${s.total.toLocaleString('id-ID')}</div>
            </div>`;
        }).join('');
    } catch (error) { console.error(error); }
}

async function loadFrequentVisitors() {
    try {
        const { data: checkins } = await supabaseClient.from('checkins').select('user_id');
        const map = {};
        checkins?.forEach(c => map[c.user_id] = (map[c.user_id] || 0) + 1);
        const sorted = Object.keys(map).map(id => ({ id, count: map[id] })).sort((a,b) => b.count - a.count).slice(0, 5);

        const listEl = document.getElementById('visitorList');
        if (sorted.length === 0) return listEl.innerHTML = '<p class="font-muted text-center" style="font-size:12px;">Belum ada data.</p>';

        const { data: profiles } = await supabaseClient.from('profiles').select('id, full_name').in('id', sorted.map(v => v.id));
        const pMap = {}; profiles.forEach(p => pMap[p.id] = p.full_name);

        listEl.innerHTML = sorted.map((v, i) => {
            const name = pMap[v.id] || 'Anonim';
            const rankClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
            return `
            <div class="lb-item">
                <div class="lb-rank ${rankClass}">${medal}</div>
                <div class="lb-avatar">${getInitial(name)}</div>
                <div class="lb-name">${name}</div>
                <div class="lb-score" style="color: var(--warning);">${v.count} Kali</div>
            </div>`;
        }).join('');
    } catch (error) { console.error(error); }
}