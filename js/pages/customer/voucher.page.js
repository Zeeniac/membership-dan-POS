document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('customer');
    if (!authData) return;
    await loadVouchers(authData.user.id);
});

async function loadVouchers(userId) {
    try {
        const { data: vouchers, error } = await supabaseClient
            .from('vouchers').select('*').eq('user_id', userId).order('issued_at', { ascending: false });
            
        if (error) throw error;
        
        const listEl = document.getElementById('voucherList');
        if (vouchers.length === 0) {
            listEl.innerHTML = '<p class="font-muted text-center" style="margin-top: 50px;">Belum ada voucher.<br>Ayo kumpulkan stempelmu!</p>';
            return;
        }

        listEl.innerHTML = vouchers.map(v => {
            const isRedeemed = v.status === 'redeemed';
            const isExpired = new Date(v.expires_at) < new Date();
            const isActive = !isRedeemed && !isExpired;
            
            const cardClass = isActive ? 'voucher-card' : 'voucher-card redeemed';
            const statusText = isRedeemed ? 'SUDAH DIKLAIM' : (isExpired ? 'KADALUARSA' : 'AKTIF');
            
            const clickAction = isActive ? `onclick="showVoucherCode('${v.code}', '${v.reward_type}')" style="cursor:pointer;"` : '';

            return `
            <div class="${cardClass}" ${clickAction}>
                <div class="voucher-left">
                    <span>HADIAH</span>
                    <h3>OFFENSE</h3>
                </div>
                <div class="voucher-right">
                    <h4>${v.reward_type.replace('_', ' ')}</h4>
                    <p>Status: <strong>${statusText}</strong></p>
                    <div class="voucher-code">${v.code}</div>
                </div>
            </div>
        `}).join('');
    } catch (error) { console.error(error); }
}

function showVoucherCode(code, type) {
    showPopup('Voucher Kamu 🎁', `Hadiah: ${type.replace('_', ' ').toUpperCase()}\n\nKode: <strong>${code}</strong>\n\nTunjukkan layar ini ke Owner untuk diklaim.`, 'success');
}