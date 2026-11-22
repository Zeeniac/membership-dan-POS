document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('owner');
    if (!authData) return;
    await loadDropdowns();
    await loadResep();
});

async function loadDropdowns() {
    const { data: menus } = await supabaseClient.from('master_menus').select('id, name').order('name');
    const { data: bahan } = await supabaseClient.from('bahan_baku').select('id, nama_bahan, satuan').order('nama_bahan');
    
    const menuSelect = document.getElementById('resepMenu');
    const bahanSelect = document.getElementById('resepBahan');
    
    menus.forEach(m => menuSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`);
    bahan.forEach(b => bahanSelect.innerHTML += `<option value="${b.id}">${b.nama_bahan} (${b.satuan})</option>`);
}

async function loadResep() {
    const { data } = await supabaseClient.from('resep_menu').select(`*, master_menus(name), bahan_baku(nama_bahan, satuan)`);
    const listEl = document.getElementById('resepList');
    if (!data || data.length === 0) return listEl.innerHTML = '<p class="font-muted">Belum ada resep.</p>';
    
    listEl.innerHTML = data.map(r => `
        <div style="padding:10px 0; border-bottom:1px solid var(--border-color);">
            <div style="font-weight:700;">${r.master_menus.name}</div>
            <div class="font-muted" style="font-size:12px;">${r.bahan_baku.nama_bahan}: ${r.takaran} ${r.bahan_baku.satuan}</div>
        </div>
    `).join('');
}

async function addResep() {
    const menuId = document.getElementById('resepMenu').value;
    const bahanId = document.getElementById('resepBahan').value;
    const takaran = parseFloat(document.getElementById('resepTakaran').value);
    
    if(!menuId || !bahanId || !takaran) return showPopup('Gagal', 'Isi semua data!', 'error');
    
    const { error } = await supabaseClient.from('resep_menu').insert({
        menu_id: menuId, bahan_id: bahanId, takaran: takaran
    });
    
    if(error) return showPopup('Gagal', error.message, 'error');
    showPopup('Berhasil', 'Resep ditambahkan!', 'success');
    loadResep();
}