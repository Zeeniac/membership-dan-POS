document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('owner');
    if (!authData) return;
});

async function redeemVoucher() {
    const codeInput = document.getElementById('voucherCode').value.trim().toUpperCase();
    if (!codeInput) return showPopup('Gagal', 'Masukkan kode voucher!', 'error');

    try {
        const { data: voucher, error: findError } = await supabaseClient.from('vouchers').select('*').eq('code', codeInput).single();
        if (findError || !voucher) throw new Error('Kode voucher tidak ditemukan');
        if (voucher.status !== 'issued') throw new Error('Voucher sudah dipakai atau kadaluarsa');

        const { error: updateError } = await supabaseClient.from('vouchers').update({ status: 'redeemed', redeemed_at: new Date().toISOString() }).eq('id', voucher.id);
        if (updateError) throw updateError;

        showPopup('Berhasil!', 'Voucher berhasil diklaim.', 'success');
        document.getElementById('voucherCode').value = '';
    } catch (error) {
        showPopup('Gagal', 'Gagal klaim: ' + error.message, 'error');
    }
}