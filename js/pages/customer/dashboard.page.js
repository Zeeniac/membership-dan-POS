let currentUser = null;
let currentCard = null;
let qrTimerInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireRole('customer');
    if (!authData) return; 
    currentUser = authData.user;

    document.getElementById('userName').innerText = `Halo, ${authData.profile.full_name}`;
    const joinDate = new Date(authData.profile.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
    document.getElementById('joinDate').innerText = `Member sejak ${joinDate}`;

    await loadCardData(); 
});

async function loadCardData() {
    try {
        // 1. Dapatkan program yang sedang aktif (status = 'active')
        const { data: activeProgram, error: progError } = await supabaseClient
            .from('loyalty_programs')
            .select('*')
            .eq('status', 'active')
            .limit(1)
            .single();

        if (progError || !activeProgram) {
            console.error("Tidak ada program aktif");
            return;
        }

        // 2. Cek kartu aktif milik user
        let { data: card } = await supabaseClient
            .from('membership_cards')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('status', 'active')
            .single();

        // 3. Jika belum punya kartu, ATAU kartu terikat ke program lama (beda ID)
        if (!card || card.program_id !== activeProgram.id) {
            // Kalau ada kartu lama, tutup (completed)
            if (card) {
                await supabaseClient
                    .from('membership_cards')
                    .update({ status: 'completed' })
                    .eq('id', card.id);
            }

            // Bikin kartu baru untuk program aktif
            const { data: newCard } = await supabaseClient
                .from('membership_cards')
                .insert({ 
                    user_id: currentUser.id, 
                    program_id: activeProgram.id, 
                    stamps: 0, 
                    status: 'active' 
                })
                .select()
                .single();
            
            card = newCard;
        }

        // 4. Set currentCard & tampilin data
        currentCard = card;
        const program = activeProgram;
        const target = program.target_stamps || 10; 
        const stamps = currentCard.stamps || 0;

        document.getElementById('programName').innerText = program.name;
        document.getElementById('programTarget').innerText = `Kumpulkan ${target} stempel untuk hadiah!`;
        document.getElementById('progressText').innerText = `${stamps} / ${target}`;
        document.getElementById('progressFill').style.width = `${(stamps / target) * 100}%`;

        // Ubah warna banner
        const cardElement = document.querySelector('.card-brand');
        if (cardElement && program.banner_color) {
            cardElement.style.borderColor = program.banner_color;
        }

        // Sembunyikan info milestone di atas
        const infoEl = document.getElementById('milestoneInfo');
        if (infoEl) infoEl.innerHTML = "";

        // Ambil data milestone
        const { data: milestones } = await supabaseClient
            .from('program_milestones')
            .select('*')
            .eq('program_id', program.id);
        const milestoneMap = {};
        milestones?.forEach(m => milestoneMap[m.stamp_number] = m);

        // Ambil Hadiah Utama
        const mainReward = program.rewards && program.rewards.length > 0 ? program.rewards[0] : 'Hadiah Utama';

        // Render Grid Stempel
        const grid = document.getElementById('stampGrid');
        grid.innerHTML = '';
        
        for (let i = 1; i <= target; i++) {
            const slot = document.createElement('div');
            slot.className = 'stamp-slot';
            
            const milestone = milestoneMap[i];
            const isLastStamp = (i === target);

            if (milestone) {
                slot.style.borderColor = milestone.banner_color; 
                slot.innerHTML = `
                    <span class="number" style="position: absolute; top: 4px; left: 6px; font-size: 10px; color: var(--text-muted);">${i}</span>
                    <span style="font-size: 10px; font-weight: 700; text-align: center; padding: 0 4px; line-height: 1.1; color: ${milestone.banner_color}; margin-top: 5px;">${milestone.reward_name}</span>
                    <span class="stamp-icon" style="font-size: 16px; position: static; transform: none; margin-top: 4px;">🎁</span>
                `;
            } else if (isLastStamp) {
                slot.style.borderColor = '#e50914'; 
                slot.innerHTML = `
                    <span class="number" style="position: absolute; top: 4px; left: 6px; font-size: 10px; color: var(--text-muted);">${i}</span>
                    <span style="font-size: 10px; font-weight: 700; text-align: center; padding: 0 4px; line-height: 1.1; color: #e50914; margin-top: 5px;">${mainReward}</span>
                    <span class="stamp-icon" style="font-size: 16px; position: static; transform: none; margin-top: 4px;">👑</span>
                `;
            } else {
                slot.innerHTML = `<span class="number">${i}</span><span class="stamp-icon">☕</span>`;
            }

            if (i <= stamps) {
                slot.classList.add('stamped');
                slot.style.cursor = 'pointer';
                slot.onclick = () => showOrderForStamp(i);
            } else {
                const iconEl = slot.querySelector('.stamp-icon');
                if (iconEl && !milestone && !isLastStamp) {
                    iconEl.style.display = 'none';
                }
            }
            grid.appendChild(slot);
        }
    } catch (error) { console.error(error); }
}

async function showOrderForStamp(stampNumber) {
    const { data: checkins } = await supabaseClient.from('checkins').select('id, created_at').eq('user_id', currentUser.id).eq('stamp_given', true).order('created_at', { ascending: true });
    if (!checkins || !checkins[stampNumber - 1]) return showPopup('Info', `Detail untuk stempel ke-${stampNumber} belum tersedia.`, 'info');
    
    const { data: orders } = await supabaseClient.from('order_history').select('*').eq('checkin_id', checkins[stampNumber - 1].id);
    if (!orders || orders.length === 0) return showPopup('Info', `Stempel ke-${stampNumber}: Tidak ada pesanan.`, 'info');

    let strukText = `================================\n       OFFENSE COFFEE       \n================================\nKunjungan : ${stampNumber}\nTanggal   : ${new Date(checkins[stampNumber - 1].created_at).toLocaleDateString('id-ID')}\n--------------------------------\n`;
    let total = 0;
    orders.forEach(o => {
        strukText += `${o.menu_name.padEnd(15).substring(0, 15)} Rp ${o.price.toLocaleString('id-ID').padStart(10)}\n`;
        total += o.price;
    });
    strukText += `--------------------------------\nTOTAL       : Rp ${total.toLocaleString('id-ID').padStart(10)}\n================================\n   Terima Kasih, Selamat Ngopi!  \n`;
    
    // Tampilin struk di popup (pakai font monospace biar rapi)
    showPopup('Struk Kunjungan', `<pre style="text-align:left; font-size:12px; font-family:monospace; color:var(--text-main);">${strukText}</pre>`, 'success');
}

// QR CODE
async function openQRModal() {
    document.getElementById('qrModal').classList.add('active');
    await generateQR();
}
function closeQRModal() {
    document.getElementById('qrModal').classList.remove('active');
    if (qrTimerInterval) clearInterval(qrTimerInterval);
}
async function generateQR() {
    try {
        const { data, error } = await supabaseClient.rpc('generate_qr_token');
        if (error) throw error;
        const qrContainer = document.getElementById('qrCanvas');
        qrContainer.innerHTML = ''; 
        new QRCode(qrContainer, { text: data.token, width: 250, height: 250, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H });

        let timeLeft = 60;
        const timerEl = document.getElementById('qrTimer');
        timerEl.innerText = `Berlaku: ${timeLeft} detik`;
        if (qrTimerInterval) clearInterval(qrTimerInterval);
        qrTimerInterval = setInterval(() => {
            timeLeft--;
            timerEl.innerText = `Berlaku: ${timeLeft} detik`;
            if (timeLeft <= 0) { clearInterval(qrTimerInterval); timerEl.innerText = "QR Code Kadaluarsa."; }
        }, 1000);
    } catch (error) { 
        showPopup('Gagal', 'Gagal membuat QR: ' + error.message, 'error'); 
        closeQRModal(); 
    }
}