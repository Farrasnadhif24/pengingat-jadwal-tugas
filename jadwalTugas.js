document.addEventListener('DOMContentLoaded', () => {
    // 1. Minta izin notifikasi browser saat halaman dibuka
    if ('Notification' in window) {
        Notification.requestPermission();
    }
    renderTasks();
    startReminderCheck();

    // 🔄 FITUR OTOMATIS: Langsung tarik data dari LMS PPNS setiap kali web di-refresh atau dibuka!
    autoSyncOnRefresh();
});

let tasks = JSON.parse(localStorage.getItem('assignment_tasks')) || [];

// GANTI FUNGSI autoSyncOnRefresh DI FILE script.js ANDA DENGAN INI:

async function autoSyncOnRefresh() {
    const URL_KAMPUS_ASLI = "https://ppns.ac.id";
    const proxyUrl = "https://corsproxy.io?" + encodeURIComponent(URL_KAMPUS_ASLI);

    // 1. Tampilkan animasi loading di layar
    const loadingEl = document.getElementById('loadingStatus');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Gagal mengambil data via proxy.");
        
        const data = await response.text();

        let manualTasks = tasks.filter(t => !t.isFromLMS);
        let newLmsTasks = [];

        const lines = data.split('\n');
        let currentTask = {};

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('BEGIN:VEVENT')) {
                currentTask = {};
            } else if (line.startsWith('SUMMARY:')) {
                currentTask.name = line.replace('SUMMARY:', '');
            } else if (line.startsWith('DTEND:')) {
                const rawDate = line.replace('DTEND:', '');
                const year = rawDate.substring(0, 4);
                const month = rawDate.substring(4, 6);
                const day = rawDate.substring(6, 8);
                const hour = rawDate.substring(9, 11);
                const min = rawDate.substring(11, 13);
                
                const dateObj = new Date(`${year}-${month}-${day}T${hour}:${min}:00Z`);
                dateObj.setHours(dateObj.getHours() + 7); 
                currentTask.deadline = dateObj.toISOString().slice(0, 16); 
            } else if (line.startsWith('END:VEVENT')) {
                if (currentTask.name && currentTask.deadline) {
                    const deadlineTime = new Date(currentTask.deadline).getTime();
                    newLmsTasks.push({
                        id: 'LMS-' + deadlineTime + '-' + Math.random(),
                        name: currentTask.name,
                        deadline: currentTask.deadline,
                        notificationTime: deadlineTime, 
                        offsetLabel: "Tepat Waktu (0 Menit)",
                        notified: false,
                        isFromLMS: true
                    });
                }
            }
        }

        tasks = [...manualTasks, ...newLmsTasks];
        tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        localStorage.setItem('assignment_tasks', JSON.stringify(tasks));
        renderTasks();
        console.log("Real-time Sync Sukses: Tugas LMS PPNS berhasil diperbarui otomatis!");

    } catch (error) {
        console.error("Gagal melakukan refresh otomatis data LMS:", error);
    } finally {
        // 2. Sembunyikan kembali animasi loading setelah selesai (baik sukses maupun gagal)
        if (loadingEl) {
            // Ditambahkan delay sedikit (500ms) agar transisi putaran terlihat mulus oleh mata
            setTimeout(() => {
                loadingEl.style.display = 'none';
            }, 500);
        }
    }
}

// ========================================================
// FUNGSI INPUT MANUAL & PENGATURAN TAMPILAN
// ========================================================
function addTask() {
    const nameInput = document.getElementById('taskName');
    const deadlineInput = document.getElementById('taskDeadline');
    const offsetInput = document.getElementById('reminderOffset');

    if (!nameInput.value || !deadlineInput.value) {
        alert('Mohon isi nama tugas dan waktu deadline!');
        return;
    }

    const deadlineTime = new Date(deadlineInput.value).getTime();
    const offsetMinutes = parseInt(offsetInput.value);
    const notificationTime = deadlineTime - (offsetMinutes * 60 * 1000);

    const newTask = {
        id: Date.now(),
        name: nameInput.value,
        deadline: deadlineInput.value,
        notificationTime: notificationTime,
        offsetLabel: offsetInput.options[offsetInput.selectedIndex].text,
        notified: false,
        isFromLMS: false
    };

    tasks.push(newTask);
    localStorage.setItem('assignment_tasks', JSON.stringify(tasks));
    
    nameInput.value = '';
    deadlineInput.value = '';
    renderTasks();
}

function deleteTask(id) {
    tasks = tasks.filter(task => task.id !== id);
    localStorage.setItem('assignment_tasks', JSON.stringify(tasks));
    renderTasks();
}

function renderTasks() {
    const list = document.getElementById('taskList');
    list.innerHTML = '';

    tasks.forEach(task => {
        const dateFormatted = new Date(task.deadline).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });

        const li = document.createElement('li');
        li.className = 'task-item';
        
        // Warna border pembeda: Ungu untuk manual, Biru untuk LMS otomatis
        li.style.borderLeftColor = task.isFromLMS ? '#4f46e5' : '#8b5cf6';
        if (task.notified) li.style.borderLeftColor = '#10b981'; // Hijau jika waktu notifikasi sudah lewat

        li.innerHTML = `
            <div class="task-info">
                <p class="task-title">${task.name}</p>
                <p class="task-time">⏰ Deadline: ${dateFormatted}</p>
                <small style="color: #6b7280; display:block; margin-top:2px;">
                    ${task.isFromLMS ? '🖥️ Otomatis dari LMS PPNS' : '✍️ Input Manual'}
                </small>
            </div>
            <button class="btn-delete" onclick="deleteTask('${task.id}')">Hapus</button>
        `;
        list.appendChild(li);
    });
}

function startReminderCheck() {
    setInterval(() => {
        const now = new Date().getTime();
        let updated = false;

        tasks.forEach(task => {
            if (now >= task.notificationTime && !task.notified) {
                triggerNotification(task.name);
                task.notified = true;
                updated = true;
            }
        });

            if (updated) {
                localStorage.setItem('assignment_tasks', JSON.stringify(tasks));
                renderTasks();
            }
    }, 10000);
}

function triggerNotification(taskName) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🚨 Waktu Tugas Tiba!', {
            body: `Jangan lupa kerjakan tugas: ${taskName}`,
            icon: 'https://flaticon.com'
        });
    }
}
