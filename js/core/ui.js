// Fungsi untuk nampilin Popup Keren (Pengganti alert)
function showPopup(title, message, type = 'info') {
    // Bikin elemen overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 9999; display: flex;
        align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;
        backdrop-filter: blur(5px);
    `;

    // Bikin kotak popup
    const box = document.createElement('div');
    box.style.cssText = `
        background: var(--card-bg); border: 2px solid var(--accent-red);
        border-radius: var(--radius-lg); padding: 25px; width: 90%; max-width: 350px;
        text-align: center; box-shadow: 0 10px 30px rgba(229,9,20,0.3);
        transform: scale(0.8); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    // Tentukan Ikon
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    box.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 15px;">${icon}</div>
        <h3 style="color: var(--text-main); margin-bottom: 10px; font-size: 18px;">${title}</h3>
        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 20px;">${message}</p>
        <button class="btn btn-primary" style="width: 100%;" id="btnClosePopup">Tutup</button>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Animasi masuk
    setTimeout(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'scale(1)';
    }, 10);

    // Fungsi Tutup
    const closePopup = () => {
        overlay.style.opacity = '0';
        box.style.transform = 'scale(0.8)';
        setTimeout(() => overlay.remove(), 300);
    };

    document.getElementById('btnClosePopup').onclick = closePopup;
    overlay.onclick = (e) => { if (e.target === overlay) closePopup(); };
}

// Fungsi untuk Konfirmasi (Pengganti confirm)
function showConfirm(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 9999; display: flex;
        align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;
        backdrop-filter: blur(5px);
    `;

    const box = document.createElement('div');
    box.style.cssText = `
        background: var(--card-bg); border: 2px solid var(--accent-red);
        border-radius: var(--radius-lg); padding: 25px; width: 90%; max-width: 350px;
        text-align: center; box-shadow: 0 10px 30px rgba(229,9,20,0.3);
        transform: scale(0.8); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    box.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 15px;">❓</div>
        <h3 style="color: var(--text-main); margin-bottom: 10px; font-size: 18px;">${title}</h3>
        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 20px;">${message}</p>
        <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary" style="flex: 1;" id="btnCancel">Batal</button>
            <button class="btn btn-primary" style="flex: 1;" id="btnOk">Ya, Lanjutkan</button>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'scale(1)';
    }, 10);

    const closePopup = () => {
        overlay.style.opacity = '0';
        box.style.transform = 'scale(0.8)';
        setTimeout(() => overlay.remove(), 300);
    };

    document.getElementById('btnCancel').onclick = closePopup;
    document.getElementById('btnOk').onclick = () => {
        closePopup();
        onConfirm();
    };
    overlay.onclick = (e) => { if (e.target === overlay) closePopup(); };
}