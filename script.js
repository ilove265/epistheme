import { auth, db, provider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth"; 
import { doc, setDoc, getDoc } from "firebase/firestore";
import { collection, addDoc, query, where, onSnapshot, updateDoc, arrayUnion, arrayRemove, orderBy } from "firebase/firestore";
document.addEventListener('DOMContentLoaded', () => {
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
            if (userDoc.exists()) {
                currentUserData = userDoc.data();
                console.log("Tính cách AI của bạn là:", currentUserData.ai_personality);
            }
            updateUIWithUser(user);
            loadUserExams(user.uid); // Chỉ hiện đề của mình
            loadCommunityFeed();     // Hiện bảng tin chung
        } else {
            // --- NGƯỜI DÙNG CHƯA ĐĂNG NHẬP ---
            loginBtn.style.display = 'block';
            userProfile.style.display = 'none';
            currentUserData = null;
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

// 5. Hàm Bắt đầu làm bài (Khi ấn vào thẻ đề thi)
window.startQuiz = async (examId) => {
        const docSnap = await getDoc(doc(db, "exams", examId));
        if (docSnap.exists()) {
            const exam = docSnap.data();
            
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
                let correctCount = 0;
                const total = exam.questions.length;

                exam.questions.forEach((q, index) => {
                    const selected = quizOverlay.querySelector(`input[name="q${index}"]:checked`)?.value;
                    if (selected === q.answer) {
                        correctCount++;
                    }
                });

                // Tính điểm trên thang 10
                const score = ((correctCount / total) * 10).toFixed(2);
                
                alert(`Chúc mừng! Bạn đã hoàn thành bài thi.\nSố câu đúng: ${correctCount}/${total}\nĐiểm số: ${score}/10`);
                quizOverlay.style.display = 'none';
            };
        }
    };

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


});