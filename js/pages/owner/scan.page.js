let html5QrcodeScanner = null;
let currentScannedUser = null; 
let currentCheckinId = null;   

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('owner');
    if (!authData) return;
    initScanner();
    loadMenuOptions(); 
});

function initScanner() {
    html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    html5QrcodeScanner.render(onScanSuccess, onScanError);
}

async function loadMenuOptions() {
    const { data } = await supabaseClient.from('master_menus').select('*').order('name');
    if (!data) return;
    const select = document.getElementById('menuSelect');
    data.forEach(menu => {
        const opt = document.createElement('option');
        opt.value = menu.id;
        opt.text = `${menu.name} - Rp ${menu.price.toLocaleString('id-ID')}`;
        opt.dataset.name = menu.name;
        opt.dataset.price = menu.price;
        select.appendChild(opt);
    });
}

async function onScanSuccess(decodedText) {
    html5QrcodeScanner.clear();
    try {
        const { data, error } = await supabaseClient.rpc('process_checkin_v2', { p_token: decodedText });
        if (error) throw error;

        currentScannedUser = data;
        
        const { data: checkinData } = await supabaseClient.from('checkins').select('id').eq('user_id', data.user_id).order('created_at', { ascending: false }).limit(1).single();
        if (checkinData) currentCheckinId = checkinData.id;

        const { data: profileData } = await supabaseClient.from('profiles').select('full_name').eq('id', data.user_id).single();

        showResult(data, profileData.full_name);
    } catch (error) {
        alert('Gagal Check-in: ' + error.message);
        resetScanner();
    }
}

function showResult(data, name) {
    document.getElementById('reader').style.display = 'none';
    document.getElementById('resultCard').classList.add('active');
    document.getElementById('resName').innerText = name;
    document.getElementById('resStamps').innerText = data.new_stamps;

    if (data.stamp_given) {
        document.getElementById('resultTitle').innerText = "Check-in Berhasil!";
        document.getElementById('resultIcon').innerText = "✅";
    } else {
        document.getElementById('resultTitle').innerText = "Check-in Tercatat";
        document.getElementById('resultIcon').innerText = "ℹ️";
    }
    document.getElementById('orderSection').style.display = 'block'; 

    if (data.voucher_code) {
        document.getElementById('resultMessage').innerHTML = `<span class="text-red font-bold">🎉 CUSTOMER DAPAT HADIAH! Kode: ${data.voucher_code}</span>`;
    } else {
        document.getElementById('resultMessage').innerText = "Silakan input pesanan jika ada.";
    }
}

async function saveOrder() {
    const select = document.getElementById('menuSelect');
    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption.value) return alert('Pilih menu dulu!');
    try {
        const { error } = await supabaseClient.from('order_history').insert({
            user_id: currentScannedUser.user_id, checkin_id: currentCheckinId,
            menu_name: selectedOption.dataset.name, price: parseInt(selectedOption.dataset.price)
        });
        if (error) throw error;
        alert('Pesanan ditambahkan ke struk!');
        select.value = ""; 
    } catch (error) { alert('Gagal simpan pesanan: ' + error.message); }
}

function resetScanner() {
    document.getElementById('resultCard').classList.remove('active');
    document.getElementById('reader').style.display = 'block';
    document.getElementById('orderSection').style.display = 'none';
    initScanner(); 
}
function onScanError(errorMessage) {}