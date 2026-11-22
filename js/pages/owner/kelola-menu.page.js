document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('owner');
    if (!authData) return;
    loadMenus();
});

async function loadMenus() {
    const { data, error } = await supabaseClient.from('master_menus').select('*').order('name');
    if (error) return console.error(error);
    
    const listEl = document.getElementById('menuList');
    if (data.length === 0) {
        listEl.innerHTML = '<p class="font-muted text-center" style="padding: 10px;">Belum ada menu.</p>';
        return;
    }
    
    listEl.innerHTML = data.map(m => `
        <div class="menu-item">
            <div>
                <div style="font-weight: 700; font-size: 14px;">${m.name}</div>
                <div class="font-muted" style="font-size: 12px;">Rp ${m.price.toLocaleString('id-ID')}</div>
            </div>
            <button class="btn-delete" onclick="deleteMenu('${m.id}', '${m.name}')">Hapus</button>
        </div>
    `).join('');
}

async function addMenu() {
    const name = document.getElementById('menuName').value;
    const price = document.getElementById('menuPrice').value;
    
    if (!name || !price) return showPopup('Gagal', 'Isi nama dan harga!', 'error');
    
    const { error } = await supabaseClient.from('master_menus').insert({ name, price: parseInt(price) });
    if (error) return showPopup('Gagal', 'Gagal tambah menu: ' + error.message, 'error');
    
    document.getElementById('menuName').value = '';
    document.getElementById('menuPrice').value = '';
    loadMenus();
    showPopup('Berhasil', 'Menu berhasil ditambahkan!', 'success');
}

async function deleteMenu(id, name) {
    showConfirm('Hapus Menu?', `Yakin ingin menghapus "${name}"?`, async () => {
        const { error } = await supabaseClient.from('master_menus').delete().eq('id', id);
        if (error) return showPopup('Gagal', 'Gagal hapus menu: ' + error.message, 'error');
        
        loadMenus();
        showPopup('Berhasil', 'Menu berhasil dihapus.', 'success');
    });
}