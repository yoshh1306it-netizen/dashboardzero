/* script.js 
  生徒・管理者共通のデータフェッチ関数などを定義
*/

const DATA_URL = './data.json'; // 本番ではGitHub PagesのURLでも可

// データを取得する関数
async function loadGlobalData() {
    try {
        // キャッシュ回避のためにタイムスタンプ付与
        const res = await fetch(`${DATA_URL}?t=${new Date().getTime()}`);
        return await res.json();
    } catch (e) {
        console.error("Data load failed", e);
        // フォールバック用ダミーデータ
        return {
            timeSettings: [], schedules: {"21HR":{}}, tests: []
        };
    }
}

// ----------------------------------------
// 以下、生徒画面(index.html)用ロジック
// ----------------------------------------

let fetchedData = null;
let currentClass = localStorage.getItem('userClass') || '21HR';

async function renderHome() {
    fetchedData = await loadGlobalData();
    
    // クラス表示
    const classDisplay = document.getElementById('userClassDisplay');
    if(classDisplay) {
        classDisplay.innerHTML = `<option>${currentClass}</option>`;
        classDisplay.value = currentClass;
    }

    renderSchedule();
    updateNextClass();
    updateTestCountdown();
    
    // 1分毎に更新
    setInterval(() => {
        updateNextClass();
        updateTestCountdown();
    }, 60000);
}

// 時計
function initClock() {
    const timeEl = document.getElementById('clockTime');
    const dateEl = document.getElementById('clockDate');
    const update = () => {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        dateEl.textContent = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    };
    setInterval(update, 1000);
    update();
}

// 時間割レンダリング
function renderSchedule() {
    const list = document.getElementById('scheduleList');
    if(!list) return;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const dayKey = days[now.getDay()];
    
    // 休日等の処理
    const todaySubjects = fetchedData.schedules[currentClass]?.[dayKey];
    
    document.getElementById('scheduleDay').textContent = now.toLocaleDateString('ja-JP', {weekday:'long'});

    list.innerHTML = '';
    if(!todaySubjects || todaySubjects.length === 0) {
        list.innerHTML = '<li style="padding:20px; text-align:center;">本日は授業がありません</li>';
        return;
    }

    todaySubjects.forEach((sub, i) => {
        if(!sub) return; // 空きコマ
        const periodSetting = fetchedData.timeSettings[i];
        const li = document.createElement('li');
        li.className = 'schedule-item';
        
        // 現在の授業ハイライト判定
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const [sH, sM] = periodSetting.start.split(':').map(Number);
        const [eH, eM] = periodSetting.end.split(':').map(Number);
        const startMin = sH * 60 + sM;
        const endMin = eH * 60 + eM;

        if (nowMin >= startMin && nowMin <= endMin) {
            li.classList.add('current-class');
        }

        li.innerHTML = `
            <div class="period-num">${i + 1}</div>
            <div class="subject-name">${sub}</div>
            <div class="schedule-time">${periodSetting.start} - ${periodSetting.end}</div>
        `;
        list.appendChild(li);
    });
}

// 次の授業判定
function updateNextClass() {
    const elSub = document.getElementById('nextClassSubject');
    const elTime = document.getElementById('nextClassTime');
    if(!elSub) return;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = days[now.getDay()];
    const todaySubjects = fetchedData.schedules[currentClass]?.[dayKey];

    if(!todaySubjects) {
        elSub.textContent = "本日は授業なし";
        elTime.textContent = "";
        return;
    }

    let found = false;
    for(let i=0; i<fetchedData.timeSettings.length; i++) {
        const time = fetchedData.timeSettings[i];
        const [sH, sM] = time.start.split(':').map(Number);
        const startTotal = sH * 60 + sM;

        if (startTotal > currentMins) {
            const subName = todaySubjects[i];
            if(subName) {
                elSub.textContent = subName;
                // 分数計算
                const diff = startTotal - currentMins;
                elTime.textContent = `${time.start}開始 (${diff}分後)`;
                found = true;
                break;
            }
        }
    }

    if(!found) {
        elSub.textContent = "放課後 / 授業終了";
        elTime.textContent = "お疲れ様でした";
    }
}

// テストカウントダウン
function updateTestCountdown() {
    const elName = document.getElementById('testName');
    const elTimer = document.getElementById('testTimer');
    if(!elName) return;

    // 未来のテストを探す
    const now = new Date();
    const futureTests = fetchedData.tests
        .map(t => ({...t, dateObj: new Date(t.date)}))
        .filter(t => t.dateObj > now)
        .sort((a,b) => a.dateObj - b.dateObj);

    if(futureTests.length === 0) {
        elName.textContent = "予定されているテストはありません";
        elTimer.textContent = "";
        return;
    }

    const target = futureTests[0];
    elName.textContent = target.name;
    
    const diff = target.dateObj - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    elTimer.textContent = `あと ${days + 1} 日`;
}

// ToDoリスト (LocalStorage)
function initTodo() {
    const input = document.getElementById('newTodo');
    const btn = document.getElementById('addTodoBtn');
    const list = document.getElementById('todoList');
    if(!list) return;

    const render = () => {
        const todos = JSON.parse(localStorage.getItem('todos') || '[]');
        list.innerHTML = '';
        todos.forEach((todo, i) => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.done ? 'done' : ''}`;
            li.innerHTML = `
                <input type="checkbox" ${todo.done ? 'checked' : ''} onchange="toggleTodo(${i})">
                <span>${todo.text}</span>
                <button onclick="removeTodo(${i})" style="margin-left:auto; border:none; background:none; color:#ccc;">×</button>
            `;
            list.appendChild(li);
        });
    };

    btn.onclick = () => {
        if(!input.value) return;
        const todos = JSON.parse(localStorage.getItem('todos') || '[]');
        todos.push({text: input.value, done: false});
        localStorage.setItem('todos', JSON.stringify(todos));
        input.value = '';
        render();
    };

    window.toggleTodo = (i) => {
        const todos = JSON.parse(localStorage.getItem('todos') || '[]');
        todos[i].done = !todos[i].done;
        localStorage.setItem('todos', JSON.stringify(todos));
        render();
    };

    window.removeTodo = (i) => {
        const todos = JSON.parse(localStorage.getItem('todos') || '[]');
        todos.splice(i, 1);
        localStorage.setItem('todos', JSON.stringify(todos));
        render();
    };

    render();
}

// ポモドーロタイマー
let pomoInterval;
let timeLeft = 25 * 60;
let isRunning = false;

function initPomodoro() {
    const timerDisplay = document.getElementById('pomoTimer');
    const btn = document.getElementById('pomoBtn');
    if(!timerDisplay) return;

    const updateDisplay = () => {
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${m}:${s}`;
    };

    btn.onclick = () => {
        if(isRunning) {
            clearInterval(pomoInterval);
            isRunning = false;
            btn.innerHTML = '<i class="fas fa-play"></i> 再開';
        } else {
            isRunning = true;
            btn.innerHTML = '<i class="fas fa-pause"></i> 一時停止';
            pomoInterval = setInterval(() => {
                if(timeLeft > 0) {
                    timeLeft--;
                    updateDisplay();
                } else {
                    clearInterval(pomoInterval);
                    alert('集中時間終了！休憩しましょう。');
                    timeLeft = 25 * 60;
                    isRunning = false;
                    btn.innerHTML = '<i class="fas fa-play"></i> 開始';
                    updateDisplay();
                }
            }, 1000);
        }
    };
}
