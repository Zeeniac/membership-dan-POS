let currentProgramId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('owner');
    if (!authData) return;
    await loadCurrentProgram();
});

async function loadCurrentProgram() {
    try {
        // Ambil program yang statusnya 'active'
        const { data, error } = await supabaseClient
            .from('loyalty_programs')
            .select('*')
            .eq('status', 'active')
            .limit(1)
            .single();
            
        if (error) throw error;

        currentProgramId = data.id;
        document.getElementById('progName').value = data.name;
        document.getElementById('progTarget').value = data.target_stamps;
        
        // Konversi dari hari ke bulan buat ditampilin di form (misal 90 hari jadi 3)
        document.getElementById('progDuration').value = data.duration_days ? Math.round(data.duration_days / 30) : 3;
        
        document.getElementById('progReward').value = data.rewards ? data.rewards.join(', ') : '';
        document.getElementById('progColor').value = data.banner_color || '#e50914';
        document.getElementById('progExpiry').value = data.voucher_valid_days;

        await loadMilestones();
    } catch (error) { 
        console.error('Gagal load program:', error); 
        showPopup('Gagal', 'Belum ada program aktif. Silakan buat program baru.', 'error');
    }
}

async function loadMilestones() {
    if (!currentProgramId) return;
    const { data } = await supabaseClient.from('program_milestones').select('*').eq('program_id', currentProgramId).order('stamp_number');
    const listEl = document.getElementById('milestoneList');
    if (!data || data.length === 0) {
        listEl.innerHTML = 'Belum ada hadiah milestone.';
        return;
    }
    listEl.innerHTML = data.map(m => `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${m.banner_color || '#ff9800'};"></div>
            <span>Stempel ke-${m.stamp_number}: <strong>${m.reward_name}</strong></span>
        </div>
    `).join('<br>');
}

async function addMilestone() {
    const stamp = document.getElementById('milestoneStamp').value;
    const reward = document.getElementById('milestoneReward').value;
    const color = document.getElementById('milestoneColor').value;
    
    if (!stamp || !reward) return showPopup('Gagal', 'Isi stempel ke berapa dan nama hadiahnya!', 'error');
    if (!currentProgramId) return showPopup('Gagal', 'Buat program terlebih dahulu!', 'error');

    const { error } = await supabaseClient.from('program_milestones').insert({
        program_id: currentProgramId, 
        stamp_number: parseInt(stamp), 
        reward_name: reward,
        banner_color: color 
    });

    if (error) return showPopup('Gagal', 'Gagal tambah milestone: ' + error.message, 'error');
    
    document.getElementById('milestoneStamp').value = '';
    document.getElementById('milestoneReward').value = '';
    loadMilestones();
    showPopup('Berhasil', 'Milestone berhasil ditambahkan!', 'success');
}

async function saveProgram(e) {
    e.preventDefault();
    const name = document.getElementById('progName').value;
    const target = parseInt(document.getElementById('progTarget').value);
    const durationMonths = parseInt(document.getElementById('progDuration').value);
    const rewards = document.getElementById('progReward').value.split(',').map(s => s.trim()).filter(s => s);
    const color = document.getElementById('progColor').value;
    const expiry = parseInt(document.getElementById('progExpiry').value);

    // Konversi bulan ke hari (1 bulan = 30 hari)
    const durationDays = durationMonths * 30;

    // Hitung tanggal selesai otomatis (Hari ini + Durasi)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);
    const endDateString = endDate.toISOString().split('T')[0]; // Format YYYY-MM-DD

    try {
        const { error } = await supabaseClient.from('loyalty_programs').update({
            name: name, 
            target_stamps: target, 
            duration_days: durationDays, 
            rewards: rewards, 
            banner_color: color, 
            voucher_valid_days: expiry,
            end_date: endDateString // Simpan tanggal selesai
        }).eq('id', currentProgramId);

        if (error) throw error;
        showPopup('Berhasil!', `Program berlaku selama ${durationMonths} bulan.`, 'success');
    } catch (error) { showPopup('Gagal', 'Gagal update program: ' + error.message, 'error'); }
}

// FITUR BARU: Arsipkan Program
async function archiveProgram() {
    if (!currentProgramId) return;
    
    showConfirm('Arsipkan Program?', 'Semua pelanggan akan otomatis dapat kartu baru (mulai dari 0) saat scan berikutnya.', async () => {
        try {
            const { error } = await supabaseClient
                .from('loyalty_programs')
                .update({ status: 'archived' })
                .eq('id', currentProgramId);

            if (error) throw error;
            
            showPopup('Berhasil', 'Program diarsipkan! Silakan buat program baru.', 'success');
            setTimeout(() => window.location.reload(), 1500);
            
        } catch (error) { 
            showPopup('Gagal', 'Gagal arsip program: ' + error.message, 'error'); 
        }
    });
}

// FITUR BARU: Bikin Program Baru (Reset Form)
async function createNewProgram() {
    showConfirm('Buat Program Baru?', 'Pastikan program lama sudah di-archive.', async () => {
        try {
            // 1. Arsipkan program lama jika masih ada yang aktif
            await supabaseClient.from('loyalty_programs').update({ status: 'archived' }).eq('status', 'active');

            // 2. Bikin program baru di database
            const { error } = await supabaseClient.from('loyalty_programs').insert({
                name: 'Program Baru',
                target_stamps: 10,
                duration_days: 90, // Default 3 bulan
                banner_color: '#e50914',
                rewards: '["Hadiah Utama"]',
                voucher_valid_days: 30,
                status: 'active',
                end_date: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            });

            if (error) throw error;

            showPopup('Berhasil', 'Program baru dibuat! Silakan isi detailnya.', 'success');
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            showPopup('Gagal', 'Gagal buat program baru: ' + error.message, 'error');
        }
    });
}