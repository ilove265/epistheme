import { auth, db, provider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth"; 
import { doc, setDoc, getDoc, getDocs } from "firebase/firestore";
import { collection, addDoc, query, where, onSnapshot, updateDoc, arrayUnion, arrayRemove, orderBy, deleteDoc } from "firebase/firestore";
document.addEventListener('DOMContentLoaded', () => {
    let currentQuizQuestions = []; // Lưu câu hỏi của đề đang làm
    //phần modal điểm
    const scoreResultModal = document.getElementById('score-result-modal');
    const finalScoreEl = document.getElementById('final-score');
    const totalQuestionsScoreEl = document.getElementById('total-questions-score');
    const scoreMessageEl = document.getElementById('score-message');
    const closeScoreBtn = document.getElementById('close-score-btn');
    // Lấy các phần tử giao diện
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userProfile = document.getElementById('user-profile');
    const userNameDisplay = document.getElementById('user-name');
    const userAvatar = document.getElementById('user-avatar');
    // 1. Chuyển đổi giữa các Tab (Giữ nguyên)
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            const targetSec = document.getElementById(targetId);
            if(targetSec) targetSec.classList.add('active');
        });
    });

    // 2. Lật Flashcard (Giữ nguyên)
    const flashcard = document.getElementById('flashcard');
    if (flashcard) {
        flashcard.addEventListener('click', () => {
            flashcard.classList.toggle('flipped');
        });
    }

    // 3. Cấu hình AI Assistant
    // LƯU Ý: Đảm bảo API Key của bạn còn hạn định mức (Quota)

    const MODEL_NAME = "gemini-3.1-flash-lite-preview";

    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    
    let chatHistory = [
        {
            role: "user",
            parts: [{ text: "Bạn là trợ lý AI STUDY cao cấp. Hãy hỗ trợ người dùng học tập, giải đáp kiến thức khoa học, vật lý, và soạn thảo đề thi chuyên nghiệp. Phong cách trả lời: ngắn gọn, đơn giản, chỉ tập trung vào câu hỏi của người dùng" }]
        },
        {
            role: "model",
            parts: [{ text: "Hệ thống AI STUDY đã sẵn sàng. Tôi có thể giúp gì cho tiến trình nghiên cứu của bạn?" }]
        }
    ];
    
    const assistantBox = document.querySelector('.ai-sidebar-assistant');
    const chatWindow = document.getElementById('ai-chat-window');
    const closeChat = document.getElementById('close-chat');
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const chatContent = document.getElementById('chat-content');

    // Mở/Đóng Chat
    if(assistantBox) assistantBox.onclick = () => chatWindow.style.display = 'flex';
    if(closeChat) closeChat.onclick = () => chatWindow.style.display = 'none';

    // Hàm thêm tin nhắn vào giao diện
    function appendMessage(text, type) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${type}-msg`;
        msgDiv.innerText = text;
        chatContent.appendChild(msgDiv);
        chatContent.scrollTop = chatContent.scrollHeight; // Tự động cuộn xuống dưới
    }

    // Hàm gọi API Gemini
    async function callGemini(message) {
        if (!currentUserData) {
            alert("Vui lòng đăng nhập để dùng AI!");
            return;
        }

        // Ví dụ cách gửi kèm tính cách:
        const systemPrompt = currentUserData.ai_personality;
        const finalInput = `[System Instruction: ${systemPrompt}] \n User: ${userInput}`;
        chatHistory.push({ role: "user", parts: [{ text: message }] });

        try {
            const response = await fetch(GEMINI_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: chatHistory })
            });

            const data = await response.json();
            
            if (data.error) {
                console.error("Gemini API Error:", data.error.message);
                return `⚠️ Lỗi từ AI: ${data.error.message}`;
            }

            const reply = data.candidates[0].content.parts[0].text;
            chatHistory.push({ role: "model", parts: [{ text: reply }] });
            return reply;
        } catch (error) {
            console.error("Network Error:", error);
            return "⚠️ Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra mạng.";
        }
    }

    // Hàm xử lý khi nhấn gửi
    async function handleChat() {
        const text = userInput.value.trim();
        if (!text) return;

        // 1. Hiển thị tin nhắn của người dùng
        appendMessage(text, 'user');
        userInput.value = '';

        // 2. Hiển thị hiệu ứng chờ
        const loading = document.createElement('div');
        loading.className = 'msg bot-msg loading-msg';
        loading.innerText = 'Đang suy nghĩ...';
        chatContent.appendChild(loading);
        chatContent.scrollTop = chatContent.scrollHeight;

        // 3. Gọi AI và hiển thị phản hồi
        const reply = await callGemini(text);
        
        // Xóa dòng "Đang suy nghĩ" và thêm câu trả lời thật
        if(chatContent.contains(loading)) chatContent.removeChild(loading);
        appendMessage(reply, 'bot');
    }

    // GÁN SỰ KIỆN (Chỉ gán 1 lần duy nhất)
    if (sendBtn) {
        sendBtn.onclick = handleChat;
    }

    if (userInput) {
        userInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                handleChat();
            }
        };
    }

    // 4. TÀI KHOẢN NGƯỜI DÙNG
    async function handleLogin() {
    console.log("Đang kích hoạt đăng nhập..."); // Dòng này để kiểm tra nút có ăn không
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Kiểm tra xem người dùng đã có thông tin trong Firestore chưa
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                // Nếu là người dùng mới, tạo mới thông tin và tính cách AI mặc định
                await setDoc(userDocRef, {
                    displayName: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL,
                    ai_personality: "Bạn là một trợ lý học tập thân thiện, luôn giải thích mọi thứ một cách dễ hiểu và cổ vũ người dùng.", // Tính cách mặc định
                    createdAt: new Date()
                });
                console.log("Đã tạo người dùng mới trên Firestore");
            }
        
        } catch (error) {
            console.error("Lỗi đăng nhập:", error);
            alert("Đăng nhập thất bại!");
        }
    }

    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            location.reload(); // Load lại trang để xóa sạch dữ liệu cũ
        });
    });

    let currentUserData = null; // Biến toàn cục để lưu thông tin người dùng hiện tại

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // --- NGƯỜI DÙNG ĐÃ ĐĂNG NHẬP ---
            loginBtn.style.display = 'none';
            userProfile.style.display = 'flex';
        
            // Hiển thị thông tin lên giao diện
            userNameDisplay.innerText = user.displayName;
            userAvatar.src = user.photoURL;

            // Lấy dữ liệu chi tiết (bao gồm tính cách AI) từ Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            await loadSchedulesFromFirestore(); // Tải dữ liệu từ Firestore
            await loadFlashcardSets();
            if (userDoc.exists()) {
                currentUserData = userDoc.data();
                console.log("Tính cách AI của bạn là:", currentUserData.ai_personality);
            }
            updateUIWithUser(user);
            loadUserExams(user.uid); // Chỉ hiện đề của mình
            loadCommunityFeed();     // Hiện bảng tin chung
            const userSnap = await getDoc(doc(db, "users", user.uid));
            if (userSnap.exists()) {
                currentUserData = userSnap.data();
                // renderScheduleCards(currentUserData.schedule); // Vẽ thẻ khi vừa load
            }
        } else {
            // --- NGƯỜI DÙNG CHƯA ĐĂNG NHẬP ---
            loginBtn.style.display = 'block';
            userProfile.style.display = 'none';
            currentUserData = null;
            scheduleA = [];
            scheduleB = [];
            renderSchedule(scheduleA, 'board-A');
            renderSchedule(scheduleB, 'board-B');
        }
    });

    // Gán sự kiện cho nút bấm
    loginBtn.addEventListener('click', handleLogin);


    // --- QUẢN LÝ ĐỀ THI ---

    // --- KHAI BÁO THÊM PHẦN TỬ ---
const editorOverlay = document.getElementById('exam-editor-overlay');
const quizOverlay = document.getElementById('quiz-player-overlay');
const questionsList = document.getElementById('questions-list');
const examListContainer = document.querySelector('#exams .grid-layout') || document.querySelector('.grid-layout');
const quizContent = document.getElementById('quiz-content');
let currentQuestions = []; // Lưu danh sách câu hỏi đang soạn

window.deleteExam = async (e, examId) => {
        e.stopPropagation(); // Ngăn việc nhấn Xóa nhưng lại nhảy vào làm bài
        if (confirm("Bạn có chắc chắn muốn xóa đề thi này không?")) {
            try {
                await deleteDoc(doc(db, "exams", examId));
                alert("Đã xóa đề thi!");
            } catch (error) {
                console.error("Lỗi khi xóa:", error);
            }
        }
    };

// 1. Mở trình soạn đề
document.querySelector('#exams .btn-primary').onclick = () => {
    editorOverlay.style.display = 'flex';
    currentQuestions = [];
    questionsList.innerHTML = '';
    addQuestion(); // Tự động thêm câu 1
};

// 2. Thoát trình soạn
document.getElementById('exit-editor').onclick = () => {
    if(confirm("Bạn có chắc muốn thoát? Dữ liệu chưa lưu sẽ mất.")) {
        editorOverlay.style.display = 'none';
    }
};

// 3. Hàm thêm một câu hỏi trắc nghiệm mới vào giao diện
function addQuestion() {
    const qIndex = currentQuestions.length + 1;
    const qDiv = document.createElement('div');
    qDiv.className = 'question-item card';
    qDiv.innerHTML = `
        <h4>Câu hỏi ${qIndex}</h4>
        <textarea placeholder="Nhập câu hỏi tại đây..." class="q-text"></textarea>
        <div class="option-group">
            <input type="text" placeholder="Đáp án A" class="opt-a">
            <input type="text" placeholder="Đáp án B" class="opt-b">
            <input type="text" placeholder="Đáp án C" class="opt-c">
            <input type="text" placeholder="Đáp án D" class="opt-d">
        </div>
        <select class="correct-opt">
            <option value="A">Đáp án đúng: A</option>
            <option value="B">Đáp án đúng: B</option>
            <option value="C">Đáp án đúng: C</option>
            <option value="D">Đáp án đúng: D</option>
        </select>
    `;
    questionsList.appendChild(qDiv);
    currentQuestions.push({}); // Giữ chỗ trong mảng
}
document.getElementById('add-question-btn').onclick = addQuestion;

// 4. Lưu đề thi vào Firestore
document.getElementById('save-exam-btn').onclick = async () => {
    const title = document.getElementById('editor-title').value;
    const subject = document.getElementById('editor-subject').value;
    const qItems = document.querySelectorAll('.question-item');
    
    let finalQuestions = [];
    qItems.forEach(item => {
        finalQuestions.push({
            question: item.querySelector('.q-text').value,
            options: {
                A: item.querySelector('.opt-a').value,
                B: item.querySelector('.opt-b').value,
                C: item.querySelector('.opt-c').value,
                D: item.querySelector('.opt-d').value,
            },
            answer: item.querySelector('.correct-opt').value
        });
    });

    try {
        await addDoc(collection(db, "exams"), {
            userId: auth.currentUser.uid,
            title,
            subject,
            questions: finalQuestions,
            createdAt: new Date()
        });
        alert("Đã tạo đề thi thành công!");
        editorOverlay.style.display = 'none';
    } catch (e) { console.error(e); }
};


    //hàm show điểm
    function showScore(correctCount, total) {
        quizOverlay.style.display = 'none'; // Ẩn màn hình làm bài
        
        finalScoreEl.innerText = correctCount;
        totalQuestionsScoreEl.innerText = total;
        
        const score10 = ((correctCount / total) * 10).toFixed(1);
        const percentage = (correctCount / total) * 100;

        if (percentage >= 80) scoreMessageEl.innerText = `Xuất sắc! Điểm của bạn: ${score10}/10 🚀`;
        else if (percentage >= 50) scoreMessageEl.innerText = `Khá tốt! Điểm của bạn: ${score10}/10 📚`;
        else scoreMessageEl.innerText = `Cần cố gắng thêm! Điểm của bạn: ${score10}/10 💪`;

        scoreResultModal.style.display = 'block'; // Hiện Modal điểm
    }


// 5. Hàm Bắt đầu làm bài (Khi ấn vào thẻ đề thi)
window.startQuiz = async (examId) => {
        const docSnap = await getDoc(doc(db, "exams", examId));
        if (docSnap.exists()) {
            const exam = docSnap.data();
            currentQuizQuestions = exam.questions; // Lưu vào biến toàn cục để chấm điểm
            
            // Xây dựng lại giao diện Quiz Player để nút "Nộp bài" trên cùng hoạt động
            quizOverlay.innerHTML = `
                <div class="quiz-player-container" style="width:100%; height:100%; display:flex; flex-direction:column; background:white;">
                    <header class="quiz-header" style="padding: 20px 40px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee;">
                        <h2 id="quiz-display-title" style="color:var(--primary)">${exam.title}</h2>
                        <div class="quiz-controls">
                            <button id="top-submit-btn" class="btn-primary">Nộp bài</button>
                            <button onclick="document.getElementById('quiz-player-overlay').style.display='none'" class="btn-ghost">Thoát</button>
                        </div>
                    </header>
                    <div id="quiz-content" style="flex-grow:1; overflow-y:auto; padding:40px;">
                        </div>
                </div>
            `;
            
            const quizInnerContent = quizOverlay.querySelector('#quiz-content');

            exam.questions.forEach((q, index) => {
                const qCard = document.createElement('div');
                qCard.className = 'card quiz-q-card';
                qCard.style.marginBottom = '20px';
                qCard.style.padding = '25px';
                qCard.innerHTML = `
                    <p style="font-size:1.1rem; margin-bottom:15px;"><strong>Câu ${index + 1}:</strong> ${q.question}</p>
                    <div class="quiz-options" style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        ${['A','B','C','D'].map(opt => `
                            <label style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid #eee; border-radius:10px; cursor:pointer;">
                                <input type="radio" name="q${index}" value="${opt}">
                                <span><strong>${opt}.</strong> ${q.options[opt]}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
                quizInnerContent.appendChild(qCard);
            });

            quizOverlay.style.display = 'flex';

            // Xử lý nộp bài từ nút phía trên
            document.getElementById('top-submit-btn').onclick = () => {
                // Ở đây bạn có thể hiện Modal "Xác nhận nộp bài" nếu muốn, hoặc chấm luôn:
                let correctCount = 0;
                currentQuizQuestions.forEach((q, i) => {
                    const selected = quizOverlay.querySelector(`input[name="q${i}"]:checked`)?.value;
                    if (selected === q.answer) correctCount++;
                });
                showScore(correctCount, currentQuizQuestions.length);
            };
        }
    };

    if (closeScoreBtn) closeScoreBtn.onclick = () => scoreResultModal.style.display = 'none';

// 6. Sửa lại hàm hiển thị danh sách đề thi để có nút "Làm bài"
function loadUserExams(uid) {
        if (!examListContainer) return;
        const q = query(collection(db, "exams"), where("userId", "==", uid));
        
        onSnapshot(q, (snapshot) => {
            examListContainer.innerHTML = '';
            snapshot.forEach((docSnap) => {
                const exam = docSnap.data();
                const examId = docSnap.id;
                
                const card = document.createElement('div');
                card.className = 'card exam-card';
                card.onclick = () => window.startQuiz(examId);

                card.innerHTML = `
                    <div class="exam-header-row" style="display:flex; justify-content: space-between; align-items: flex-start;">
                        <div class="exam-tag">${exam.subject}</div>
                        <button class="btn-delete" onclick="deleteExam(event, '${examId}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <h3 style="margin-top:10px">${exam.title}</h3>
                    <p style="font-size:0.85rem; color:var(--gray)"><i class="fas fa-list-ul"></i> ${exam.questions?.length || 0} câu hỏi</p>
                    <div style="margin-top:15px; display:flex; justify-content:space-between; align-items:center;">
                         <span style="font-size:0.8rem; color:#cbd5e0">${new Date(exam.createdAt?.toDate()).toLocaleDateString()}</span>
                         <button class="btn-primary" style="padding: 5px 15px; font-size: 0.8rem;">Làm bài</button>
                    </div>
                `;
                examListContainer.appendChild(card);
            });
        });
    }

// --- CỘNG ĐỒNG CHIA SẺ TÀI LIỆU ---
const postBtn = document.querySelector('.post-input-container .btn-primary');
const postTextarea = document.querySelector('.post-input-container textarea');
const feedContainer = document.querySelector('.feed-container');
    const btnChooseExam = document.getElementById('btn-choose-exam');
    const examSelectorModal = document.getElementById('exam-selector-modal');
    const selectorExamList = document.getElementById('selector-exam-list');
// 1. Hiện AVT người dùng đang đăng nhập vào ô post
function updateUIWithUser(user) {
    // 1. Cập nhật ảnh cho vòng tròn xanh trong phần đăng bài cộng đồng
    const userPostAvt = document.getElementById('user-post-avatar');
    if (userPostAvt && user.photoURL) {
        userPostAvt.style.backgroundImage = `url(${user.photoURL})`;
        // Khi đã có ảnh thì bỏ màu nền xanh mặc định đi
        userPostAvt.style.backgroundColor = 'transparent'; 
    }

    // 2. (Tùy chọn) Nếu bạn muốn hiện cả avatar của người đăng trong danh sách bài viết bên dưới
    // Bạn cần sửa trong hàm loadCommunityFeed() đoạn render HTML của mỗi post
    // bằng cách dùng: <img src="${post.userAvatar}" class="avatar-small">
}

// 2. Đăng bài
postBtn.onclick = async () => {
    if (!auth.currentUser) return alert("Hãy đăng nhập để đăng bài!");
    const text = postTextarea.value.trim();
    if (!text) return;

    await addDoc(collection(db, "posts"), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName,
        userAvatar: auth.currentUser.photoURL,
        content: text,
        likes: [],
        createdAt: new Date()
    });
    postTextarea.value = '';
};

//đăng bài thi
btnChooseExam.onclick = async () => {
        if (!auth.currentUser) return alert("Vui lòng đăng nhập!");
        examSelectorModal.style.display = 'flex';
        selectorExamList.innerHTML = 'Đang tải...';

        const q = query(collection(db, "exams"), where("userId", "==", auth.currentUser.uid));
        // const snap = await getDoc(collection(db, "exams")); // Lấy nhanh danh sách
        
        // Render danh sách đề để chọn
        onSnapshot(q, (snapshot) => {
        selectorExamList.innerHTML = '';
        if (snapshot.empty) {
            selectorExamList.innerHTML = '<p style="padding:10px;">Bạn chưa có đề thi nào để chia sẻ.</p>';
            return;
        }
        
        snapshot.forEach(docSnap => {
            const ex = docSnap.data();
            const item = document.createElement('div');
            item.className = 'card selector-item';
            item.style = "margin-bottom: 10px; cursor: pointer; padding: 15px; border: 1px solid #eee; transition: 0.3s;";
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${ex.title}</strong>< clouds br>
                        <small style="color:var(--gray)">Môn: ${ex.subject}</small>
                    </div>
                    <i class="fas fa-chevron-right" style="color:var(--primary)"></i>
                </div>
            `;
            item.onclick = () => shareExamToCommunity(docSnap.id, ex);
            
            // Thêm hiệu ứng hover bằng JS (hoặc CSS)
            item.onmouseover = () => item.style.borderColor = "var(--primary)";
            item.onmouseout = () => item.style.borderColor = "#eee";
            
            selectorExamList.appendChild(item);
        });
    });
        selectorExamList.innerHTML = '';
        if (snapshot.empty) {
            selectorExamList.innerHTML = '<p style="padding:10px;">Bạn chưa có đề thi nào để chia sẻ.</p>';
            return;
        }
    };

    async function shareExamToCommunity(examId, examData) {
        if (!confirm(`Bạn muốn chia sẻ đề "${examData.title}" lên cộng đồng?`)) return;
        
        await addDoc(collection(db, "posts"), {
            userId: auth.currentUser.uid,
            userName: auth.currentUser.displayName,
            userAvatar: auth.currentUser.photoURL,
            type: "exam",
            examId: examId,
            examTitle: examData.title,
            examSubject: examData.subject,
            content: `Mình vừa tạo một đề thi mới về ${examData.subject}. Mọi người cùng vào thử sức nhé!`,
            likes: [],
            createdAt: new Date()
        });

        examSelectorModal.style.display = 'none';
        alert("Đã chia sẻ thành công!");
    }

// 3. Load bảng tin cộng đồng
function loadCommunityFeed() {
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            const oldPosts = document.querySelectorAll('.post-card');
            oldPosts.forEach(p => p.remove());

            snapshot.forEach((docSnap) => {
                const post = docSnap.data();
                const postId = docSnap.id;
                const isLiked = post.likes.includes(auth.currentUser?.uid);

                let postBodyHTML = `<p>${post.content}</p>`;
                
                // Nếu bài đăng là loại Đề thi, hiển thị card đề thi đặc biệt
                if (post.type === "exam") {
                    postBodyHTML = `
                        <p>${post.content}</p>
                        <div class="card" style="border-left: 5px solid var(--primary); background: #f0f2ff; margin-top: 10px; padding: 15px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <span class="exam-tag" style="background:var(--primary); color:white">${post.examSubject}</span>
                                    <h4 style="margin: 5px 0;">${post.examTitle}</h4>
                                </div>
                                <button class="btn-primary" onclick="window.startQuiz('${post.examId}')">Thử sức ngay</button>
                            </div>
                        </div>
                    `;
                }

                const postHTML = `
                    <div class="post-card card">
                        <div class="post-header">
                            <img src="${post.userAvatar}" class="avatar-small">
                            <div class="post-info"><strong>${post.userName}</strong><span>Mới đăng</span></div>
                        </div>
                        <div class="post-content">${postBodyHTML}</div>
                        <div class="post-actions">
                            <button onclick="handleLike('${postId}', ${isLiked})" style="color: ${isLiked ? 'red' : 'inherit'}">
                                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${post.likes.length}
                            </button>
                        </div>
                    </div>
                `;
                feedContainer.insertAdjacentHTML('beforeend', postHTML);
            });
        });
    }

// 4. Xử lý Like
window.handleLike = async (postId, isLiked) => {
    if (!auth.currentUser) return alert("Đăng nhập để like!");
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid)
    });
};

// ======================
// AI SCHEDULER
// ======================

let scheduleA = [];
let scheduleB = [];

// 1. Hàm khởi tạo các cột Thứ cho một bảng
function initBoard(boardId) {
    const board = document.getElementById(boardId);
    board.innerHTML = '';
    const days = [
        { label: 'T2', value: '2' }, { label: 'T3', value: '3' },
        { label: 'T4', value: '4' }, { label: 'T5', value: '5' },
        { label: 'T6', value: '6' }, { label: 'T7', value: '7' },
        { label: 'CN', value: '0' }
    ];

    days.forEach(d => {
        const col = document.createElement('div');
        col.className = 'day-column';
        col.setAttribute('data-day', d.value);
        col.innerHTML = `<div class="day-header">${d.label}</div><div class="task-list"></div>`;
        board.appendChild(col);
    });
}

// 2. Hàm vẽ thẻ và SẮP XẾP THEO THỜI GIAN
function renderSchedule(data, boardId) {
    // Sắp xếp theo trình tự thời gian (Giờ bắt đầu)
    data.sort((a, b) => a.start.localeCompare(b.start));

    const board = document.getElementById(boardId);
    board.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');

    data.forEach((item, index) => {
        const list = board.querySelector(`.day-column[data-day="${item.day}"] .task-list`);
        if (list) {
            const card = document.createElement('div');
            card.className = 'task-card';
            card.innerHTML = `
                <strong>${item.name}</strong>
                <div class="task-time"><i class="far fa-clock"></i> ${item.start} - ${item.end}</div>
                <button class="btn-del-task" onclick="deleteTask('${boardId}', ${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            list.appendChild(card);
        }
    });
}

// 3. Xử lý xóa Task
window.deleteTask = async (boardId, index) => {
    if (boardId === 'board-A') {
        scheduleA.splice(index, 1);
        renderSchedule(scheduleA, 'board-A');
    } else {
        scheduleB.splice(index, 1);
        renderSchedule(scheduleB, 'board-B');
    }

    // GỌI HÀM LƯU SAU KHI XÓA
    await saveSchedulesToFirestore();
};

// 4. Xử lý nút Thêm
document.getElementById('add-busy-btn').onclick = async () => {
    const target = document.getElementById('input-target').value;
    const name = document.getElementById('input-task-name').value;
    const day = document.getElementById('input-day').value;
    const start = document.getElementById('input-start').value;
    const end = document.getElementById('input-end').value;

    if (!name) return alert("Nhập tên công việc");

    const newTask = { name, day, start, end };

    if (target === 'A') {
        scheduleA.push(newTask);
        renderSchedule(scheduleA, 'board-A');
    } else {
        scheduleB.push(newTask);
        renderSchedule(scheduleB, 'board-B');
    }

    // GỌI HÀM LƯU SAU KHI THÊM
    await saveSchedulesToFirestore();

    document.getElementById('input-task-name').value = '';
};

// 5. AI Sắp xếp lịch trống (Gửi cả 2 bảng cho Gemini)
document.getElementById('find-common-time-btn').onclick = async () => {
    const btn = document.getElementById('find-common-time-btn');
    const resultBox = document.getElementById('ai-result-box');
    const resultText = document.getElementById('ai-suggestion-text');

    btn.innerText = "Đang tính toán...";
    
    const prompt = `
        Tôi có lịch bận của 2 người như sau:
        Bạn A: ${JSON.stringify(scheduleA)}
        Bạn B: ${JSON.stringify(scheduleB)}
        Hãy tìm các khoảng thời gian trống chung (cả 2 đều rảnh) trong tuần từ 7:00 đến 22:00.
        Gợi ý ít nhất 3 lựa chọn tốt nhất để học nhóm. Trả về tiếng Việt, ngắn gọn, gạch đầu dòng.
    `;

    try {
        const response = await callGemini(prompt); // Sử dụng hàm callGemini có sẵn của bạn
        resultText.innerText = response;
        resultBox.style.display = 'block';
    } catch (e) {
        alert("Lỗi AI");
    } finally {
        btn.innerHTML = '<i class="fas fa-magic"></i> AI Sắp xếp lịch trống chung';
    }
};


async function saveSchedulesToFirestore() {
    if (!auth.currentUser) return;

    const userRef = doc(db, "users", auth.currentUser.uid);
    try {
        await updateDoc(userRef, {
            scheduleA: scheduleA,
            scheduleB: scheduleB
        });
        console.log("Đã tự động lưu thay đổi vào Firestore");
    } catch (error) {
        // Nếu document chưa tồn tại, dùng setDoc để tạo mới
        if (error.code === 'not-found') {
            await setDoc(userRef, {
                scheduleA: scheduleA,
                scheduleB: scheduleB
            }, { merge: true });
        } else {
            console.error("Lỗi khi lưu:", error);
        }
    }
}

// 2. Hàm TẢI dữ liệu khi load trang hoặc đăng nhập
async function loadSchedulesFromFirestore() {
    if (!auth.currentUser) return;

    const userRef = doc(db, "users", auth.currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const data = userSnap.data();
        // Gán dữ liệu từ Firestore vào biến cục bộ
        scheduleA = data.scheduleA || [];
        scheduleB = data.scheduleB || [];
        
        // Vẽ lại giao diện sau khi tải dữ liệu xong
        renderSchedule(scheduleA, 'board-A');
        renderSchedule(scheduleB, 'board-B');
    }
}


// Khởi tạo bảng khi load trang
initBoard('board-A');
initBoard('board-B');

// =======================
// --- LOGIC FLASHCARD ---
// =======================

let currentStudySet = [];
let currentCardIndex = 0;

// 1. Nút thêm hàng nhập liệu mới
document.getElementById('fc-add-row-btn').onclick = () => {
    const container = document.getElementById('fc-inputs-container');
    const rows = container.querySelectorAll('.fc-input-row');
    const newRow = document.createElement('div');
    newRow.className = 'fc-input-row';
    newRow.setAttribute('data-index', rows.length + 1); // Gắn số thứ tự
    newRow.innerHTML = `
        <input type="text" placeholder="Thuật ngữ (Mặt trước)" class="form-control fc-front">
        <input type="text" placeholder="Định nghĩa (Mặt sau)" class="form-control fc-back">
    `;
    container.appendChild(newRow);
};

// 2. Lưu bộ Flashcard lên Firestore
document.getElementById('fc-save-set-btn').onclick = async () => {
    if (!auth.currentUser) return alert("Vui lòng đăng nhập để lưu Flashcard!");
    
    const title = document.getElementById('fc-set-title').value.trim();
    if (!title) return alert("Vui lòng nhập tên bộ thẻ!");

    const cards = [];
    document.querySelectorAll('.fc-input-row').forEach(row => {
        const front = row.querySelector('.fc-front').value.trim();
        const back = row.querySelector('.fc-back').value.trim();
        if (front && back) {
            cards.push({ front, back });
        }
    });

    if (cards.length === 0) return alert("Vui lòng nhập ít nhất 1 thẻ hoàn chỉnh!");

    const btn = document.getElementById('fc-save-set-btn');
    btn.innerText = "Đang lưu...";

    try {
        // Lưu vào Collection mới tên là "flashcardSets"
        await addDoc(collection(db, "flashcardSets"), {
            userId: auth.currentUser.uid,
            title: title,
            cards: cards,
            createdAt: new Date().getTime() // Để sắp xếp theo thời gian
        });

        alert("Đã lưu bộ Flashcard thành công!");
        
        // Reset Form
        document.getElementById('fc-set-title').value = '';
        document.getElementById('fc-inputs-container').innerHTML = `
            <div class="fc-input-row">
                <input type="text" placeholder="Thuật ngữ (Mặt trước)" class="form-control fc-front">
                <input type="text" placeholder="Định nghĩa (Mặt sau)" class="form-control fc-back">
            </div>
        `;
        
        loadFlashcardSets(); // Tải lại danh sách
    } catch (error) {
        console.error("Lỗi khi lưu Flashcard: ", error);
        alert("Có lỗi xảy ra khi lưu!");
    } finally {
        btn.innerText = "Lưu bộ thẻ";
    }
};

// 3. Tải danh sách các bộ Flashcard từ Firestore
async function loadFlashcardSets() {
    if (!auth.currentUser) return;
    const container = document.getElementById('fc-saved-sets');
    container.innerHTML = '<p>Đang tải...</p>';

    try {
        const q = query(collection(db, "flashcardSets"), where("userId", "==", auth.currentUser.uid));
        const querySnapshot = await getDocs(q);
        container.innerHTML = '';
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p style="color: var(--gray);">Bạn chưa có bộ thẻ nào.</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const setId = docSnap.id;
            const setCard = document.createElement('div');
            setCard.className = 'set-card';
            
            // Layout bên trong thẻ bao gồm nội dung và Menu điều khiển
            setCard.innerHTML = `
                <div class="set-content" style="flex:1">
                    <h4 style="margin:0 0 5px 0;">${data.title}</h4>
                    <span style="font-size:0.8rem; color: var(--gray);">${data.cards.length} thẻ</span>
                </div>
                <div class="set-menu-btn" onclick="toggleDeleteMenu(event, '${setId}')">
                    <i class="fas fa-ellipsis-v"></i>
                </div>
                <div id="menu-${setId}" class="delete-menu">
                    <button onclick="confirmDeleteSet(event, '${setId}')">
                        <i class="far fa-trash-alt"></i> Xóa bộ thẻ
                    </button>
                </div>
            `;
            
            // Chỉ khi click vào phần content mới mở chế độ học
            setCard.querySelector('.set-content').onclick = () => openStudyMode(data.title, data.cards);
            container.appendChild(setCard);
        });
    } catch (error) { console.error(error); }
}

// Hàm đóng/mở menu xóa
window.toggleDeleteMenu = (event, setId) => {
    event.stopPropagation(); // Ngăn việc click vào menu làm mở chế độ học
    const allMenus = document.querySelectorAll('.delete-menu');
    allMenus.forEach(m => {
        if(m.id !== `menu-${setId}`) m.style.display = 'none';
    });

    const menu = document.getElementById(`menu-${setId}`);
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
};

// Hàm thực hiện xóa
window.confirmDeleteSet = async (event, setId) => {
    event.stopPropagation();
    if (confirm("Bạn có chắc chắn muốn xóa bộ Flashcard này không?")) {
        try {
            await deleteDoc(doc(db, "flashcardSets", setId));
            loadFlashcardSets(); // Load lại danh sách sau khi xóa
        } catch (error) {
            alert("Lỗi khi xóa: " + error.message);
        }
    }
};

// Đóng menu nếu click ra ngoài
document.addEventListener('click', () => {
    document.querySelectorAll('.delete-menu').forEach(m => m.style.display = 'none');
});

// 4. Logic Chế độ học (Study Mode)
function openStudyMode(title, cards) {
    currentStudySet = cards;
    currentCardIndex = 0;
    
    document.getElementById('study-title').innerText = title;
    document.getElementById('fc-sets-list-container').style.display = 'none';
    document.getElementById('fc-study-mode').style.display = 'block';
    
    // Đảm bảo thẻ luôn ngửa mặt trước khi mới mở
    document.querySelector('.study-card').classList.remove('flipped');
    updateStudyCard();
}

function updateStudyCard() {
    if (currentStudySet.length === 0) return;
    
    document.getElementById('study-front').innerText = currentStudySet[currentCardIndex].front;
    document.getElementById('study-back').innerText = currentStudySet[currentCardIndex].back;
    document.getElementById('study-progress').innerText = `${currentCardIndex + 1} / ${currentStudySet.length}`;
}

// Nút Đóng chế độ học
document.getElementById('fc-close-study').onclick = () => {
    document.getElementById('fc-study-mode').style.display = 'none';
    document.getElementById('fc-sets-list-container').style.display = 'block';
};

// Nút Next / Prev thẻ
document.getElementById('btn-next-card').onclick = () => {
    if (currentCardIndex < currentStudySet.length - 1) {
        document.querySelector('.study-card').classList.remove('flipped'); // Úp thẻ lại
        setTimeout(() => { // Đợi lật xong mới đổi chữ
            currentCardIndex++;
            updateStudyCard();
        }, 150); 
    }
};

document.getElementById('btn-prev-card').onclick = () => {
    if (currentCardIndex > 0) {
        document.querySelector('.study-card').classList.remove('flipped');
        setTimeout(() => {
            currentCardIndex--;
            updateStudyCard();
        }, 150);
    }
};


// ===================================
// THUẬT TOÁN BÌNH LUẬN & XÓA BÀI ĐĂNG
// ===================================


});