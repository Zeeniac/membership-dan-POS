document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('customer');
    if (!authData) return;
    await loadOrderHistory(authData.user.id);
});

async function loadOrderHistory(userId) {
    try {
        const { data: orders, error } = await supabaseClient
            .from('order_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });

        if (error) throw error;
        
        const orderListEl = document.getElementById('orderList');
        if (orders.length === 0) {
            orderListEl.innerHTML = '<p class="font-muted text-center" style="margin-top: 50px;">Belum ada riwayat pesanan.</p>';
            return;
        }

        orderListEl.innerHTML = orders.map(o => `
            <div class="history-card">
                <div class="history-icon">☕</div>
                <div class="history-detail">
                    <h4>${o.menu_name}</h4>
                    <p>${new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <div class="history-price">Rp ${o.price.toLocaleString('id-ID')}</div>
                </div>
            </div>
        `).join('');

    } catch (error) { console.error(error); }
}