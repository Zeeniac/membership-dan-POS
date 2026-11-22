// Fungsi Login via Username
async function login(usernameInput, password) {
  // 1. Cari email berdasarkan username di tabel profiles
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('email, role')
    .eq('username', usernameInput)
    .single();

  if (profileError || !profile) {
    throw new Error('Username tidak ditemukan');
  }

  // 2. Login ke Supabase pakai email yang didapat
  const { data, error } = await supabaseClient.auth.signInWithPassword({ 
    email: profile.email, 
    password: password 
  });
  
  if (error) throw new Error('Password salah');

  // 3. Redirect berdasarkan role
  if (profile.role === 'owner') {
    window.location.href = '../owner/dashboard.html';
  } else {
    window.location.href = '../customer/dashboard.html';
  }
}

// Fungsi Register (Bawa data username ke database)
async function register(username, name, email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email: email, 
    password: password, 
    options: { 
      data: { 
        username: username,
        full_name: name, 
        role: 'customer' 
      } 
    }
  });
  if (error) throw error;
  return data;
}

// Fungsi Logout
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = '../index.html';
}

// Penjaga Halaman (Guard)
async function requireRole(expectedRole) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) { window.location.href = '../index.html'; return null; }

  const { data: profile } = await supabaseClient
    .from('profiles').select('*').eq('id', user.id).single();

  if (!profile || profile.role !== expectedRole) {
    window.location.href = profile?.role === 'owner' ? '../owner/dashboard.html' : '../customer/dashboard.html';
    return null;
  }
  return { user, profile };
}