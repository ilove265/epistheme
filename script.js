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
            parts: [{ text: "Bạn là trợ lý AI STUDY cao cấp. Hãy hỗ trợ người dùng học tập, giải đáp kiến thức khoa học, vật lý, và soạn thảo đề thi chuyên nghiệp. Phong cách trả lời: Thông minh, súc tích, hơi hướng tương lai." }]
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
const examModal = document.getElementById('exam-modal');
const btnCreateExam = document.querySelector('#exams .btn-primary');
const examListContainer = document.querySelector('#exams .grid-layout');

// Mở modal tạo đề
btnCreateExam.onclick = () => examModal.style.display = 'block';
document.getElementById('cancel-exam').onclick = () => examModal.style.display = 'none';

// Toggle cách nhập liệu
document.getElementById('btn-manual-input').onclick = () => {
    document.getElementById('exam-content').style.display = 'block';
    document.getElementById('exam-file-input').style.display = 'none';
};
document.getElementById('btn-upload-file').onclick = () => {
    document.getElementById('exam-file-input').style.display = 'block';
    document.getElementById('exam-content').style.display = 'none';
};

// Lưu đề thi vào Firestore
document.getElementById('save-exam').onclick = async () => {
    if (!auth.currentUser) return alert("Vui lòng đăng nhập!");
    
    const title = document.getElementById('exam-title').value;
    const subject = document.getElementById('exam-subject').value;
    const content = document.getElementById('exam-content').value;

    try {
        await addDoc(collection(db, "exams"), {
            userId: auth.currentUser.uid,
            title,
            subject,
            content,
            createdAt: new Date()
        });
        alert("Đã tạo đề thi thành công!");
        examModal.style.display = 'none';
    } catch (e) { console.error(e); }
};

// Hàm hiển thị danh sách đề thi CỦA RIÊNG USER
function loadUserExams(uid) {
    const q = query(collection(db, "exams"), where("userId", "==", uid));
    onSnapshot(q, (snapshot) => {
        examListContainer.innerHTML = ''; // Clear cũ
        snapshot.forEach((doc) => {
            const exam = doc.data();
            examListContainer.innerHTML += `
                <div class="card exam-card">
                    <div class="exam-tag">${exam.subject}</div>
                    <h3>${exam.title}</h3>
                    <button class="btn-ghost share-exam-btn" data-id="${doc.id}">Chia sẻ lên cộng đồng</button>
                </div>
            `;
        });
    });
}


// --- CỘNG ĐỒNG CHIA SẺ TÀI LIỆU ---
const postBtn = document.querySelector('.post-input-container .btn-primary');
const postTextarea = document.querySelector('.post-input-container textarea');
const feedContainer = document.querySelector('.feed-container');

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

// 3. Load bảng tin cộng đồng
function loadCommunityFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        // Xóa các bài đăng cũ trừ ô nhập liệu
        const postCards = document.querySelectorAll('.post-card');
        postCards.forEach(card => card.remove());

        snapshot.forEach((doc) => {
            const post = doc.data();
            const postId = doc.id;
            const isLiked = post.likes.includes(auth.currentUser?.uid);

            const postHTML = `
                <div class="post-card card">
                    <div class="post-header">
                        <img src="${post.userAvatar}" class="avatar-small">
                        <div class="post-info">
                            <strong>${post.userName}</strong>
                            <span>Vừa xong</span>
                        </div>
                    </div>
                    <div class="post-content"><p>${post.content}</p></div>
                    <div class="post-stats">
                        <span><i class="fas fa-heart"></i> ${post.likes.length} yêu thích</span>
                    </div>
                    <div class="post-actions">
                        <button onclick="handleLike('${postId}', ${isLiked})" style="color: ${isLiked ? 'red' : 'inherit'}">
                            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> Thích
                        </button>
                        <button><i class="far fa-comment"></i> Bình luận</button>
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