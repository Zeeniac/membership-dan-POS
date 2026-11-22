document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('owner');
    if (!authData) return;
    loadBahan();
});

async function loadBahan() {
    const { data } = await supabaseClient.from('bahan_baku').select('*').order('nama_bahan');
    const listEl = document.getElementById('bahanList');
    if (!data || data.length === 0) return listEl.innerHTML = '<p class="font-muted">Belum ada bahan.</p>';
    
    listEl.innerHTML = data.map(b => `
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);">
            <div>
                <div style="font-weight:700;">${b.nama_bahan}</div>
                <div class="font-muted" style="font-size:12px;">Stok: ${b.stok_saat_ini} ${b.satuan}</div>
            </div>
            <div style="font-weight:700; color:var(--accent-red);">Rp ${b.harga_satuan.toLocaleString('id-ID')} / ${b.satuan}</div>
        </div>
    `).join('');
}

async function addBahan() {
    const nama = document.getElementById('namaBahan').value;
    const stok = parseFloat(document.getElementById('stokBahan').value);
    const satuan = document.getElementById('satuanBahan').value;
    const harga = parseFloat(document.getElementById('hargaBahan').value);
    
    if(!nama || !stok || !satuan || !harga) return showPopup('Gagal', 'Isi semua data!', 'error');
    
    const { error } = await supabaseClient.from('bahan_baku').insert({
        nama_bahan: nama, stok_saat_ini: stok, satuan: satuan, harga_satuan: harga
    });
    
    if(error) return showPopup('Gagal', error.message, 'error');
    showPopup('Berhasil', 'Bahan ditambahkan!', 'success');
    loadBahan();
}